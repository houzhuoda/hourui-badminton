// 分支覆盖率补充测试：集中覆盖各服务中的异常分支
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder, refundOrder } from '../../src/services/order.js';
import { createSession, cancelSession } from '../../src/services/session.js';
import { submitAttendance, updateAttendance } from '../../src/services/attendance.js';
import { getDb } from '../../src/db/index.js';
import { BizError } from '../../src/middleware/error.js';

const operator = { id: 'test-admin', type: 'admin', name: '管理员' };

beforeAll(async () => { await setupTestDb(); });
afterAll(async () => { await teardownTestDb(); });

function getCourse(bt = 'PRIVATE') { return getDb().prepare('SELECT * FROM courses WHERE business_type = ?').get(bt); }
function getCoach() { return getDb().prepare('SELECT * FROM coaches LIMIT 1').get(); }
function getSP(courseId) { return getDb().prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ? LIMIT 1').get(courseId, 'ACTIVE'); }

describe('会员服务异常分支', () => {
  it('缺少姓名/电话/分类应报错', () => {
    expect(() => createMember({ phone: '13900008001', categoryCode: 'M_PRIVATE' }, operator)).toThrow();
    expect(() => createMember({ name: '无名', categoryCode: 'M_PRIVATE' }, operator)).toThrow();
    expect(() => createMember({ name: '无分类', phone: '13900008001' }, operator)).toThrow();
  });
});

describe('订单服务异常分支', () => {
  it('无效收费模式', () => {
    const m = createMember({ name: '异常订单', phone: '13900008004', categoryCode: 'M_PRIVATE' }, operator);
    expect(() => createOrder({ memberId: m.id, businessType: 'PRIVATE', chargeMode: 'UNKNOWN' }, operator)).toThrow('无效收费模式');
  });

  it('不存在的会员', () => {
    expect(() => createOrder({ memberId: 'nonexistent', businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', confirmed: true }, operator)).toThrow();
  });

  it('缺少业务类型或收费模式', () => {
    const m = createMember({ name: '缺失字段', phone: '13900008005', categoryCode: 'M_PRIVATE' }, operator);
    expect(() => createOrder({ memberId: m.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', confirmed: true }, operator)).toThrow();
  });

  it('退款不存在的订单', () => {
    expect(() => refundOrder('nonexistent', operator, 'x')).toThrow();
  });

  it('二次退款失败', () => {
    const m = createMember({ name: '二次退款', phone: '13900008006', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    const order = createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, operator);
    refundOrder(order.orderId, operator, 'x');
    expect(() => refundOrder(order.orderId, operator, 'x')).toThrow('已退款');
  });
});

describe('课表服务异常分支', () => {
  it('取消不存在课次', () => {
    expect(() => cancelSession('nonexistent', operator, 'x')).toThrow();
  });

  it('容量强制为 1（私教）', () => {
    const m = createMember({ name: '私教容量', phone: '13900008007', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-08-25', startTime: '09:00', endTime: '10:00', capacity: 5, participantIds: [m.id] }, operator);
    expect(s.capacity).toBe(1);
  });
});

describe('出勤服务异常分支', () => {
  it('不存在的课次', () => {
    expect(() => submitAttendance('nonexistent', [{ memberId: 'x', status: 'PRESENT' }], operator)).toThrow();
  });

  it('已取消课次不能出勤', () => {
    const m = createMember({ name: '取消出勤', phone: '13900008008', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-08-26', startTime: '09:00', endTime: '10:00', capacity: 1, participantIds: [m.id] }, operator);
    cancelSession(s.id, operator, 'x');
    expect(() => submitAttendance(s.id, [{ memberId: m.id, status: 'PRESENT' }], operator)).toThrow('课次已取消');
  });

  it('修改不存在出勤', () => {
    const m = createMember({ name: '修改不存在', phone: '13900008009', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const s = createSession({ courseId: course.id, coachId: coach.id, date: '2026-08-27', startTime: '09:00', endTime: '10:00', capacity: 1, participantIds: [m.id] }, operator);
    // 未出勤直接修改
    expect(() => updateAttendance(s.id, m.id, 'ABSENT', operator, 'x')).toThrow();
  });
});

describe('数据库约束异常', () => {
  it('重复手机号', () => {
    createMember({ name: '重复用户', phone: '13900008010', categoryCode: 'M_PRIVATE' }, operator);
    expect(() => createMember({ name: '重复用户2', phone: '13900008010', categoryCode: 'M_PRIVATE' }, operator)).toThrow();
  });

  it('使用其他角色处理订单', () => {
    const salesOp = { id: 'sales-1', type: 'sales', name: '销售' };
    const m = createMember({ name: '销售测试', phone: '13900008011', categoryCode: 'M_PRIVATE' }, salesOp);
    const course = getCourse('PRIVATE');
    const sp = getSP(course.id);
    const order = createOrder({ memberId: m.id, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true }, salesOp);
    expect(order.commissionAmount).toBeGreaterThan(0);
    // 课后计提模式：开单时不记录提成，出勤后才记录
    const db = getDb();
    const orderRow = db.prepare('SELECT sales_id, sales_type, commission_rate FROM orders WHERE id = ?').get(order.orderId);
    expect(orderRow.sales_id).toBe('sales-1');
    expect(orderRow.sales_type).toBe('sales');
    expect(orderRow.commission_rate).toBeGreaterThan(0);
  });
});
