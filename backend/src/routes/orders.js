// 订单路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, verifyPassword } from '../utils/helpers.js';
import { operatorFromReq } from '../services/audit.js';
import { createOrder, refundOrder, listOrders, getOrderDetail } from '../services/order.js';
import { DEFAULTS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 开单（管理员/销售/教练）
router.post('/', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    if (req.user.role === 'coach' && !req.user.salesEnabled) throw new BizError('未开启销售能力', 403);
    // 大额订单二次确认（SAL-010）
    // 优先取请求体直接传入的金额，次卡模式需查定价表
    let amount = req.body.depositAmount || req.body.price || req.body.monthlyFee || req.body.singlePrice || 0;
    if (!amount && req.body.chargeMode === 'SESSION_PACK' && req.body.sessionPricingId) {
      const sp = getDb().prepare('SELECT price FROM course_session_pricing WHERE id = ?').get(req.body.sessionPricingId);
      if (sp) amount = sp.price;
    }
    if (!amount && req.body.chargeMode === 'MONTHLY' && req.body.monthlyPricingId) {
      const mp = getDb().prepare('SELECT monthly_fee FROM course_monthly_pricing WHERE id = ?').get(req.body.monthlyPricingId);
      if (mp) amount = mp.monthly_fee;
    }
    if (amount >= DEFAULTS.LARGE_ORDER_THRESHOLD && !req.body.confirmed) {
      return res.status(200).json({ code: 0, data: { needConfirm: true, amount }, message: '大额订单需二次确认' });
    }
    const order = createOrder(req.body, operatorFromReq(req));
    res.status(201).json(success(order, '开单成功'));
  } catch (e) { next(e); }
});

// 订单列表
router.get('/', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const result = listOrders(req.query, req.user);
    res.json(success(result));
  } catch (e) { next(e); }
});

// 订单详情
router.get('/:id', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const order = getOrderDetail(req.params.id);
    // 会员只能看本人订单
    if (req.user.role === 'member' && order.member_id !== req.user.memberId) throw new BizError('无权查看', 403);
    // 销售/教练只能看本人开单
    if ((req.user.role === 'sales' || req.user.role === 'coach') && order.sales_id !== req.user.id) throw new BizError('无权查看', 403);
    res.json(success(order));
  } catch (e) { next(e); }
});

// 退款（仅管理员，需二次密码验证）
router.post('/:id/refund', authRole(['admin']), (req, res, next) => {
  try {
    const { reason, adminPassword } = req.body || {};
    if (!adminPassword) throw new BizError('请输入管理员密码');
    // 二次密码校验
    const db = getDb();
    const admin = db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(req.user.id);
    if (!admin || !verifyPassword(adminPassword, admin.password_hash)) {
      throw new BizError('管理员密码错误');
    }
    const result = refundOrder(req.params.id, operatorFromReq(req), reason);
    res.json(success(result, '退款成功'));
  } catch (e) { next(e); }
});

export default router;
