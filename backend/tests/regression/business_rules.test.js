// 回归测试：关键业务规则
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder, refundOrder } from '../../src/services/order.js';
import { createSession } from '../../src/services/session.js';
import { submitAttendance } from '../../src/services/attendance.js';
import { getDb } from '../../src/db/index.js';
import { BUSINESS_TO_CATEGORY, COMMISSION_TYPES, DEFAULTS } from '../../../shared/constants.js';

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

function getCoach() {
  const db = getDb();
  return db.prepare('SELECT * FROM coaches LIMIT 1').get();
}

function getSessionPricing(courseId) {
  const db = getDb();
  return db.prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ?').get(courseId, 'ACTIVE');
}

// REG-001: 次卡有效期 1 年（Q-02）
describe('REG-001: 次卡有效期 1 年', () => {
  it('次卡有效期应为 365 天', () => {
    const member = createMember({ name: '有效期测试', phone: '13900005001', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    const validDays = (new Date(pack.valid_until) - new Date(pack.valid_from)) / 86400000;
    expect(validDays).toBe(DEFAULTS.SESSION_PACK_VALIDITY_DAYS);
  });
});

// REG-003: 退费规则（Q-10）
describe('REG-003: 退费规则', () => {
  it('次卡退费 = 缴费金额 - 已消课节数 × 单次原价', () => {
    const member = createMember({ name: '退费规则', phone: '13900005003', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    // 上 3 节课
    const coach = getCoach();
    for (let i = 0; i < 3; i++) {
      const session = createSession({
        courseId: course.id, coachId: coach.id, date: `2026-12-${String(i + 10).padStart(2, '0')}`,
        startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
      }, operator);
      submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    }

    // 退款：退款金额 = 缴费金额 - 已消课节数 × 单次原价
    const result = refundOrder(order.orderId, operator, '退费测试');
    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE order_id = ?').get(order.orderId);
    const expectedRefund = order.amount - pack.used_sessions * pack.unit_price;
    expect(result.refundAmount).toBe(expectedRefund);
  });
});

// REG-004: 会员分类多标签自动累积（Q-16）
describe('REG-004: 会员分类多标签', () => {
  it('购买新业务自动累积标签', () => {
    const member = createMember({ name: '多标签回归', phone: '13900005004', categoryCode: 'M_PRIVATE' }, operator);
    const db = getDb();

    // 购买健身课程
    const gymCourse = getCourse('GYM');
    const gymSp = getSessionPricing(gymCourse.id);
    createOrder({
      memberId: member.id, courseId: gymCourse.id, businessType: 'GYM',
      chargeMode: 'SESSION_PACK', sessionPricingId: gymSp.id, confirmed: true,
    }, operator);

    const tags = db.prepare('SELECT category_code FROM member_tags WHERE member_id = ?').all(member.id).map((t) => t.category_code);
    expect(tags).toContain('M_PRIVATE');
    expect(tags).toContain('M_GYM');
  });
});

// REG-005: 销售提成新客/续费区分（Q-05）
describe('REG-005: 销售提成新客/续费', () => {
  it('首单为新客提成', () => {
    const member = createMember({ name: '提成区分', phone: '13900005005', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);
    expect(order.commissionType).toBe(COMMISSION_TYPES.NEW);
  });

  it('二单为续费提成', () => {
    const member = createMember({ name: '续费区分', phone: '13900005006', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    createOrder({ memberId: member.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    const order2 = createOrder({ memberId: member.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    expect(order2.commissionType).toBe(COMMISSION_TYPES.RENEW);
  });
});

// REG-006: 幂等性 — 重复出勤不重复扣费（GNR-001）
describe('REG-006: 幂等性', () => {
  it('重复提交出勤不重复扣费', () => {
    const member = createMember({ name: '幂等回归', phone: '13900005007', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const sp = getSessionPricing(course.id);

    createOrder({ memberId: member.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-12-20',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);

    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE member_id = ? AND pack_type = ?').get(member.id, 'SESSION_PACK');
    expect(pack.used_sessions).toBe(1);
  });
});

// REG-007: 排课冲突校验（SCH-002）
describe('REG-007: 排课冲突', () => {
  it('同教练时间冲突应拦截', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();

    createSession({
      courseId: course.id, coachId: coach.id, date: '2026-12-25',
      startTime: '14:00', endTime: '15:00', capacity: 1,
    }, operator);

    expect(() => {
      createSession({
        courseId: course.id, coachId: coach.id, date: '2026-12-25',
        startTime: '14:30', endTime: '15:30', capacity: 1,
      }, operator);
    }).toThrow();
  });
});
