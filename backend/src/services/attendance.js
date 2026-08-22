// 出勤核销服务（核心业务逻辑）
// COA-003/004/005：教练出勤登记 → 自动核销（次卡/预存/月卡）→ 计入教练统计
// GNR-001：幂等，不允许重复扣费
import { getDb } from '../db/index.js';
import { uuid, now, currentMonth, addMonths } from '../utils/helpers.js';
import { ATTENDANCE_STATUS, PACK_STATUS, SESSION_STATUS, AUDIT_ACTIONS, CHARGE_MODES } from '../../../shared/constants.js';
import { writeAudit, operatorFromReq } from './audit.js';
import { BizError } from '../middleware/error.js';

// 获取学员可用资产（用于出勤前校验）
export function getMemberAssetsForAttendance(memberId, businessType) {
  const db = getDb();
  const prepaid = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(memberId);
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
    prepaid: prepaid || { principal_balance: 0, gift_balance: 0, total_balance: 0 },
    sessionPack,
    monthlyPack,
    monthlyAvailable,
    hasAsset: (sessionPack && sessionPack.remaining_sessions > 0) || (monthlyAvailable > 0) || (prepaid && prepaid.total_balance > 0),
  };
}

// 核销逻辑（GNR-001 幂等）
function consumeAsset(db, memberId, businessType, courseId, sessionId, orderId, operator) {
  const assets = getMemberAssetsForAttendance(memberId, businessType);
  // 优先级：月卡当月额度 > 次卡 > 预存
  if (assets.monthlyPack && assets.monthlyAvailable > 0) {
    return consumeMonthly(db, assets.monthlyPack, memberId, sessionId, orderId, operator);
  }
  if (assets.sessionPack && assets.sessionPack.remaining_sessions > 0) {
    return consumeSessionPack(db, assets.sessionPack, memberId, sessionId, orderId, operator);
  }
  if (assets.prepaid && assets.prepaid.total_balance > 0) {
    // 需要课程单价
    const course = courseId ? db.prepare('SELECT standard_price FROM courses WHERE id = ?').get(courseId) : null;
    const price = course?.standard_price || 0;
    if (price === 0) throw new BizError('预存核销需课程单价');
    return consumePrepaid(db, assets.prepaid, memberId, sessionId, orderId, price, operator);
  }
  return null; // 无可用资产
}

function consumeSessionPack(db, pack, memberId, sessionId, orderId, operator) {
  const newRemaining = pack.remaining_sessions - 1;
  const newUsed = pack.used_sessions + 1;
  const status = newRemaining === 0 ? PACK_STATUS.CONSUMED : PACK_STATUS.ACTIVE;
  db.prepare('UPDATE packs SET remaining_sessions = ?, used_sessions = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(newRemaining, newUsed, status, now(), pack.id);
  const consumptionId = uuid();
  db.prepare(`INSERT INTO pack_consumptions (id, pack_id, member_id, session_id, order_id, sessions_used, amount, charge_mode, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, 'SESSION_PACK', ?)`)
    .run(consumptionId, pack.id, memberId, sessionId, orderId, now());
  return { consumptionId, packId: pack.id, chargeMode: 'SESSION_PACK', amount: 0, sessionsUsed: 1 };
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

function consumePrepaid(db, account, memberId, sessionId, orderId, price, operator) {
  // 扣费顺序：先扣本金，再扣赠送（Q-01）
  let remaining = price;
  let principalPart = 0;
  let giftPart = 0;
  if (account.principal_balance >= remaining) {
    principalPart = remaining;
    remaining = 0;
  } else {
    principalPart = account.principal_balance;
    remaining -= account.principal_balance;
    giftPart = Math.min(remaining, account.gift_balance);
    remaining -= giftPart;
  }
  if (remaining > 0) throw new BizError('预存余额不足');

  const newPrincipal = account.principal_balance - principalPart;
  const newGift = account.gift_balance - giftPart;
  const newTotal = newPrincipal + newGift;
  db.prepare('UPDATE prepaid_accounts SET principal_balance = ?, gift_balance = ?, total_balance = ?, updated_at = ? WHERE id = ?')
    .run(newPrincipal, newGift, newTotal, now(), account.id);
  db.prepare(`INSERT INTO prepaid_transactions (id, account_id, member_id, session_id, type, principal_delta, gift_delta, amount, balance_after, created_at) VALUES (?, ?, ?, ?, 'CONSUME', ?, ?, ?, ?, ?)`)
    .run(uuid(), account.id, memberId, sessionId, -principalPart, -giftPart, price, newTotal, now());
  const consumptionId = uuid();
  db.prepare(`INSERT INTO pack_consumptions (id, pack_id, member_id, session_id, order_id, sessions_used, amount, principal_part, gift_part, charge_mode, created_at) VALUES (?, NULL, ?, ?, ?, 0, ?, ?, ?, 'PREPAID', ?)`)
    .run(consumptionId, memberId, sessionId, orderId, price, principalPart, giftPart, now());
  return { consumptionId, packId: null, chargeMode: 'PREPAID', amount: price, principalPart, giftPart };
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
  // 幂等：课次已完成时，返回已存在的出勤记录（不抛错，不重复扣费）
  if (session.status === SESSION_STATUS.COMPLETED) {
    const existing = db.prepare('SELECT member_id, status FROM attendance WHERE session_id = ?').all(sessionId);
    return {
      sessionId,
      results: existing.map((a) => ({ memberId: a.member_id, status: a.status, skipped: true, reason: '课次已完成' })),
      skipped: true,
    };
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
          finalStatus = ATTENDANCE_STATUS.PENDING_PAY;
        }
      }

      // 计算教练课时费/分成（仅出勤状态）
      let lessonFee = 0;
      let shareAmount = 0;
      if (finalStatus === ATTENDANCE_STATUS.PRESENT) {
        lessonFee = coachRate.lesson_fee || 0;
        // 分成 = 课程收入 × 分成比例（课程收入取标准单价）
        const courseIncome = course?.standard_price || 0;
        shareAmount = Math.round(courseIncome * (coachRate.share_rate || 0) / 100);
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

    // 标记课次完成
    db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?').run(SESSION_STATUS.COMPLETED, now(), sessionId);

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
      const lessonFee = coachRate.lesson_fee || 0;
      const shareAmount = Math.round((course?.standard_price || 0) * (coachRate.share_rate || 0) / 100);
      db.prepare('UPDATE attendance SET status = ?, pack_id = ?, consumption_id = ?, lesson_fee = ?, share_amount = ?, updated_at = ? WHERE id = ?')
        .run(newStatus, consumptionResult?.packId, consumptionResult?.consumptionId, lessonFee, shareAmount, now(), att.id);
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
