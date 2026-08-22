// 单元测试：订单服务（三种收费模式 + 提成 + 退款）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder, refundOrder, determineCommissionType, calculateBestDiscount } from '../../src/services/order.js';
import { COMMISSION_TYPES } from '../../../shared/constants.js';
import { getDb } from '../../src/db/index.js';

const operator = { id: 'test-admin', type: 'admin', name: '管理员' };

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

function getCourse(businessType = 'PRIVATE') {
  const db = getDb();
  return db.prepare('SELECT * FROM courses WHERE business_type = ?').get(businessType);
}

function getSessionPricing(courseId) {
  const db = getDb();
  return db.prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ?').get(courseId, 'ACTIVE');
}

function getMonthlyPricing(courseId) {
  const db = getDb();
  return db.prepare('SELECT * FROM course_monthly_pricing WHERE course_id = ? AND status = ?').get(courseId, 'ACTIVE');
}

describe('次卡开单', () => {
  it('应正确生成次卡课包', () => {
    const member = createMember({ name: '次卡测试', phone: '13900002001', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id,
      courseId: course.id,
      businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK',
      sessionPricingId: sp.id,
      confirmed: true,
    }, operator);

    expect(order.amount).toBe(sp.price);
    expect(order.packId).toBeTruthy();

    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    expect(pack.total_sessions).toBe(sp.sessions + sp.gift_sessions);
    expect(pack.remaining_sessions).toBe(sp.sessions + sp.gift_sessions);
    expect(pack.gift_sessions).toBe(sp.gift_sessions);
    expect(pack.unit_price).toBe(course.standard_price);
    expect(pack.status).toBe('ACTIVE');
  });

  it('新客首单应标记为 NEW', () => {
    const member = createMember({ name: '新客测试', phone: '13900002002', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    expect(order.commissionType).toBe(COMMISSION_TYPES.NEW);
  });

  it('续费应标记为 RENEW', () => {
    const member = createMember({ name: '续费测试', phone: '13900002003', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    // 首单
    createOrder({ memberId: member.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    // 二单
    const order2 = createOrder({ memberId: member.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);

    expect(order2.commissionType).toBe(COMMISSION_TYPES.RENEW);
  });

  it('提成金额计算正确', () => {
    const member = createMember({ name: '提成测试', phone: '13900002004', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    // 默认提成 10%
    expect(order.commissionAmount).toBe(Math.round(order.amount * 0.1));
  });
});

describe('预存赠送开单', () => {
  it('应正确入账预存账户（本金+赠送）', () => {
    const member = createMember({ name: '预存测试', phone: '13900002005', categoryCode: 'M_PRIVATE' }, operator);

    const order = createOrder({
      memberId: member.id,
      businessType: 'PRIVATE',
      chargeMode: 'PREPAID',
      depositAmount: 5000,
      confirmed: true,
    }, operator);

    expect(order.amount).toBe(5000);

    const db = getDb();
    const account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(member.id);
    // 预存 5000 赠 2000（种子数据）
    expect(account.principal_balance).toBe(5000);
    expect(account.gift_balance).toBe(2000);
    expect(account.total_balance).toBe(7000);
  });

  it('多次预存应累加', () => {
    const member = createMember({ name: '多次预存', phone: '13900002006', categoryCode: 'M_PRIVATE' }, operator);

    createOrder({ memberId: member.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 3000, confirmed: true }, operator);
    createOrder({ memberId: member.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true }, operator);

    const db = getDb();
    const account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(member.id);
    expect(account.principal_balance).toBe(8000);
    expect(account.gift_balance).toBe(3000); // 1000 + 2000
  });
});

describe('月卡开单', () => {
  it('应正确生成月卡课包', () => {
    const member = createMember({ name: '月卡测试', phone: '13900002007', categoryCode: 'M_ADULT_GROUP' }, operator);
    const course = getCourse('ADULT_GROUP');
    const mp = getMonthlyPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'ADULT_GROUP',
      chargeMode: 'MONTHLY', monthlyPricingId: mp.id, confirmed: true,
    }, operator);

    expect(order.amount).toBe(mp.monthly_fee);
    expect(order.packId).toBeTruthy();

    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    expect(pack.pack_type).toBe('MONTHLY');
    expect(pack.monthly_quota).toBe(mp.monthly_quota);
    expect(pack.monthly_remaining).toBe(mp.monthly_quota);
  });
});

describe('退款', () => {
  it('次卡退款：剩余节数 × 单次原价（赠送不退）', () => {
    const member = createMember({ name: '退款测试', phone: '13900002008', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const result = refundOrder(order.orderId, operator, '测试退款');
    // 次卡未使用，剩余节数 = 总节数 - 赠送节数 = sessions
    // 退费 = sessions × unit_price
    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE order_id = ?').get(order.orderId);
    const expectedRefund = (pack.total_sessions - pack.gift_sessions) * pack.unit_price;
    expect(result.refundAmount).toBe(expectedRefund);

    // 课包应标记为 REFUNDED
    const updatedPack = db.prepare('SELECT * FROM packs WHERE id = ?').get(pack.id);
    expect(updatedPack.status).toBe('REFUNDED');
  });

  it('预存退款：按剩余本金退还', () => {
    const member = createMember({ name: '预存退款', phone: '13900002009', categoryCode: 'M_PRIVATE' }, operator);
    const order = createOrder({
      memberId: member.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true,
    }, operator);

    const result = refundOrder(order.orderId, operator, '预存退款');
    expect(result.refundAmount).toBe(5000); // 本金全额退

    const db = getDb();
    const account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(member.id);
    expect(account.principal_balance).toBe(0);
    // 赠送余额不退
    expect(account.gift_balance).toBe(2000);
  });

  it('退款后提成应回滚', () => {
    const member = createMember({ name: '提成回滚', phone: '13900002010', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);
    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    refundOrder(order.orderId, operator, '提成回滚测试');
    const db = getDb();
    const commission = db.prepare('SELECT * FROM commission_records WHERE order_id = ?').get(order.orderId);
    expect(commission.status).toBe('REVERSED');
  });
});

describe('折扣计算（Q-09：不叠加，取最优）', () => {
  it('应取最优折扣', () => {
    const db = getDb();
    // 添加两个折扣规则
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, discount_type, discount_value, target, status, created_at, updated_at) VALUES (?, '9折', 'PRIVATE', 'RATE', 10, 'ALL', 'ACTIVE', datetime('now'), datetime('now'))`).run('test-disc-1');
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, discount_type, discount_value, target, status, created_at, updated_at) VALUES (?, '8折', 'PRIVATE', 'RATE', 20, 'ALL', 'ACTIVE', datetime('now'), datetime('now'))`).run('test-disc-2');

    const result = calculateBestDiscount({ businessType: 'PRIVATE', courseId: null, amount: 1000, isNew: false, db });
    // 8折更优
    expect(result.finalAmount).toBe(800);
    expect(result.appliedRule.name).toBe('8折');
  });
});
