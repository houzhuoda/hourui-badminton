// 订单服务：购课开单（次卡/月卡/单次）+ 提成计算 + 退款
import { getDb } from '../db/index.js';
import {
  uuid, now, generateOrderNo, formatDate, addDays, addMonths, currentMonth,
} from '../utils/helpers.js';
import { BUSINESS_TO_CATEGORY, CHARGE_MODES, COMMISSION_TYPES, ORDER_STATUS, PACK_STATUS, DEFAULTS, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { writeAudit, operatorFromReq } from './audit.js';
import { autoAddTagOnPurchase } from './member.js';
import { BizError } from '../middleware/error.js';

// ============ 判断新客/续费 ============
export function determineCommissionType(memberId) {
  const db = getDb();
  const cnt = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE member_id = ? AND status = 'PAID'").get(memberId).cnt;
  return cnt === 0 ? COMMISSION_TYPES.NEW : COMMISSION_TYPES.RENEW;
}

// ============ 计算折扣（取最优，不叠加 Q-09） ============
// 折扣功能已取消：次卡/月卡只有送课优惠，不再支持折扣
export function calculateBestDiscount({ businessType, courseId, amount, isNew, db }) {
  return { finalAmount: amount, discountAmount: 0, appliedRule: null };
}

// ============ 获取销售提成比例 ============
export function getCommissionRate(businessType, commissionType) {
  const db = getDb();
  const rule = db.prepare('SELECT rate FROM commission_rules WHERE business_type = ? AND commission_type = ? AND status = ?').get(businessType, commissionType, 'ACTIVE');
  return rule ? rule.rate : 0;
}

// ============ 开单主流程 ============
export function createOrder(data, operator) {
  const {
    memberId, courseId, businessType, chargeMode,
    // 次卡模式
    sessionPricingId,
    // 月卡模式
    monthlyPricingId,
    // 群活动单次
    singlePrice,
  } = data;
  // 次卡模式参数（可被 sessionPricingId 覆盖）
  let sessions = data.sessions;
  let price = data.price;
  let giftSessions = data.giftSessions;
  // 月卡模式参数
  let monthlyFee = data.monthlyFee;
  let monthlyQuota = data.monthlyQuota;
  let weeklyFrequency = data.weeklyFrequency;

  if (!memberId || !businessType || !chargeMode) throw new BizError('会员、业务类型、收费模式必填');
  if (!CHARGE_MODES.find((m) => m.code === chargeMode)) throw new BizError('无效收费模式');

  const db = getDb();
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) throw new BizError('会员不存在', 404);
  if (member.status !== 'ACTIVE') throw new BizError('会员已停用，不可开单');
  // 销售/教练只能为本人建档的会员开单（防止抢单）
  if (operator && (operator.type === 'sales' || operator.type === 'coach') && member.creator_id && member.creator_id !== operator.id) {
    throw new BizError('该会员由其他销售/教练建档，无权开单');
  }

  const course = courseId ? db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) : null;
  if (courseId && !course) throw new BizError('课程不存在');
  const standardPrice = course ? course.standard_price : (singlePrice || 0);

  // 判断新客/续费
  const commissionType = determineCommissionType(memberId);
  const isNew = commissionType === COMMISSION_TYPES.NEW;

  return db.transaction(() => {
    let amount = 0;          // 实付
    let originalAmount = 0;  // 原价
    let giftValue = 0;       // 赠送价值
    let packId = null;       // 生成的课包 id（如有）
    let orderDetail = {};    // 订单详情
    let packInsert = null;   // 延迟创建课包的 SQL 和参数
    let extraPackInsert = null; // 额外赠送课包（跨业务类型）

    if (chargeMode === 'SESSION_PACK') {
      // 次卡模式
      let totalSessions = 0;
      let unitPrice = standardPrice;
      let extraGiftBusinessType = null;
      let extraGiftSessions = 0;
      let extraGiftCourseId = null;
      if (sessionPricingId) {
        const sp = db.prepare('SELECT * FROM course_session_pricing WHERE id = ? AND status = ?').get(sessionPricingId, 'ACTIVE');
        if (!sp) throw new BizError('次卡档位不存在');
        totalSessions = sp.sessions + sp.gift_sessions;
        amount = sp.price;
        originalAmount = sp.price;
        giftValue = sp.gift_sessions * standardPrice;
        giftSessions = sp.gift_sessions;
        sessions = sp.sessions;
        price = sp.price;
        unitPrice = standardPrice;
        // 额外赠送（跨业务类型）
        extraGiftBusinessType = sp.extra_gift_business_type || null;
        extraGiftSessions = sp.extra_gift_sessions || 0;
        if (extraGiftBusinessType && extraGiftSessions > 0) {
          const extraCourse = db.prepare("SELECT * FROM courses WHERE business_type = ? AND status = 'ACTIVE' ORDER BY created_at LIMIT 1").get(extraGiftBusinessType);
          extraGiftCourseId = extraCourse?.id || null;
          giftValue += extraGiftSessions * (extraCourse?.standard_price || 0);
        }
      } else {
        if (!sessions || price === undefined) throw new BizError('请选择次卡档位（或填写节数和价格）');
        totalSessions = sessions + (giftSessions || 0);
        amount = price;
        originalAmount = price;
        giftValue = (giftSessions || 0) * standardPrice;
      }
      // 折扣（取最优）
      const disc = calculateBestDiscount({ businessType, courseId, amount, isNew, db });
      amount = disc.finalAmount;
      orderDetail = { sessions, giftSessions: giftSessions || 0, totalSessions, price: amount, unitPrice, discount: disc, extraGiftBusinessType, extraGiftSessions };

      // 准备课包数据（延迟到订单创建后插入）
      const today = formatDate();
      const validUntil = addDays(today, DEFAULTS.SESSION_PACK_VALIDITY_DAYS);
      packId = uuid();
      packInsert = {
        sql: `INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, total_sessions, used_sessions, remaining_sessions, gift_sessions, unit_price, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'SESSION_PACK', ?, 0, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        params: [packId, memberId, '', courseId || null, businessType, totalSessions, totalSessions, giftSessions || 0, unitPrice, today, validUntil, now(), now()],
      };
      // 额外赠送课包（跨业务类型，如买私教送陪练）
      if (extraGiftBusinessType && extraGiftSessions > 0) {
        const extraPackId = uuid();
        const extraUnitPrice = db.prepare("SELECT standard_price FROM courses WHERE business_type = ? AND status = 'ACTIVE' ORDER BY created_at LIMIT 1").get(extraGiftBusinessType)?.standard_price || 0;
        extraPackInsert = {
          sql: `INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, total_sessions, used_sessions, remaining_sessions, gift_sessions, unit_price, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'SESSION_PACK', ?, 0, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          params: [extraPackId, memberId, '', extraGiftCourseId, extraGiftBusinessType, extraGiftSessions, extraGiftSessions, extraGiftSessions, extraUnitPrice, today, validUntil, now(), now()],
        };
      }

    } else if (chargeMode === 'MONTHLY') {
      // 月卡模式
      let quota = monthlyQuota;
      let fee = monthlyFee;
      let extraGiftBusinessType = null;
      let extraGiftSessions = 0;
      let extraGiftCourseId = null;
      if (monthlyPricingId) {
        const mp = db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ? AND status = ?').get(monthlyPricingId, 'ACTIVE');
        if (!mp) throw new BizError('月卡档位不存在');
        fee = mp.monthly_fee;
        quota = mp.monthly_quota;
        // 额外赠送（跨业务类型，生成次卡课包）
        extraGiftBusinessType = mp.extra_gift_business_type || null;
        extraGiftSessions = mp.extra_gift_sessions || 0;
        if (extraGiftBusinessType && extraGiftSessions > 0) {
          const extraCourse = db.prepare("SELECT * FROM courses WHERE business_type = ? AND status = 'ACTIVE' ORDER BY created_at LIMIT 1").get(extraGiftBusinessType);
          extraGiftCourseId = extraCourse?.id || null;
          giftValue += extraGiftSessions * (extraCourse?.standard_price || 0);
        }
      }
      if (!fee || !quota) throw new BizError('月费和月额度必填');
      amount = fee;
      originalAmount = fee;
      const today = formatDate();
      const validUntil = addMonths(today, 1);
      const month = currentMonth();
      orderDetail = { monthlyFee: fee, monthlyQuota: quota, validFrom: today, validUntil, month, extraGiftBusinessType, extraGiftSessions };

      const disc = calculateBestDiscount({ businessType, courseId, amount, isNew, db });
      amount = disc.finalAmount;

      packId = uuid();
      packInsert = {
        sql: `INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, monthly_quota, monthly_used, monthly_remaining, monthly_period, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'MONTHLY', ?, 0, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        params: [packId, memberId, '', courseId || null, businessType, quota, quota, month, today, validUntil, now(), now()],
      };
      // 额外赠送课包（跨业务类型，以次卡形式发放）
      if (extraGiftBusinessType && extraGiftSessions > 0) {
        const extraPackId = uuid();
        const extraUnitPrice = db.prepare("SELECT standard_price FROM courses WHERE business_type = ? AND status = 'ACTIVE' ORDER BY created_at LIMIT 1").get(extraGiftBusinessType)?.standard_price || 0;
        const extraValidUntil = addDays(today, DEFAULTS.SESSION_PACK_VALIDITY_DAYS);
        extraPackInsert = {
          sql: `INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, total_sessions, used_sessions, remaining_sessions, gift_sessions, unit_price, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'SESSION_PACK', ?, 0, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          params: [extraPackId, memberId, '', extraGiftCourseId, extraGiftBusinessType, extraGiftSessions, extraGiftSessions, extraGiftSessions, extraUnitPrice, today, extraValidUntil, now(), now()],
        };
      }

    } else if (chargeMode === 'SINGLE') {
      // 群活动单次付费
      amount = singlePrice || standardPrice;
      originalAmount = amount;
      orderDetail = { singlePrice: amount };
    } else {
      throw new BizError('不支持的收费模式');
    }

    // 计算提成
    const commissionRate = getCommissionRate(businessType, commissionType);
    const commissionAmount = Math.round(amount * commissionRate / 100);

    // 创建订单
    const orderId = uuid();
    const orderNo = generateOrderNo();
    db.prepare(`INSERT INTO orders (id, order_no, member_id, sales_id, sales_type, sales_name, business_type, course_id, charge_mode, amount, original_amount, discount_amount, gift_value, commission_type, commission_rate, commission_amount, status, note, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?)`)
      .run(orderId, orderNo, memberId, operator?.id || null, operator?.type || null, operator?.name || null,
        businessType, courseId || null, chargeMode, amount, originalAmount, originalAmount - amount, giftValue,
        commissionType, commissionRate, commissionAmount, data.note || null, now(), now());

    // 创建课包（订单创建后，回填 order_id）
    if (packInsert) {
      packInsert.params[2] = orderId; // 替换 order_id
      db.prepare(packInsert.sql).run(...packInsert.params);
    }
    // 创建额外赠送课包（跨业务类型）
    if (extraPackInsert) {
      extraPackInsert.params[2] = orderId;
      db.prepare(extraPackInsert.sql).run(...extraPackInsert.params);
    }

    // 记录提成（改为课后计提，开单时不再记录销售提成，仅保留预估值在订单上）
    // 销售提成在出勤时按节计提，见 attendance.js

    // 自动累积会员分类标签（MEM-009）
    autoAddTagOnPurchase(memberId, businessType, operator);

    writeAudit({ entity: 'order', entityId: orderId, action: AUDIT_ACTIONS.CREATE, operator, detail: { ...orderDetail, chargeMode, businessType, amount, commissionAmount } });

    return {
      orderId, orderNo, amount, originalAmount, commissionAmount, commissionRate, commissionType,
      salesId: operator?.id || null, salesType: operator?.type || null, salesName: operator?.name || null,
      packId, detail: orderDetail,
    };
  })();
}

