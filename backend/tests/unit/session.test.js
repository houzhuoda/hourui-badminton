// 单元测试：课表服务（排课、冲突校验）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers.js';
import { createSession, checkConflict, cancelSession, listSessions, batchCreateSessions } from '../../src/services/session.js';
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

describe('排课', () => {
  it('应成功排课', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-10-01',
      startTime: '09:00', endTime: '10:00', capacity: 1,
    }, operator);
    expect(session.id).toBeTruthy();
    expect(session.business_type).toBe('PRIVATE');
  });

  it('私教课容量强制为 1（SCH-005）', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-10-02',
      startTime: '09:00', endTime: '10:00', capacity: 10, // 试图设为 10
    }, operator);
    expect(session.capacity).toBe(1);
  });

  it('开始时间晚于结束时间应报错', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    expect(() => {
      createSession({
        courseId: course.id, coachId: coach.id, date: '2026-10-03',
        startTime: '11:00', endTime: '10:00', capacity: 1,
      }, operator);
    }).toThrow();
  });
});

describe('冲突校验（SCH-002）', () => {
  it('同教练时间重叠应检测到冲突', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    // 先排一节课
    createSession({
      courseId: course.id, coachId: coach.id, date: '2026-10-10',
      startTime: '14:00', endTime: '15:00', capacity: 1,
    }, operator);
    // 同教练重叠时间
    const conflicts = checkConflict({
      coachId: coach.id, date: '2026-10-10',
      startTime: '14:30', endTime: '15:30',
    });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some((c) => c.type === 'coach')).toBe(true);
  });

  it('同教练不重叠时间无冲突', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const conflicts = checkConflict({
      coachId: coach.id, date: '2026-10-10',
      startTime: '16:00', endTime: '17:00',
    });
    // 16:00-17:00 与 14:00-15:00 不重叠
    expect(conflicts.length).toBe(0);
  });

  it('排课冲突应抛出错误', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    expect(() => {
      createSession({
        courseId: course.id, coachId: coach.id, date: '2026-10-10',
        startTime: '14:30', endTime: '15:30', capacity: 1,
      }, operator);
    }).toThrow();
  });
});

describe('取消课次', () => {
  it('取消后状态应为 CANCELLED', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-10-20',
      startTime: '09:00', endTime: '10:00', capacity: 1,
    }, operator);
    const result = cancelSession(session.id, operator, '测试取消');
    expect(result.cancelled).toBe(true);

    const db = getDb();
    const s = db.prepare('SELECT status FROM sessions WHERE id = ?').get(session.id);
    expect(s.status).toBe('CANCELLED');
  });

  it('重复取消应报错', () => {
    const course = getCourse('PRIVATE');
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-10-21',
      startTime: '09:00', endTime: '10:00', capacity: 1,
    }, operator);
    cancelSession(session.id, operator, '第一次取消');
    expect(() => cancelSession(session.id, operator, '第二次取消')).toThrow();
  });
});

describe('课表查询', () => {
  it('按日期范围查询', () => {
    const list = listSessions({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(Array.isArray(list)).toBe(true);
  });

  it('按教练筛选', () => {
    const coach = getCoach();
    const list = listSessions({ coachId: coach.id });
    expect(list.every((s) => s.coach_id === coach.id)).toBe(true);
  });
});

describe('批量排课（SCH-007）', () => {
  it('按周模板批量生成', () => {
    const course = getCourse('ADULT_GROUP');
    const coach = getCoach();
    const result = batchCreateSessions({
      courseId: course.id, coachId: coach.id,
      weeklySlots: [{ dayOfWeek: 1, startTime: '19:00', endTime: '20:00' }], // 周一
      startDate: '2026-11-02', endDate: '2026-11-16', // 包含 2 个周一
      capacity: 10,
    }, operator);
    expect(result.created).toBeGreaterThanOrEqual(2);
  });
});
