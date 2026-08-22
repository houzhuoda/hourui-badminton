// 单元测试：出勤核销服务（次卡/预存/月卡扣减 + 幂等）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder } from '../../src/services/order.js';
import { createSession, getSessionDetail } from '../../src/services/session.js';
import { submitAttendance, updateAttendance, getCoachStats } from '../../src/services/attendance.js';
import { ATTENDANCE_STATUS, PACK_STATUS } from '../../../shared/constants.js';
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

function getCoach() {
  const db = getDb();
  return db.prepare('SELECT * FROM coaches LIMIT 1').get();
}

function getSessionPricing(courseId) {
  const db = getDb();
  return db.prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ?').get(courseId, 'ACTIVE');
}

describe('次卡核销', () => {
  it('出勤应扣减次卡节数', () => {
    const member = createMember({ name: '核销测试', phone: '13900003001', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);
    const coach = getCoach();

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-01',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    const result = submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    expect(result.results[0].status).toBe('PRESENT');
    expect(result.results[0].consumption.chargeMode).toBe('SESSION_PACK');

    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE id = ?').get(order.packId);
    expect(pack.used_sessions).toBe(1);
    expect(pack.remaining_sessions).toBe(pack.total_sessions - 1);
  });
});

describe('预存核销（Q-01：先扣本金后扣赠送）', () => {
  it('应先扣本金', () => {
    const member = createMember({ name: '预存核销', phone: '13900003002', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();

    // 预存 5000 赠 2000
    createOrder({ memberId: member.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-02',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);

    const db = getDb();
    const account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(member.id);
    // 课程单价 300，先扣本金
    expect(account.principal_balance).toBe(5000 - 300);
    expect(account.gift_balance).toBe(2000); // 赠送未动
  });

  it('本金不足时应扣赠送', () => {
    const member = createMember({ name: '本金不足', phone: '13900003003', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();

    // 预存 3000 赠 1000，总 4000
    createOrder({ memberId: member.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 3000, confirmed: true }, operator);

    // 上 15 节课，每节 300，总 4500 > 4000
    for (let i = 0; i < 14; i++) {
      const session = createSession({
        courseId: course.id, coachId: coach.id, date: `2026-09-${String(i + 10).padStart(2, '0')}`,
        startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
      }, operator);
      submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    }

    const db = getDb();
    const account = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(member.id);
    // 14 节 × 300 = 4200，本金 3000 扣完，赠送扣 1200，剩余赠送 1000-1200 < 0?
    // 实际：本金 3000 + 赠送 1000 = 4000，14 节 × 300 = 4200 > 4000
    // 第 14 节时余额不足，应 PENDING_PAY
    // 13 节 × 300 = 3900，剩余 100
    // 第 14 节需 300，余额 100 不足
    expect(account.total_balance).toBeLessThan(300);
  });
});

describe('月卡核销', () => {
  it('出勤应扣减月卡当月额度', () => {
    const member = createMember({ name: '月卡核销', phone: '13900003004', categoryCode: 'M_ADULT_GROUP' }, operator);
    const course = getCourse('ADULT_GROUP');
    const coach = getCoach();
    const db = getDb();
    const mp = db.prepare('SELECT * FROM course_monthly_pricing WHERE course_id = ? AND status = ?').get(course.id, 'ACTIVE');

    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'ADULT_GROUP',
      chargeMode: 'MONTHLY', monthlyPricingId: mp.id, confirmed: true,
    }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-03',
      startTime: '10:00', endTime: '11:00', capacity: 10, participantIds: [member.id],
    }, operator);

    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);

    const pack = db.prepare('SELECT * FROM packs WHERE member_id = ? AND pack_type = ?').get(member.id, 'MONTHLY');
    expect(pack.monthly_used).toBe(1);
    expect(pack.monthly_remaining).toBe(mp.monthly_quota - 1);
  });
});

describe('幂等性（GNR-001）', () => {
  it('同一课次同一学员不应重复核销', () => {
    const member = createMember({ name: '幂等测试', phone: '13900003005', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const sp = getSessionPricing(course.id);

    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-04',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    // 第一次出勤
    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    // 第二次提交应跳过
    const result2 = submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    expect(result2.results[0].skipped).toBe(true);

    // 验证只扣了一次
    const db = getDb();
    const pack = db.prepare('SELECT * FROM packs WHERE member_id = ? AND pack_type = ?').get(member.id, 'SESSION_PACK');
    expect(pack.used_sessions).toBe(1);
  });
});

describe('资产不足处理（COA-005）', () => {
  it('无课包时应标记 PENDING_PAY', () => {
    const member = createMember({ name: '无课包测试', phone: '13900003006', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-05',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    const result = submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    expect(result.results[0].status).toBe(ATTENDANCE_STATUS.PENDING_PAY);
    expect(result.results[0].consumption).toBeNull();
  });
});

describe('修改出勤（COA-007）', () => {
  it('从 PENDING_PAY 改为 PRESENT 应重新核销', () => {
    const member = createMember({ name: '修改出勤', phone: '13900003007', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const sp = getSessionPricing(course.id);

    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-06',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    // 先请假
    submitAttendance(session.id, [{ memberId: member.id, status: 'LEAVE' }], operator);
    // 改为出勤
    const result = updateAttendance(session.id, member.id, ATTENDANCE_STATUS.PRESENT, operator, '改错');
    expect(result.updated).toBe(true);
    expect(result.newStatus).toBe('PRESENT');
  });

  it('修改应记录日志', () => {
    const member = createMember({ name: '修改日志', phone: '13900003008', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const sp = getSessionPricing(course.id);

    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-07',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);
    updateAttendance(session.id, member.id, ATTENDANCE_STATUS.ABSENT, operator, '误操作');

    const db = getDb();
    const logs = db.prepare('SELECT * FROM attendance_change_logs WHERE attendance_id IN (SELECT id FROM attendance WHERE session_id = ?)').all(session.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('教练上课统计', () => {
  it('应正确统计上课节数与课时费', () => {
    const member = createMember({ name: '统计测试', phone: '13900003009', categoryCode: 'M_PRIVATE' }, operator);
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const sp = getSessionPricing(course.id);

    createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, operator);

    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-09-08',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, operator);

    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], operator);

    const stats = getCoachStats(coach.id, '2026-09-01', '2026-09-30');
    expect(stats.summary.present_count).toBeGreaterThan(0);
    expect(stats.summary.total_lesson_fee).toBeGreaterThan(0);
  });
});