// ============ 退款 ============
export function refundOrder(orderId, operator, reason) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new BizError('订单不存在', 404);
  if (order.status === ORDER_STATUS.REFUNDED) throw new BizError('订单已退款');

  return db.transaction(() => {
    let refundAmount = 0;

    // 获取该订单关联的所有课包（主课包 + 附加赠送课包）
    const allPacks = db.prepare('SELECT * FROM packs WHERE order_id = ?').all(orderId);

    if (order.charge_mode === 'SESSION_PACK') {
      // 次卡退款：退款金额 = 缴费金额 - 已消课节数 × 单次原价 - 附加赠送课已消课节数 × 对应课程单次原价
      const mainPack = allPacks.find((p) => p.business_type === order.business_type && p.pack_type === 'SESSION_PACK');
      const extraPacks = allPacks.filter((p) => p.business_type !== order.business_type);

      // 主课包已消课价值
      let mainConsumedValue = 0;
      if (mainPack && mainPack.status !== PACK_STATUS.REFUNDED) {
        mainConsumedValue = mainPack.used_sessions * mainPack.unit_price;
        db.prepare('UPDATE packs SET status = ? WHERE id = ?').run(PACK_STATUS.REFUNDED, mainPack.id);
      }

      // 附加赠送课：已消课部分扣减价值，未消课部分从会员卡包删除（标记REFUNDED）
      let extraConsumedValue = 0;
      for (const ep of extraPacks) {
        if (ep.status === PACK_STATUS.REFUNDED) continue;
        if (ep.used_sessions > 0) {
          extraConsumedValue += ep.used_sessions * ep.unit_price;
        }
        db.prepare('UPDATE packs SET status = ? WHERE id = ?').run(PACK_STATUS.REFUNDED, ep.id);
      }

      refundAmount = Math.max(0, order.amount - mainConsumedValue - extraConsumedValue);

    } else if (order.charge_mode === 'MONTHLY') {
      // 月卡退款：退款金额 = 缴费金额 - 已消课节数 × 单次原价 - 附加赠送课已消课节数 × 对应课程单次原价
      const mainPack = allPacks.find((p) => p.business_type === order.business_type && p.pack_type === 'MONTHLY');
      const extraPacks = allPacks.filter((p) => p.business_type !== order.business_type);

      // 月卡单次原价 = 缴费金额 / 月额度
      let mainConsumedValue = 0;
      if (mainPack && mainPack.status !== PACK_STATUS.REFUNDED) {
        const unitPrice = mainPack.monthly_quota > 0 ? Math.round(order.amount / mainPack.monthly_quota) : 0;
        mainConsumedValue = mainPack.monthly_used * unitPrice;
        db.prepare('UPDATE packs SET status = ? WHERE id = ?').run(PACK_STATUS.REFUNDED, mainPack.id);
      }

      // 附加赠送课
      let extraConsumedValue = 0;
      for (const ep of extraPacks) {
        if (ep.status === PACK_STATUS.REFUNDED) continue;
        if (ep.used_sessions > 0) {
          extraConsumedValue += ep.used_sessions * ep.unit_price;
        }
        db.prepare('UPDATE packs SET status = ? WHERE id = ?').run(PACK_STATUS.REFUNDED, ep.id);
      }

      refundAmount = Math.max(0, order.amount - mainConsumedValue - extraConsumedValue);

    } else if (order.charge_mode === 'SINGLE') {
      refundAmount = order.amount;
    }

    // 更新订单
    db.prepare('UPDATE orders SET status = ?, refund_amount = ?, updated_at = ? WHERE id = ?')
      .run(ORDER_STATUS.REFUNDED, refundAmount, now(), orderId);

    // 回滚提成（退费不分成：回滚该订单所有已计提的销售提成）
    db.prepare("UPDATE commission_records SET status = 'REVERSED' WHERE order_id = ?").run(orderId);

    // 回滚教练课时费/分成（退款后不再计入教练收入）
    // 通过该订单课包关联的出勤记录，将课时费和分成置零
    const packIds = allPacks.map((p) => p.id).filter(Boolean);
    if (packIds.length > 0) {
      const placeholders = packIds.map(() => '?').join(',');
      db.prepare(`UPDATE attendance SET lesson_fee = 0, share_amount = 0, note = COALESCE(note, '') || ' [已退款]', updated_at = ? WHERE pack_id IN (${placeholders}) AND status = 'PRESENT'`)
        .run(now(), ...packIds);
    }

    writeAudit({ entity: 'order', entityId: orderId, action: AUDIT_ACTIONS.REFUND, operator, detail: { refundAmount, reason } });

    return { refundAmount, orderId };
  })();
}

