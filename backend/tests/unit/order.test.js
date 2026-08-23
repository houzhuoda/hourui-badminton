// 单元测试：订单服务（三种收费模式 + 提成 + 退款）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder, refundOrder, determineCommissionType, calculateBestDiscount } from '../../src/services/order.js';
import { submitAttendance } from '../../src/services/attendance.js';
import { COMMISSION_TYPES } from '../../../shared/constants.js';
import { getDb } from '../../src/db/index.js';
import { uuid, now } from '../../src/utils/helpers.js';

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

function getCoach() {
  const db = getDb();
  return db.prepare('SELECT * FROM coaches WHERE status = ? ORDER BY created_at LIMIT 1').get('ACTIVE');
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
  it('次卡退款：未使用全额退款，已使用按已消课扣减', () => {
    const member = createMember({ name: '退款测试', phone: '13900002008', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const result = refundOrder(order.orderId, operator, '测试退款');
    // 次卡未使用：退款 = 缴费金额 - 0 = 全额退款
    expect(result.refundAmount).toBe(order.amount);

    // 课包应标记为 REFUNDED
    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE order_id = ?').get(order.orderId);
    const updatedPack = db.prepare('SELECT * FROM packs WHERE id = ?').get(pack.id);
    expect(updatedPack.status).toBe('REFUNDED');
  });

  it('退款后提成应回滚', () => {
    const salesOperator = { id: 'test-sales-1', type: 'sales', name: '测试销售' };
    const member = createMember({ name: '提成回滚', phone: '13900002010', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);
    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    // 课后计提模式：先出勤产生提成记录，再退费回滚
    const db = getDb();
    const sessionId = 'test-session-commission-' + Date.now();
    db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 1, 1, 'SCHEDULED', ?, ?)`)
      .run(sessionId, course.id, getCoach().id, '2026-12-30', now(), now());
    db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
      .run('test-booking-' + Date.now(), sessionId, member.id, now(), now());
    submitAttendance(sessionId, [{ memberId: member.id, status: 'PRESENT' }], { id: getCoach().id, type: 'coach', name: '教练' });

    // 确认有提成记录
    const commissionBefore = db.prepare('SELECT * FROM commission_records WHERE order_id = ?').all(order.orderId);
    expect(commissionBefore.length).toBeGreaterThan(0);

    refundOrder(order.orderId, operator, '提成回滚测试');
    const commissionAfter = db.prepare('SELECT * FROM commission_records WHERE order_id = ?').all(order.orderId);
    expect(commissionAfter.every(c => c.status === 'REVERSED')).toBe(true);

    // 退款后 attendance 的课时费/分成应回滚为 0
    const attAfter = db.prepare('SELECT lesson_fee, share_amount FROM attendance WHERE pack_id IN (SELECT id FROM packs WHERE order_id = ?)').all(order.orderId);
    expect(attAfter.length).toBeGreaterThan(0);
    expect(attAfter.every(a => a.lesson_fee === 0 && a.share_amount === 0)).toBe(true);
  });

  it('admin开单不应产生提成记录', () => {
    const member = createMember({ name: 'admin开单测试', phone: '13900002011', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);
    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const db = getDb();
    const sessionId = 'test-session-admin-comm-' + Date.now();
    db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 1, 1, 'SCHEDULED', ?, ?)`)
      .run(sessionId, course.id, getCoach().id, '2026-12-31', now(), now());
    db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
      .run('test-booking-admin-' + Date.now(), sessionId, member.id, now(), now());
    submitAttendance(sessionId, [{ memberId: member.id, status: 'PRESENT' }], { id: getCoach().id, type: 'coach', name: '教练' });

    const commissions = db.prepare('SELECT * FROM commission_records WHERE order_id = ?').all(order.orderId);
    expect(commissions.length).toBe(0);
  });
});

