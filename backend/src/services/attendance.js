// 出勤核销服务（核心业务逻辑）
// COA-003/004/005：教练出勤登记 → 自动核销（次卡/月卡）→ 计入教练统计
// GNR-001：幂等，不允许重复扣费
import { getDb } from '../db/index.js';
import { uuid, now, currentMonth, addMonths } from '../utils/helpers.js';
import { ATTENDANCE_STATUS, PACK_STATUS, SESSION_STATUS, AUDIT_ACTIONS, CHARGE_MODES } from '../../../shared/constants.js';
import { writeAudit, operatorFromReq } from './audit.js';
import { BizError } from '../middleware/error.js';

// 获取学员可用资产（用于出勤前校验）
export function getMemberAssetsForAttendance(memberId, businessType) {
  const db = getDb();
  // 优先匹配同业务类型的有效次卡/月卡
  const packs = db.prepare(`SELECT * FROM packs WHERE member_id = ? AND status = 'ACTIVE' AND valid_until >= date('now') AND (business_type = ? OR ? IS NULL) ORDER BY created_at ASC`).all(memberId, businessType, businessType);
  const sessionPack = packs.find((p) => p.pack_type === 'SESSION_PACK' && p.remaining_sessions > 0);
  const monthlyPack = packs.find((p) => p.pack_type === 'MONTHLY');
  // 月卡当月额度检查
  let monthlyAvailable = 0;
  if (monthlyPack) {
    const month = currentMonth();
    if (monthlyPack.monthly_period !== month) {
      // 跨月重置
      monthlyAvailable = monthlyPack.monthly_quota;
    } else {
      monthlyAvailable = monthlyPack.monthly_remaining;
    }
  }
  return {
    sessionPack,
    monthlyPack,
    monthlyAvailable,
    hasAsset: (sessionPack && sessionPack.remaining_sessions > 0) || (monthlyAvailable > 0),
  };
}

// 核销逻辑（GNR-001 幂等）
function consumeAsset(db, memberId, businessType, courseId, sessionId, orderId, operator) {
  const assets = getMemberAssetsForAttendance(memberId, businessType);
  // 优先级：月卡当月额度 > 次卡
  if (assets.monthlyPack && assets.monthlyAvailable > 0) {
    return consumeMonthly(db, assets.monthlyPack, memberId, sessionId, orderId, operator);
  }
  if (assets.sessionPack && assets.sessionPack.remaining_sessions > 0) {
    return consumeSessionPack(db, assets.sessionPack, memberId, sessionId, orderId, operator);
  }
  return null; // 无可用资产
}