// ============ 订单列表 ============
export function listOrders(query, user) {
  const db = getDb();
  const where = [`o.status != 'DELETED'`];
  const params = [];
  if (query.memberId) { where.push('o.member_id = ?'); params.push(query.memberId); }
  if (query.salesId) { where.push('o.sales_id = ?'); params.push(query.salesId); }
  if (query.businessType) { where.push('o.business_type = ?'); params.push(query.businessType); }
  if (query.status) { where.push('o.status = ?'); params.push(query.status); }
  if (query.startDate) { where.push('o.created_at >= ?'); params.push(query.startDate); }
  if (query.endDate) { where.push('o.created_at <= ?'); params.push(query.endDate + ' 23:59:59'); }
  if (query.keyword) {
    where.push('(o.order_no LIKE ? OR m.name LIKE ?)');
    params.push(`%${query.keyword}%`, `%${query.keyword}%`);
  }
  // 销售/教练只看本人开单
  if (user.role === 'sales' || user.role === 'coach') {
    where.push('o.sales_id = ?');
    params.push(user.id);
  }
  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM orders o WHERE ${whereSql}`).get(...params).cnt;
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
  const list = db.prepare(`
    SELECT o.*, c.name as course_name, m.name as member_name
    FROM orders o 
    LEFT JOIN courses c ON o.course_id = c.id
    LEFT JOIN members m ON o.member_id = m.id
    WHERE ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  return { list, total, page, pageSize };
}

export function getOrderDetail(orderId) {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, c.name as course_name, m.name as member_name
    FROM orders o 
    LEFT JOIN courses c ON o.course_id = c.id
    LEFT JOIN members m ON o.member_id = m.id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) throw new BizError('订单不存在', 404);
  order.packs = db.prepare('SELECT * FROM packs WHERE order_id = ?').all(orderId);
  order.commissions = db.prepare('SELECT * FROM commission_records WHERE order_id = ?').all(orderId);
  return order;
}
