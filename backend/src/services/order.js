// 订单服务：购课开单（三种收费模式）+ 提成计算 + 退款
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
export function calculateBestDiscount({ businessType, courseId, amount, isNew, db }) {
  const today = formatDate();
  const rules = db.prepare(`
    SELECT * FROM discount_rules 
    WHERE status = 'ACTIVE' 
      AND (business_type = ? OR business_type IS NULL)
      AND (course_id = ? OR course_id IS NULL)
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
      AND (target = 'ALL' OR target = ?)
  `).all(businessType, courseId, today, today, isNew ? 'NEW' : 'ALL');

  let bestAmount = amount;
  let bestRule = null;
  for (const r of rules) {
    let discounted = amount;
    if (r.discount_type === 'RATE') {
      discounted = Math.round(amount * (100 - r.discount_value) / 100);
    } else if (r.discount_type === 'FIXED') {
      discounted = r.discount_value;
    }
    if (discounted < bestAmount) {
      bestAmount = discounted;
      bestRule = r;
    }
  }
  return { finalAmount: bestAmount, discountAmount: amount - bestAmount, appliedRule: bestRule };
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
    // 预存模式
    depositAmount,
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

    if (chargeMode === 'PREPAID') {
      // 预存赠送模式
      if (!depositAmount || depositAmount <= 0) throw new BizError('预存金额必填');
      const rule = db.prepare('SELECT * FROM prepaid_rules WHERE deposit_amount = ? AND status = ?').get(depositAmount, 'ACTIVE');
      const giftAmount = rule ? rule.gift_amount : 0;
      amount = depositAmount;
      originalAmount = depositAmount;
      giftValue = giftAmount;
      orderDetail = { depositAmount, giftAmount, totalBalance: depositAmount + giftAmount };

    } else if (chargeMode === 'SESSION_PACK') {
      // 次卡模式
      let totalSessions = 0;
      let unitPrice = standardPrice;
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
      } else {
        if (!sessions || price === undefined) throw new BizError('节数和价格必填');
        totalSessions = sessions + (giftSessions || 0);
        amount = price;
        originalAmount = price;
        giftValue = (giftSessions || 0) * standardPrice;
      }
      // 折扣（取最优）
      const disc = calculateBestDiscount({ businessType, courseId, amount, isNew, db });
      amount = disc.finalAmount;
      orderDetail = { sessions, giftSessions: giftSessions || 0, totalSessions, price: amount, unitPrice, discount: disc };

      // 准备课包数据（延迟到订单创建后插入）
      const today = formatDate();
      const validUntil = addDays(today, DEFAULTS.SESSION_PACK_VALIDITY_DAYS);
      packId = uuid();
      packInsert = {
        sql: `INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, total_sessions, used_sessions, remaining_sessions, gift_sessions, unit_price, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'SESSION_PACK', ?, 0, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        params: [packId, memberId, '', courseId || null, businessType, totalSessions, totalSessions, giftSessions || 0, unitPrice, today, validUntil, now(), now()],
      };

    } else if (chargeMode === 'MONTHLY') {
      // 月卡模式
      let quota = monthlyQuota;
      let fee = monthlyFee;
      if (monthlyPricingId) {
        const mp = db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ? AND status = ?').get(monthlyPricingId, 'ACTIVE');
        if (!mp) throw new BizError('月卡档位不存在');
        fee = mp.monthly_fee;
        quota = mp.monthly_quota;
      }
      if (!fee || !quota) throw new BizError('月费和月额度必填');
      amount = fee;
      originalAmount = fee;
      const today = formatDate();
      const validUntil = addMonths(today, 1);
      const month = currentMonth();
      orderDetail = { monthlyFee: fee, monthlyQuota: quota, validFrom: today, validUntil, month };

      const disc = calculateBestDiscount({ businessType, courseId, amount, isNew, db });
      amount = disc.finalAmount;

      packId = uuid();
      packInsert = {
        sql: `INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, monthly_quota, monthly_used, monthly_remaining, monthly_period, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'MONTHLY', ?, 0, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        params: [packId, memberId, '', courseId || null, businessType, quota, quota, month, today, validUntil, now(), now()],
      };

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

    // 预存模式：入账预存账户（订单创建后）
    if (chargeMode === 'PREPAID') {
      let account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(memberId);
      if (!account) {
        account = { id: uuid(), member_id: memberId, principal_balance: 0, gift_balance: 0, total_balance: 0 };
        db.prepare(`INSERT INTO prepaid_accounts (id, member_id, principal_balance, gift_balance, total_balance) VALUES (?, ?, 0, 0, 0)`)
          .run(account.id, memberId);
      }
      const newPrincipal = account.principal_balance + depositAmount;
      const newGift = account.gift_balance + giftValue;
      const newTotal = newPrincipal + newGift;
      db.prepare('UPDATE prepaid_accounts SET principal_balance = ?, gift_balance = ?, total_balance = ?, updated_at = ? WHERE id = ?')
        .run(newPrincipal, newGift, newTotal, now(), account.id);
      db.prepare(`INSERT INTO prepaid_transactions (id, account_id, member_id, order_id, type, principal_delta, gift_delta, amount, balance_after, created_at) VALUES (?, ?, ?, ?, 'DEPOSIT', ?, ?, ?, ?, ?)`)
        .run(uuid(), account.id, memberId, orderId, depositAmount, giftValue, depositAmount + giftValue, newTotal, now());
    }

    // 创建课包（订单创建后，回填 order_id）
    if (packInsert) {
      packInsert.params[2] = orderId; // 替换 order_id
      db.prepare(packInsert.sql).run(...packInsert.params);
    }

    // 记录提成
    if (commissionAmount > 0 && operator) {
      db.prepare(`INSERT INTO commission_records (id, order_id, beneficiary_id, beneficiary_type, beneficiary_name, commission_type, business_type, rate, amount, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`)
        .run(uuid(), orderId, operator.id, operator.type, operator.name, commissionType, businessType, commissionRate, commissionAmount, now());
    }

    // 自动累积会员分类标签（MEM-009）
    autoAddTagOnPurchase(memberId, businessType, operator);

    writeAudit({ entity: 'order', entityId: orderId, action: AUDIT_ACTIONS.CREATE, operator, detail: { ...orderDetail, chargeMode, businessType, amount, commissionAmount } });

    return {
      orderId, orderNo, amount, originalAmount, commissionAmount, commissionRate, commissionType,
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

    if (order.charge_mode === 'SESSION_PACK') {
      // 次卡：剩余节数 × 单次原价
      const pack = db.prepare('SELECT * FROM packs WHERE order_id = ?').get(orderId);
      if (pack && pack.status !== PACK_STATUS.REFUNDED) {
        const remaining = pack.remaining_sessions;
        // 退费不含赠送节数：剩余节数中先扣赠送
        const refundableSessions = Math.max(0, remaining - pack.gift_sessions);
        refundAmount = refundableSessions * pack.unit_price;
        db.prepare('UPDATE packs SET status = ? WHERE id = ?').run(PACK_STATUS.REFUNDED, pack.id);
      }
    } else if (order.charge_mode === 'PREPAID') {
      // 预存：按剩余本金退还
      const account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(order.member_id);
      if (account) {
        refundAmount = Math.min(account.principal_balance, order.amount);
        const newPrincipal = account.principal_balance - refundAmount;
        const newTotal = newPrincipal + account.gift_balance;
        db.prepare('UPDATE prepaid_accounts SET principal_balance = ?, total_balance = ?, updated_at = ? WHERE id = ?')
          .run(newPrincipal, newTotal, now(), account.id);
        db.prepare(`INSERT INTO prepaid_transactions (id, account_id, member_id, type, principal_delta, gift_delta, amount, balance_after, created_at) VALUES (?, ?, ?, 'REFUND', ?, 0, ?, ?, ?)`)
          .run(uuid(), account.id, order.member_id, -refundAmount, -refundAmount, newTotal, now());
      }
    } else if (order.charge_mode === 'MONTHLY') {
      // 月卡：按剩余额度比例退
      const pack = db.prepare('SELECT * FROM packs WHERE order_id = ?').get(orderId);
      if (pack && pack.status !== PACK_STATUS.REFUNDED) {
        const remainingRatio = pack.monthly_quota > 0 ? pack.monthly_remaining / pack.monthly_quota : 0;
        refundAmount = Math.round(order.amount * remainingRatio);
        db.prepare('UPDATE packs SET status = ? WHERE id = ?').run(PACK_STATUS.REFUNDED, pack.id);
      }
    } else if (order.charge_mode === 'SINGLE') {
      refundAmount = order.amount;
    }

    // 更新订单
    db.prepare('UPDATE orders SET status = ?, refund_amount = ?, updated_at = ? WHERE id = ?')
      .run(ORDER_STATUS.REFUNDED, refundAmount, now(), orderId);

    // 回滚提成
    db.prepare("UPDATE commission_records SET status = 'REVERSED' WHERE order_id = ?").run(orderId);

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
