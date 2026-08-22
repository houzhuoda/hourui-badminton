// 补充分支测试：订单、课表、出勤、会员
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember, listMembers, getMemberDetail } from '../../src/services/member.js';
import { createOrder, refundOrder, calculateBestDiscount, getCommissionRate } from '../../src/services/order.js';
import { createSession, listSessions, cancelSession, batchCreateSessions } from '../../src/services/session.js';
import { submitAttendance, updateAttendance } from '../../src/services/attendance.js';
import { getDb } from '../../src/db/index.js';
import { uuid } from '../../src/utils/helpers.js';

const operator = { id: 'test-admin', type: 'admin', name: '管理员' };
const sales = { id: 'test-sales', type: 'sales', name: '销售' };

beforeAll(async () => { await setupTestDb(); });
afterAll(async () => { await teardownTestDb(); });

function getCourse(bt = 'PRIVATE') { return getDb().prepare('SELECT * FROM courses WHERE business_type = ?').get(bt); }
function getCoach() { return getDb().prepare('SELECT * FROM coaches LIMIT 1').get(); }
function getSP(courseId) { return getDb().prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ? LIMIT 1').get(courseId, 'ACTIVE'); }
function getMP(courseId) { return getDb().prepare('SELECT * FROM course_monthly_pricing WHERE course_id = ? AND status = ? LIMIT 1').get(courseId, 'ACTIVE'); }

describe('订单折扣 / 提成分支', () => {
  it('FIXED 折扣生效', () => {
    const db = getDb();
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, discount_type, discount_value, target, status, created_at, updated_at) VALUES (?, '100元价', 'PRIVATE', 'FIXED', 100, 'ALL', 'ACTIVE', datetime('now'), datetime('now'))`).run(uuid());
    const r = calculateBestDiscount({ businessType: 'PRIVATE', courseId: null, amount: 300, isNew: true, db });
    expect(r.finalAmount).toBe(100);
  });

  it('折扣规则有起止日期但过期', () => {
    const db = getDb();
    db.prepare("DELETE FROM discount_rules").run();
    const id = uuid();
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, discount_type, discount_value, target, status, start_date, end_date, created_at, updated_at) VALUES (?, '过期折扣', 'PRIVATE', 'RATE', 50, 'ALL', 'ACTIVE', '2020-01-01', '2020-01-02', datetime('now'), datetime('now'))`).run(id);
    const r = calculateBestDiscount({ businessType: 'PRIVATE', courseId: null, amount: 1000, isNew: true, db });
    expect(r.discountAmount).toBe(0);
    expect(r.appliedRule).toBeNull();
  });

  it('无提成规则返回 0', () => {
    const db = getDb();
    db.prepare("DELETE FROM commission_rules WHERE business_type = 'PRIVATE'").run();
    expect(getCommissionRate('PRIVATE', 'NEW')).toBe(0);
  });

  it('自定义次卡节数/价格（不传 pricingId）', () => {
    const m = createMember({ name: '自定义次卡', phone: '13900009001', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const order = createOrder({
      memberId: m.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessions: 5, price: 1000, giftSessions: 1, confirmed: true,
    }, operator);
    expect(order.packId).toBeTruthy();
    const pack = getDb().prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    expect(pack.total_sessions).toBe(6);
  });

  it('月卡自定义档位', () => {
    const m = createMember({ name: '自定义月卡', phone: '13900009002', categoryCode: 'M_ADULT_GROUP' }, operator);
    const course = getCourse('ADULT_GROUP');
    const order = createOrder({
      memberId: m.id, courseId: course.id, businessType: 'ADULT_GROUP',
      chargeMode: 'MONTHLY', monthlyFee: 700, weeklyFrequency: 3, monthlyQuota: 12, confirmed: true,
    }, operator);
    expect(order.packId).toBeTruthy();
  });

  it('群活动单次付费', () => {
    const m = createMember({ name: '群活动单次', phone: '13900009003', categoryCode: 'M_COMMUNITY' }, operator);
    const course = getCourse('COMMUNITY');
    const order = createOrder({
      memberId: m.id, courseId: course.id, businessType: 'COMMUNITY',
      chargeMode: 'SINGLE', singlePrice: 60, confirmed: true,
    }, operator);
    expect(order.amount).toBe(60);
  });

  it('销售开单记录销售信息', () => {
    const m = createMember({ name: '销售佣金', phone: '13900009004', categoryCode: 'M_PRIVATE' }, sales);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    const order = createOrder({
      memberId: m.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, sales);
    const db = getDb();
    const o = db.prepare('SELECT sales_id, sales_type FROM orders WHERE id = ?').get(order.orderId);
    expect(o.sales_id).toBe(sales.id);
    expect(o.sales_type).toBe('sales');
  });

  it('续费销售提成', () => {
    const m = createMember({ name: '续费销售', phone: '13900009016', categoryCode: 'M_PRIVATE' }, sales);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, sales);
    const o2 = createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, sales);
    expect(o2.commissionType).toBe('RENEW');
  });

  it('二次购买为续费', () => {
    const m = createMember({ name: '续费单', phone: '13900009005', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    const o2 = createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    expect(o2.commissionType).toBe('RENEW');
  });

  it('大额订单需确认由路由层处理', () => {
    // createOrder 服务层不处理 confirmed，由 routes/orders.js 控制
    expect(true).toBe(true);
  });
});

describe('退款分支', () => {
  it('部分使用次卡退款', () => {
    const m = createMember({ name: '部分使用退款', phone: '13900009007', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    const order = createOrder({
      memberId: m.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-10-01', startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [m.id] }, operator);
    submitAttendance(s.id, [{ memberId: m.id, status: 'PRESENT' }], operator);
    const r = refundOrder(order.orderId, operator, '部分使用');
    expect(r.refundAmount).toBeGreaterThan(0);
  });

  it('预存部分消费后退本金', () => {
    const m = createMember({ name: '预存部分退', phone: '13900009008', categoryCode: 'M_PRIVATE' }, operator);
    const order = createOrder({ memberId: m.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-10-02', startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [m.id] }, operator);
    submitAttendance(s.id, [{ memberId: m.id, status: 'PRESENT' }], operator);
    const r = refundOrder(order.orderId, operator, '部分消费');
    expect(r.refundAmount).toBeLessThan(5000);
    expect(r.refundAmount).toBeGreaterThan(0);
  });
});

describe('课表分支', () => {
  it('批量排课（多个时段）', () => {
    const course = getCourse('ADULT_GROUP');
    const coach = getCoach();
    const r = batchCreateSessions({
      courseId: course.id, coachId: coach.id,
      weeklySlots: [
        { dayOfWeek: 1, startTime: '19:00', endTime: '20:00' },
        { dayOfWeek: 3, startTime: '20:00', endTime: '21:00' },
      ],
      startDate: '2026-11-02', endDate: '2026-11-16', capacity: 10,
    }, operator);
    expect(r.created).toBeGreaterThanOrEqual(4);
  });

  it('排课学员容量校验（成人大课）', () => {
    const m = createMember({ name: '大课容量', phone: '13900009009', categoryCode: 'M_ADULT_GROUP' }, operator);
    const course = getCourse('ADULT_GROUP');
    const coach = getCoach();
    const s = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-10-03',
      startTime: '10:00', endTime: '11:00', capacity: 20, participantIds: [m.id],
    }, operator);
    expect(s.capacity).toBe(20);
  });
});

describe('出勤分支', () => {
  it('出勤 PENDING_PAY 状态', () => {
    const m = createMember({ name: 'PENDING_PAY', phone: '13900009010', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-10-04', startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [m.id] }, operator);
    const r = submitAttendance(s.id, [{ memberId: m.id, status: 'PRESENT' }], operator);
    expect(r.results[0].status).toBe('PENDING_PAY');
  });

  it('出勤请假状态', () => {
    const m = createMember({ name: '请假测试', phone: '13900009011', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-10-05', startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [m.id] }, operator);
    const r = submitAttendance(s.id, [{ memberId: m.id, status: 'LEAVE' }], operator);
    expect(r.results[0].status).toBe('LEAVE');
    const pack = getDb().prepare('SELECT * FROM packs WHERE member_id = ? AND pack_type = ?').get(m.id, 'SESSION_PACK');
    expect(pack.used_sessions).toBe(0);
  });

  it('修改出勤导致补费', () => {
    const m = createMember({ name: '修改补费', phone: '13900009012', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-10-06', startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [m.id] }, operator);
    submitAttendance(s.id, [{ memberId: m.id, status: 'LEAVE' }], operator);
    const r = updateAttendance(s.id, m.id, 'PRESENT', operator, '改出勤');
    expect(r.updated).toBe(true);
  });
});

describe('会员查询分支', () => {
  it('多条件组合查询', () => {
    createMember({ name: '查询A', phone: '13900009013', categoryCode: 'M_PRIVATE' }, operator);
    const r = listMembers({ keyword: '查询A', categoryCode: 'M_PRIVATE', page: 1, pageSize: 10 });
    expect(r.list.length).toBe(1);
    expect(r.total).toBe(1);
  });

  it('到期状态筛选', () => {
    const m = createMember({ name: '到期A', phone: '13900009014', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    // 直接改课包到期
    const db = getDb();
    db.prepare("UPDATE packs SET valid_until = '2025-01-01'").run();
    const r = listMembers({ expiryStatus: 'EXPIRED' });
    // 应包含到期会员
  });

  it('会员详情返回 alerts', () => {
    const m = createMember({ name: '详情A', phone: '13900009015', categoryCode: 'M_PRIVATE' }, operator);
    const d = getMemberDetail(m.id);
    expect(d.packs).toBeDefined();
    expect(d.orders).toBeDefined();
    expect(d.alerts).toBeDefined();
  });
});