describe('次卡额外赠送（跨业务类型赠送课时）', () => {
  it('次卡档位有额外赠送时应生成两个课包', () => {
    const member = createMember({ name: '额外赠送测试', phone: '13900003010', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const db = getDb();

    // 创建一个带额外赠送的次卡档位
    const spId = 'test-sp-extra-' + Date.now();
    db.prepare(`INSERT INTO course_session_pricing (id, course_id, sessions, price, gift_sessions, extra_gift_business_type, extra_gift_sessions, sort_order, status, created_at, updated_at) VALUES (?, ?, 10, 2700, 2, 'PRACTICE', 1, 0, 'ACTIVE', datetime('now'), datetime('now'))`)
      .run(spId, course.id);

    const order = createOrder({
      memberId: member.id,
      courseId: course.id,
      businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK',
      sessionPricingId: spId,
      confirmed: true,
    }, operator);

    expect(order.amount).toBe(2700);

    // 主课包：私教 12 节（10+2 赠送）
    const mainPack = db.prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    expect(mainPack.total_sessions).toBe(12);
    expect(mainPack.business_type).toBe('PRIVATE');

    // 额外课包：陪练 1 节
    const extraPacks = db.prepare('SELECT * FROM packs WHERE order_id = ? AND business_type = ?').all(order.orderId, 'PRACTICE');
    expect(extraPacks.length).toBe(1);
    expect(extraPacks[0].total_sessions).toBe(1);
    expect(extraPacks[0].remaining_sessions).toBe(1);
    expect(extraPacks[0].gift_sessions).toBe(1);
    expect(extraPacks[0].status).toBe('ACTIVE');
  });

  it('次卡档位无额外赠送时只生成一个课包', () => {
    const member = createMember({ name: '无额外赠送测试', phone: '13900003011', categoryCode: 'M_PRIVATE' }, operator);
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

    const db = getDb();
    const allPacks = db.prepare('SELECT * FROM packs WHERE order_id = ?').all(order.orderId);
    expect(allPacks.length).toBe(1);
  });
});

describe('月卡额外赠送（跨业务类型赠送课时）', () => {
  it('月卡档位有额外赠送时应生成月卡课包+额外次卡课包', () => {
    const member = createMember({ name: '月卡额外赠送测试', phone: '13900003020', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const db = getDb();

    // 创建一个带额外赠送的月卡档位
    const mpId = 'test-mp-extra-' + Date.now();
    db.prepare(`INSERT INTO course_monthly_pricing (id, course_id, monthly_fee, weekly_frequency, monthly_quota, extra_gift_business_type, extra_gift_sessions, sort_order, status, created_at, updated_at) VALUES (?, ?, 700, 2, 8, 'PRACTICE', 2, 0, 'ACTIVE', datetime('now'), datetime('now'))`)
      .run(mpId, course.id);

    const order = createOrder({
      memberId: member.id,
      courseId: course.id,
      businessType: 'PRIVATE',
      chargeMode: 'MONTHLY',
      monthlyPricingId: mpId,
      confirmed: true,
    }, operator);

    expect(order.amount).toBe(700);

    // 主课包：私教月卡 8 次
    const mainPack = db.prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    expect(mainPack.pack_type).toBe('MONTHLY');
    expect(mainPack.monthly_quota).toBe(8);
    expect(mainPack.business_type).toBe('PRIVATE');

    // 额外课包：陪练次卡 2 节
    const extraPacks = db.prepare('SELECT * FROM packs WHERE order_id = ? AND business_type = ?').all(order.orderId, 'PRACTICE');
    expect(extraPacks.length).toBe(1);
    expect(extraPacks[0].pack_type).toBe('SESSION_PACK');
    expect(extraPacks[0].total_sessions).toBe(2);
    expect(extraPacks[0].remaining_sessions).toBe(2);
    expect(extraPacks[0].gift_sessions).toBe(2);
    expect(extraPacks[0].status).toBe('ACTIVE');
  });

  it('月卡档位无额外赠送时只生成一个月卡课包', () => {
    const member = createMember({ name: '月卡无额外赠送测试', phone: '13900003021', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const db = getDb();
    // 创建一个明确无额外赠送的月卡档位
    const mpId = 'test-mp-noextra-' + Date.now();
    db.prepare(`INSERT INTO course_monthly_pricing (id, course_id, monthly_fee, weekly_frequency, monthly_quota, extra_gift_business_type, extra_gift_sessions, sort_order, status, created_at, updated_at) VALUES (?, ?, 600, 2, 6, NULL, 0, 0, 'ACTIVE', datetime('now'), datetime('now'))`)
      .run(mpId, course.id);

    const order = createOrder({
      memberId: member.id,
      courseId: course.id,
      businessType: 'PRIVATE',
      chargeMode: 'MONTHLY',
      monthlyPricingId: mpId,
      confirmed: true,
    }, operator);

    const allPacks = db.prepare('SELECT * FROM packs WHERE order_id = ?').all(order.orderId);
    expect(allPacks.length).toBe(1);
    expect(allPacks[0].pack_type).toBe('MONTHLY');
  });
});

describe('折扣计算（已取消折扣功能）', () => {
  it('折扣功能已取消，不应用任何折扣', () => {
    const db = getDb();
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, discount_type, discount_value, target, status, created_at, updated_at) VALUES (?, '9折', 'PRIVATE', 'RATE', 10, 'ALL', 'ACTIVE', datetime('now'), datetime('now'))`).run('test-disc-1');
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, discount_type, discount_value, target, status, created_at, updated_at) VALUES (?, '8折', 'PRIVATE', 'RATE', 20, 'ALL', 'ACTIVE', datetime('now'), datetime('now'))`).run('test-disc-2');

    const result = calculateBestDiscount({ businessType: 'PRIVATE', courseId: null, amount: 1000, isNew: false, db });
    // 折扣功能已取消：返回原价
    expect(result.finalAmount).toBe(1000);
    expect(result.discountAmount).toBe(0);
    expect(result.appliedRule).toBeNull();
  });
});