function consumeSessionPack(db, pack, memberId, sessionId, orderId, operator) {
  // 判断当前消费的是否是赠送课时（先消费购买课时，后消费赠送课时）
  const purchasedSessions = pack.total_sessions - pack.gift_sessions;
  const isGiftSession = pack.used_sessions >= purchasedSessions;
  const newRemaining = pack.remaining_sessions - 1;
  const newUsed = pack.used_sessions + 1;
  const status = newRemaining === 0 ? PACK_STATUS.CONSUMED : PACK_STATUS.ACTIVE;
  db.prepare('UPDATE packs SET remaining_sessions = ?, used_sessions = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(newRemaining, newUsed, status, now(), pack.id);
  const consumptionId = uuid();
  db.prepare(`INSERT INTO pack_consumptions (id, pack_id, member_id, session_id, order_id, sessions_used, amount, charge_mode, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, 'SESSION_PACK', ?)`)
    .run(consumptionId, pack.id, memberId, sessionId, orderId, now());
  return { consumptionId, packId: pack.id, chargeMode: 'SESSION_PACK', amount: 0, sessionsUsed: 1, isGiftSession };
}

function consumeMonthly(db, pack, memberId, sessionId, orderId, operator) {
  const month = currentMonth();
  let monthlyRemaining = pack.monthly_remaining;
  if (pack.monthly_period !== month) {
    // 跨月重置
    monthlyRemaining = pack.monthly_quota;
    db.prepare('UPDATE packs SET monthly_period = ?, monthly_used = 0, monthly_remaining = ?, updated_at = ? WHERE id = ?')
      .run(month, pack.monthly_quota, now(), pack.id);
  }
  const newRemaining = monthlyRemaining - 1;
  const newUsed = (pack.monthly_period === month ? pack.monthly_used : 0) + 1;
  db.prepare('UPDATE packs SET monthly_used = ?, monthly_remaining = ?, updated_at = ? WHERE id = ?')
    .run(newUsed, newRemaining, now(), pack.id);
  const consumptionId = uuid();
  db.prepare(`INSERT INTO pack_consumptions (id, pack_id, member_id, session_id, order_id, sessions_used, amount, charge_mode, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, 'MONTHLY', ?)`)
    .run(consumptionId, pack.id, memberId, sessionId, orderId, now());
  return { consumptionId, packId: pack.id, chargeMode: 'MONTHLY', amount: 0, sessionsUsed: 1 };
}

// 获取教练费率
function getCoachRate(db, coachId, businessType) {
  const rate = db.prepare('SELECT * FROM coach_rates WHERE coach_id = ? AND business_type = ?').get(coachId, businessType);
  return rate || { lesson_fee: 0, share_rate: 0 };
}

// ============ 提交出勤（批量） ============
export function submitAttendance(sessionId, attendanceList, operator) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) throw new BizError('课次不存在', 404);
  if (session.status === SESSION_STATUS.CANCELLED) throw new BizError('课次已取消');
  // 幂等：课次已完成时，对已有出勤记录的会员跳过，但仍允许补登未登记的会员
  if (session.status === SESSION_STATUS.COMPLETED) {
    const existing = db.prepare('SELECT member_id, status FROM attendance WHERE session_id = ?').all(sessionId);
    const existingMap = {};
    existing.forEach((a) => { existingMap[a.member_id] = a; });
    // 过滤出还没有出勤记录的会员
    const newItems = (attendanceList || []).filter((item) => item.memberId && !existingMap[item.memberId]);
    if (newItems.length === 0) {
      return {
        sessionId,
        results: existing.map((a) => ({ memberId: a.member_id, status: a.status, skipped: true, reason: '课次已完成' })),
        skipped: true,
      };
    }
    // 有未登记的会员，继续处理
    attendanceList = newItems;
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(session.course_id);
  const coachRate = getCoachRate(db, session.coach_id, session.business_type);

  return db.transaction(() => {
    const results = [];
    for (const item of attendanceList) {
      const { memberId, status, note } = item;
      if (!memberId) continue;
      // 幂等校验（GNR-001）
      const exist = db.prepare('SELECT id FROM attendance WHERE session_id = ? AND member_id = ?').get(sessionId, memberId);
      if (exist) {
        results.push({ memberId, skipped: true, reason: '已存在出勤记录' });
        continue;
      }

      let consumptionResult = null;
      let finalStatus = status;

      if (status === ATTENDANCE_STATUS.PRESENT) {
        // 出勤触发核销
        try {
          consumptionResult = consumeAsset(db, memberId, session.business_type, session.course_id, sessionId, null, operator);
          if (!consumptionResult) {
            // 资产不足 → 标记待补费（COA-005）
            finalStatus = ATTENDANCE_STATUS.PENDING_PAY;
          }
        } catch (e) {
          console.error('[attendance] 核销失败 member=%s bt=%s:', memberId, session.business_type, e.message);
          finalStatus = ATTENDANCE_STATUS.PENDING_PAY;
        }
      }

      // 计算教练课时费/分成（仅出勤状态）
      let lessonFee = 0;
      let shareAmount = 0;
      let salesCommissionAmount = 0;
      if (finalStatus === ATTENDANCE_STATUS.PRESENT) {
        // 判断是否为赠送课时
        const isGiftSession = consumptionResult?.isGiftSession || false;
        // 赠送课时且未开启赠送提成时，不计算课时费和分成
        const skipCommission = isGiftSession && !coachRate.gift_commission;
        if (!skipCommission) {
          lessonFee = coachRate.lesson_fee || 0;
          // 分成 = 课程收入 × 分成比例（课程收入取标准单价）
          const courseIncome = course?.standard_price || 0;
          shareAmount = Math.round(courseIncome * (coachRate.share_rate || 0) / 100);
          // 销售提成：按节计提（课后计提）
          // 每节提成 = 订单预估总提成 / 课包总节数（保证总提成 = 预估提成）
          if (consumptionResult?.packId) {
            const pack = db.prepare('SELECT order_id, total_sessions, gift_sessions, monthly_quota FROM packs WHERE id = ?').get(consumptionResult.packId);
            if (pack?.order_id) {
              const order = db.prepare('SELECT id, sales_id, sales_type, sales_name, commission_rate, commission_type, business_type, status, commission_amount, amount FROM orders WHERE id = ?').get(pack.order_id);
              if (order && order.status === 'PAID' && order.sales_id && order.commission_rate > 0 && order.sales_type !== 'admin') {
                // 用订单预估总提成 / 非赠送总节数 = 每节提成
                // 赠送课时跳过提成，所以分母用非赠送节数，确保非赠送课全消完后总提成 = 预估提成
                const nonGiftSessions = pack.total_sessions ? (pack.total_sessions - (pack.gift_sessions || 0)) : (pack.monthly_quota || 0);
                if (nonGiftSessions > 0 && order.commission_amount > 0) {
                  salesCommissionAmount = Math.round(order.commission_amount / nonGiftSessions);
                } else {
                  // 回退：按课程标准单价 × 提成率
                  salesCommissionAmount = Math.round((course?.standard_price || 0) * order.commission_rate / 100);
                }
                // 记录销售提成（课后计提）
                db.prepare(`INSERT INTO commission_records (id, order_id, beneficiary_id, beneficiary_type, beneficiary_name, commission_type, business_type, rate, amount, status, session_id, created_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
                  .run(uuid(), order.id, order.sales_id, order.sales_type, order.sales_name, order.commission_type, order.business_type, order.commission_rate, salesCommissionAmount, sessionId, now());
              }
            }
          }
        }
      }

      const attId = uuid();
      db.prepare(`INSERT INTO attendance (id, session_id, member_id, coach_id, status, pack_id, consumption_id, lesson_fee, share_amount, note, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(attId, sessionId, memberId, session.coach_id, finalStatus,
          consumptionResult?.packId || null, consumptionResult?.consumptionId || null,
          lessonFee, shareAmount, note || null, now(), now());

      // 若约课存在，更新约课状态
      if (finalStatus === ATTENDANCE_STATUS.PRESENT) {
        db.prepare("UPDATE bookings SET status = 'ATTENDED', updated_at = ? WHERE session_id = ? AND member_id = ? AND status = 'BOOKED'")
          .run(now(), sessionId, memberId);
      } else if (status === ATTENDANCE_STATUS.ABSENT) {
        // 爽约处理（MBR-004：默认仅记录）
        db.prepare("UPDATE bookings SET status = 'NOSHOW', updated_at = ? WHERE session_id = ? AND member_id = ? AND status = 'BOOKED'")
          .run(now(), sessionId, memberId);
      }

      results.push({
        memberId, status: finalStatus, consumption: consumptionResult, lessonFee, shareAmount,
      });
    }

    // 仅当所有已预约会员都有出勤记录时，才标记课次完成
    const totalBookings = db.prepare("SELECT COUNT(*) as cnt FROM bookings WHERE session_id = ? AND status IN ('BOOKED', 'ATTENDED', 'NOSHOW')").get(sessionId);
    const totalAttendance = db.prepare('SELECT COUNT(*) as cnt FROM attendance WHERE session_id = ?').get(sessionId);
    if (totalBookings.cnt === 0 || totalAttendance.cnt >= totalBookings.cnt) {
      db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?').run(SESSION_STATUS.COMPLETED, now(), sessionId);
    }

    writeAudit({ entity: 'session', entityId: sessionId, action: 'ATTENDANCE_SUBMIT', operator, detail: { results } });
    return { sessionId, results };
  })();
}

// ============ 修改出勤（COA-007，记录日志） ============
export function updateAttendance(sessionId, memberId, newStatus, operator, reason) {
  const db = getDb();
  const att = db.prepare('SELECT * FROM attendance WHERE session_id = ? AND member_id = ?').get(sessionId, memberId);
  if (!att) throw new BizError('出勤记录不存在', 404);
  const oldStatus = att.status;

  return db.transaction(() => {
    // 如果从 PENDING_PAY 改为 PRESENT，尝试重新核销
    let consumptionResult = null;
    if (oldStatus !== ATTENDANCE_STATUS.PRESENT && newStatus === ATTENDANCE_STATUS.PRESENT) {
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      try {
        consumptionResult = consumeAsset(db, memberId, session.business_type, session.course_id, sessionId, null, operator);
      } catch (e) {
        throw new BizError('资产仍不足，无法改为出勤：' + e.message);
      }
      // 计算课时费
      const coachRate = getCoachRate(db, att.coach_id, session.business_type);
      const course = db.prepare('SELECT standard_price FROM courses WHERE id = ?').get(session.course_id);
      const isGiftSession = consumptionResult?.isGiftSession || false;
      const skipCommission = isGiftSession && !coachRate.gift_commission;
      const lessonFee = skipCommission ? 0 : (coachRate.lesson_fee || 0);
      const shareAmount = skipCommission ? 0 : Math.round((course?.standard_price || 0) * (coachRate.share_rate || 0) / 100);
      db.prepare('UPDATE attendance SET status = ?, pack_id = ?, consumption_id = ?, lesson_fee = ?, share_amount = ?, updated_at = ? WHERE id = ?')
        .run(newStatus, consumptionResult?.packId, consumptionResult?.consumptionId, lessonFee, shareAmount, now(), att.id);

      // 补记销售提成（课后计提）
      if (!skipCommission && consumptionResult?.packId) {
        const pack = db.prepare('SELECT order_id, total_sessions, gift_sessions, monthly_quota FROM packs WHERE id = ?').get(consumptionResult.packId);
        if (pack?.order_id) {
          const order = db.prepare('SELECT id, sales_id, sales_type, sales_name, commission_rate, commission_type, business_type, status, commission_amount FROM orders WHERE id = ?').get(pack.order_id);
          if (order && order.status === 'PAID' && order.sales_id && order.commission_rate > 0 && order.sales_type !== 'admin') {
            // 幂等：检查是否已存在该课次的提成记录
            const exist = db.prepare('SELECT id FROM commission_records WHERE session_id = ? AND beneficiary_id = ? AND status = ?').get(sessionId, order.sales_id, 'ACTIVE');
            if (!exist) {
              const nonGiftSessions = pack.total_sessions ? (pack.total_sessions - (pack.gift_sessions || 0)) : (pack.monthly_quota || 0);
              let salesCommissionAmount = 0;
              if (nonGiftSessions > 0 && order.commission_amount > 0) {
                salesCommissionAmount = Math.round(order.commission_amount / nonGiftSessions);
              } else {
                salesCommissionAmount = Math.round((course?.standard_price || 0) * order.commission_rate / 100);
              }
              db.prepare(`INSERT INTO commission_records (id, order_id, beneficiary_id, beneficiary_type, beneficiary_name, commission_type, business_type, rate, amount, status, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
                .run(uuid(), order.id, order.sales_id, order.sales_type, order.sales_name, order.commission_type, order.business_type, order.commission_rate, salesCommissionAmount, sessionId, now());
            }
          }
        }
      }
    } else {
      db.prepare('UPDATE attendance SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now(), att.id);
    }

    // 记录修改日志
    db.prepare(`INSERT INTO attendance_change_logs (id, attendance_id, old_status, new_status, operator_id, operator_type, operator_name, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuid(), att.id, oldStatus, newStatus, operator?.id, operator?.type, operator?.name, reason, now());

    writeAudit({ entity: 'attendance', entityId: att.id, action: AUDIT_ACTIONS.ATTENDANCE_CHANGE, operator, detail: { oldStatus, newStatus, reason } });
    return { updated: true, oldStatus, newStatus, consumption: consumptionResult };
  })();
}

// ============ 查询课次出勤 ============
export function getSessionAttendance(sessionId) {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, m.name as member_name, s.date, s.start_time, c.name as course_name
    FROM attendance a
    JOIN sessions s ON a.session_id = s.id
    LEFT JOIN members m ON a.member_id = m.id
    LEFT JOIN courses c ON s.course_id = c.id
    WHERE a.session_id = ?
    ORDER BY a.created_at
  `).all(sessionId);
}

// ============ 教练上课统计 ============
export function getCoachStats(coachId, startDate, endDate) {
  const db = getDb();
  const where = [`a.coach_id = ?`];
  const params = [coachId];
  if (startDate) { where.push('s.date >= ?'); params.push(startDate); }
  if (endDate) { where.push('s.date <= ?'); params.push(endDate); }
  const whereSql = where.join(' AND ');

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN a.status = 'PENDING_PAY' THEN 1 ELSE 0 END) as pending_pay_count,
      SUM(a.lesson_fee) as total_lesson_fee,
      SUM(a.share_amount) as total_share
    FROM attendance a
    JOIN sessions s ON a.session_id = s.id
    WHERE ${whereSql}
  `).get(...params);

  // 按业务类型分组
  const byBusinessType = db.prepare(`
    SELECT s.business_type,
      COUNT(*) as sessions,
      SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
      SUM(a.lesson_fee) as lesson_fee,
      SUM(a.share_amount) as share_amount
    FROM attendance a
    JOIN sessions s ON a.session_id = s.id
    WHERE ${whereSql}
    GROUP BY s.business_type
  `).all(...params);

  return { summary, byBusinessType };
}
