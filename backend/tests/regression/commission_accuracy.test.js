// 回归测试：销售提成计算准确性
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder, refundOrder } from '../../src/services/order.js';
import { createSession } from '../../src/services/session.js';
import { submitAttendance } from '../../src/services/attendance.js';
import { getDb } from '../../src/db/index.js';

const salesOperator = { id: 'test-sales-1', type: 'sales', name: '测试销售' };

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

function getCourse(businessType = 'PRIVATE') {
  return getDb().prepare('SELECT * FROM courses WHERE business_type = ?').get(businessType);
}

function getCoach() {
  return getDb().prepare('SELECT * FROM coaches LIMIT 1').get();
}

function getSessionPricing(courseId) {
  return getDb().prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ?').get(courseId, 'ACTIVE');
}

function getCommissionRule(businessType, commissionType) {
  return getDb().prepare('SELECT * FROM commission_rules WHERE business_type = ? AND commission_type = ? AND status = ?').get(businessType, commissionType, 'ACTIVE');
}

function getActiveCommissionRecords(orderId) {
  return getDb().prepare('SELECT * FROM commission_records WHERE order_id = ? AND status = ?').all(orderId, 'ACTIVE');
}

// REG-COM-001: 开单时不应创建提成记录（课后计提）
describe('REG-COM-001: 开单时不应创建提成记录', () => {
  it('开单后 commission_records 表不应有该订单的记录', () => {
    const member = createMember({ name: '提成测试1', phone: '13900006001', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const records = getDb().prepare('SELECT * FROM commission_records WHERE order_id = ?').all(order.orderId);
    expect(records.length).toBe(0);
  });

  it('但订单上应保存预估提成率和预估提成金额', () => {
    const member = createMember({ name: '提成测试2', phone: '13900006002', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const dbOrder = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(order.orderId);
    const rule = getCommissionRule('PRIVATE', 'NEW');
    expect(dbOrder.commission_rate).toBe(rule.rate);
    expect(dbOrder.commission_amount).toBe(Math.round(dbOrder.amount * rule.rate / 100));
  });
});

// REG-COM-002: 提成率必须从规则表读取
describe('REG-COM-002: 提成率从规则表读取', () => {
  it('PRIVATE 新客提成率应为规则表中的值（非硬编码10%）', () => {
    const member = createMember({ name: '提成率新客', phone: '13900006003', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const dbOrder = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(order.orderId);
    const rule = getCommissionRule('PRIVATE', 'NEW');
    expect(dbOrder.commission_rate).toBe(rule.rate);
    // 确保不是硬编码的 10
    if (rule.rate !== 10) {
      expect(dbOrder.commission_rate).not.toBe(10);
    }
  });

  it('PRIVATE 续费提成率应与规则表一致', () => {
    // 先创建一个会员并开单（使其成为老客）
    const member = createMember({ name: '续费测试', phone: '13900006004', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    // 第一单（新客）
    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    // 第二单（续费）
    const order2 = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const dbOrder = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(order2.orderId);
    const rule = getCommissionRule('PRIVATE', 'RENEW');
    expect(dbOrder.commission_type).toBe('RENEW');
    expect(dbOrder.commission_rate).toBe(rule.rate);
  });
});

// REG-COM-003: 课后计提金额 = 预估总提成 / 总节数
describe('REG-COM-003: 按节计提金额正确', () => {
  it('每节提成 = 订单预估总提成 / 课包总节数', () => {
    const member = createMember({ name: '按节计提', phone: '13900006005', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const pack = getDb().prepare('SELECT * FROM packs WHERE order_id = ?').get(order.orderId);
    const dbOrder = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(order.orderId);
    const nonGiftSessions = pack.total_sessions - (pack.gift_sessions || 0);
    const expectedPerSession = Math.round(dbOrder.commission_amount / nonGiftSessions);

    // 上一节课
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-12-10',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, salesOperator);
    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);

    const records = getActiveCommissionRecords(order.orderId);
    expect(records.length).toBe(1);
    expect(records[0].amount).toBe(expectedPerSession);
    expect(records[0].session_id).toBe(session.id);
  });

  it('全部消课后总提成应等于预估总提成', () => {
    const member = createMember({ name: '全消课提成', phone: '13900006006', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const pack = getDb().prepare('SELECT * FROM packs WHERE order_id = ?').get(order.orderId);
    const dbOrder = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(order.orderId);

    // 上完全部课
    const coach = getCoach();
    for (let i = 0; i < pack.total_sessions; i++) {
      const session = createSession({
        courseId: course.id, coachId: coach.id, date: `2026-12-${String(10 + i).padStart(2, '0')}`,
        startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
      }, salesOperator);
      submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);
    }

    const records = getActiveCommissionRecords(order.orderId);
    const totalActual = records.reduce((s, r) => s + r.amount, 0);
    // 总计提应等于预估提成（允许 1 元舍入误差 × 节数）
    const tolerance = pack.total_sessions;
    expect(Math.abs(totalActual - dbOrder.commission_amount)).toBeLessThanOrEqual(tolerance);
  });
});

// REG-COM-004: 退款时回滚提成
describe('REG-COM-004: 退款回滚提成', () => {
  it('退款后所有提成记录应标记为 REVERSED', () => {
    const member = createMember({ name: '退款回滚', phone: '13900006007', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    // 上课产生提成
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-12-10',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, salesOperator);
    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);

    // 确认有 ACTIVE 提成
    expect(getActiveCommissionRecords(order.orderId).length).toBe(1);

    // 退款
    refundOrder(order.orderId, salesOperator, '测试退款');

    // 所有提成应 REVERSED
    const activeRecords = getActiveCommissionRecords(order.orderId);
    expect(activeRecords.length).toBe(0);
  });
});

// REG-COM-005: 赠送课时不应计提销售提成（默认）
describe('REG-COM-005: 赠送课时提成处理', () => {
  it('赠送课时不产生销售提成记录', () => {
    const member = createMember({ name: '赠送课时', phone: '13900006008', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    const pack = getDb().prepare('SELECT * FROM packs WHERE order_id = ?').get(order.orderId);
    // 先消费完非赠送课时
    const coach = getCoach();
    for (let i = 0; i < pack.total_sessions - pack.gift_sessions; i++) {
      const session = createSession({
        courseId: course.id, coachId: coach.id, date: `2026-11-${String(10 + i).padStart(2, '0')}`,
        startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
      }, salesOperator);
      submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);
    }

    // 消费赠送课时
    const giftSession = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-11-20',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, salesOperator);
    submitAttendance(giftSession.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);

    // 赠送课时不应产生提成记录
    const records = getActiveCommissionRecords(order.orderId);
    const nonGiftCount = pack.total_sessions - pack.gift_sessions;
    expect(records.length).toBeLessThanOrEqual(nonGiftCount);
  });
});

// REG-COM-006: /sales/performance 返回字段正确
describe('REG-COM-006: 业绩接口字段完整性', () => {
  it('performance 接口应返回 estimatedCommission 和 actualCommission', async () => {
    const { app } = await import('../../src/app.js');
    const { default: request } = await import('supertest');
    const member = createMember({ name: '接口字段', phone: '13900006009', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    // 用销售 token 调接口
    const loginRes = await request(app).post('/api/auth/sales/login').send({ phone: '13800000001', password: '123456' });
    const token = loginRes.body.data.token;

    const res = await request(app).get('/api/sales/performance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    const summary = res.body.data.summary;
    expect(summary).toHaveProperty('estimatedCommission');
    expect(summary).toHaveProperty('actualCommission');
    expect(summary).toHaveProperty('totalCommission');
    expect(summary.totalCommission).toBe(summary.actualCommission);
  });
});
