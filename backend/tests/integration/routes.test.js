// 集成测试：补充路由覆盖（渠道、课程、教练、约课、会员端、销售端）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb, getAdminToken, getCoachToken, getMemberToken, createTestMember, getFirstCourseId, getFirstCoachId, createTestOrder, createTestSession } from '../helpers.js';

let adminToken, coachToken, salesToken;
let memberId, course, coach, sessionId;

beforeAll(async () => {
  await setupTestDb();
  adminToken = await getAdminToken();
  coachToken = await getCoachToken();
  salesToken = await request(app).post('/api/auth/sales/login').send({ phone: '13800000001', password: '123456' }).then((r) => r.body.data.token);

  // 创建测试数据
  const member = await createTestMember(adminToken, { phone: '13900006001', name: '补充测试会员' });
  memberId = member.id;
  course = await getFirstCourseId(adminToken, 'ADULT_GROUP');
  coach = await getFirstCoachId(adminToken);
  // 开单（次卡）
  await createTestOrder(adminToken, memberId, course);
  // 排课并开放约课
  const session = await createTestSession(adminToken, course.id, coach.id, memberId, { bookingOpen: true, capacity: 10, date: '2026-12-15' });
  sessionId = session.id;
});

afterAll(async () => {
  await teardownTestDb();
});

describe('课程管理 API 补充', () => {
  it('新增课程', async () => {
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '测试新课', businessType: 'PRIVATE', audience: 'ADULT', durationMin: 45, standardPrice: 250 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('测试新课');
  });

  it('编辑课程', async () => {
    const res = await request(app).put(`/api/courses/${course.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '修改后课程', standardPrice: 120 });
    expect(res.body.code).toBe(0);
  });

  it('新增次卡定价', async () => {
    const res = await request(app).post(`/api/courses/${course.id}/session-pricing`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sessions: 5, price: 450, giftSessions: 1 });
    expect(res.status).toBe(201);
  });

  it('编辑次卡定价', async () => {
    const spRes = await request(app).get(`/api/courses/${course.id}`).set('Authorization', `Bearer ${adminToken}`);
    const spId = spRes.body.data.sessionPricing[0].id;
    const res = await request(app).put(`/api/courses/${course.id}/session-pricing/${spId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 500 });
    expect(res.body.code).toBe(0);
  });

  it('删除次卡定价', async () => {
    const spRes = await request(app).get(`/api/courses/${course.id}`).set('Authorization', `Bearer ${adminToken}`);
    const spId = spRes.body.data.sessionPricing[0].id;
    const res = await request(app).delete(`/api/courses/${course.id}/session-pricing/${spId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('新增月卡定价', async () => {
    const res = await request(app).post(`/api/courses/${course.id}/monthly-pricing`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyFee: 800, weeklyFrequency: 3, monthlyQuota: 12 });
    expect(res.status).toBe(201);
  });

  it('编辑月卡定价', async () => {
    const mpRes = await request(app).get(`/api/courses/${course.id}`).set('Authorization', `Bearer ${adminToken}`);
    const mpId = mpRes.body.data.monthlyPricing[0].id;
    const res = await request(app).put(`/api/courses/${course.id}/monthly-pricing/${mpId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyFee: 900 });
    expect(res.body.code).toBe(0);
  });

  it('删除月卡定价', async () => {
    const mpRes = await request(app).get(`/api/courses/${course.id}`).set('Authorization', `Bearer ${adminToken}`);
    const mpId = mpRes.body.data.monthlyPricing[0].id;
    const res = await request(app).delete(`/api/courses/${course.id}/monthly-pricing/${mpId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('预存赠送规则 CRUD', async () => {
    // 列表
    const listRes = await request(app).get('/api/courses/prepaid-rules/list').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.code).toBe(0);
    // 新增
    const createRes = await request(app).post('/api/courses/prepaid-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositAmount: 20000, giftAmount: 10000 });
    expect(createRes.status).toBe(201);
    // 编辑
    const editRes = await request(app).put(`/api/courses/prepaid-rules/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ giftAmount: 12000 });
    expect(editRes.body.code).toBe(0);
    // 删除
    const delRes = await request(app).delete(`/api/courses/prepaid-rules/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.body.code).toBe(0);
  });

  it('折扣规则 CRUD', async () => {
    const createRes = await request(app).post('/api/courses/discount-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '测试折扣', businessType: 'PRIVATE', discountType: 'RATE', discountValue: 15, target: 'NEW' });
    expect(createRes.status).toBe(201);
    const editRes = await request(app).put(`/api/courses/discount-rules/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ discountValue: 20 });
    expect(editRes.body.code).toBe(0);
    const delRes = await request(app).delete(`/api/courses/discount-rules/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.body.code).toBe(0);
  });
});

describe('教练管理 API 补充', () => {
  it('新增教练', async () => {
    const res = await request(app).post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '新教练', phone: '13800006666', password: '123456', primaryBusinessType: 'ADULT_GROUP', salesEnabled: true });
    expect(res.status).toBe(201);
  });

  it('编辑教练', async () => {
    const res = await request(app).put(`/api/coaches/${coach.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '修改教练名', salesEnabled: false });
    expect(res.body.code).toBe(0);
  });

  it('设置教练费率', async () => {
    const res = await request(app).put(`/api/coaches/${coach.id}/rates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rates: [{ businessType: 'PRIVATE', lessonFee: 150, shareRate: 10 }] });
    expect(res.body.code).toBe(0);
  });

  it('销售能力开关', async () => {
    const res = await request(app).patch(`/api/coaches/${coach.id}/sales-enabled`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true });
    expect(res.body.code).toBe(0);
  });

  it('教练详情', async () => {
    const res = await request(app).get(`/api/coaches/${coach.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('教练查看本人详情', async () => {
    const res = await request(app).get(`/api/coaches/${coach.id}`)
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('渠道管理 API 补充', () => {
  it('新增一级渠道', async () => {
    const res = await request(app).post('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '测试渠道', type: 'OFFLINE' });
    expect(res.status).toBe(201);
  });

  it('编辑渠道', async () => {
    const listRes = await request(app).get('/api/channels').set('Authorization', `Bearer ${adminToken}`);
    const ch = listRes.body.data.tree[0];
    const res = await request(app).put(`/api/channels/${ch.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '修改渠道名', sortOrder: 1 });
    expect(res.body.code).toBe(0);
  });

  it('停用渠道', async () => {
    const listRes = await request(app).get('/api/channels').set('Authorization', `Bearer ${adminToken}`);
    const ch = listRes.body.data.tree[0];
    const res = await request(app).patch(`/api/channels/${ch.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DISABLED' });
    expect(res.body.code).toBe(0);
  });

  it('渠道统计', async () => {
    const res = await request(app).get('/api/channels/stats/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('约课 API（会员端）', () => {
  let memberToken;

  beforeAll(async () => {
    memberToken = await getMemberToken('13900006001');
  });

  it('查看可约课次', async () => {
    const res = await request(app).get('/api/bookings/available')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('预约课次', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ sessionId });
    expect(res.body.code).toBe(0);
  });

  it('重复预约应拦截', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ sessionId });
    expect(res.body.code).not.toBe(0);
  });

  it('我的约课记录', async () => {
    const res = await request(app).get('/api/bookings/mine')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('教练查看约课名单', async () => {
    const res = await request(app).get(`/api/bookings/session/${sessionId}`)
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('会员端 API', () => {
  let memberToken;

  beforeAll(async () => {
    memberToken = await getMemberToken('13900006001');
  });

  it('我的资产', async () => {
    const res = await request(app).get('/api/member-end/my-assets')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.packs.length).toBeGreaterThan(0);
  });

  it('我的消费记录', async () => {
    const res = await request(app).get('/api/member-end/my-consumption')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('我的出勤记录', async () => {
    const res = await request(app).get('/api/member-end/my-attendance')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('会员端配置', async () => {
    const res = await request(app).get('/api/member-end/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('更新会员端配置', async () => {
    const res = await request(app).put('/api/member-end/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bookingCancelHours: 4, noshowAction: 'RECORD_ONLY' });
    expect(res.body.code).toBe(0);
  });
});

describe('销售端 API', () => {
  it('销售工作台', async () => {
    const res = await request(app).get('/api/sales/dashboard')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.body.code).toBe(0);
  });

  it('销售业绩明细', async () => {
    const res = await request(app).get('/api/sales/performance')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.body.code).toBe(0);
  });

  it('教练课表摘要', async () => {
    const res = await request(app).get('/api/sales/coach/schedule-summary')
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('提成 API 补充', () => {
  it('提成记录列表', async () => {
    const res = await request(app).get('/api/commissions/records')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('我的提成（销售）', async () => {
    const res = await request(app).get('/api/commissions/mine')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('课表 API 补充', () => {
  it('批量排课', async () => {
    const res = await request(app).post('/api/sessions/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courseId: course.id, coachId: coach.id,
        weeklySlots: [{ dayOfWeek: 2, startTime: '19:00', endTime: '20:00' }],
        startDate: '2026-11-03', endDate: '2026-11-10', capacity: 10,
      });
    expect(res.body.code).toBe(0);
  });

  it('修改课次', async () => {
    const res = await request(app).put(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 15 });
    expect(res.body.code).toBe(0);
  });

  it('添加学员到课次', async () => {
    const newMember = await createTestMember(adminToken, { phone: '13900006002', name: '课次学员' });
    const res = await request(app).post(`/api/sessions/${sessionId}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: newMember.id });
    expect(res.body.code).toBe(0);
  });

  it('移除学员', async () => {
    const newMember = await createTestMember(adminToken, { phone: '13900006003', name: '移除学员' });
    await request(app).post(`/api/sessions/${sessionId}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: newMember.id });
    const res = await request(app).delete(`/api/sessions/${sessionId}/participants/${newMember.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('取消课次', async () => {
    const s = await createTestSession(adminToken, course.id, coach.id, null, { date: '2026-12-30' });
    const res = await request(app).delete(`/api/sessions/${s.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '测试取消' });
    expect(res.body.code).toBe(0);
  });
});

describe('会员管理 API 补充', () => {
  it('更新会员', async () => {
    const res = await request(app).put(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '更新后名称', gender: 'F' });
    expect(res.body.code).toBe(0);
  });

  it('停用会员', async () => {
    const res = await request(app).patch(`/api/members/${memberId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DISABLED' });
    expect(res.body.code).toBe(0);
  });

  it('启用会员', async () => {
    const res = await request(app).patch(`/api/members/${memberId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });
    expect(res.body.code).toBe(0);
  });

  it('标签历史', async () => {
    const res = await request(app).get(`/api/members/${memberId}/tag-history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('审计日志', async () => {
    const res = await request(app).get(`/api/members/${memberId}/audit-logs`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('销售建档', async () => {
    const res = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: '销售建的会员', phone: '13900006004', categoryCode: 'M_PRIVATE' });
    expect(res.status).toBe(201);
  });

  it('销售查看本人建档会员', async () => {
    const res = await request(app).get('/api/members')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('订单 API 补充', () => {
  it('订单详情', async () => {
    const listRes = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    const orderId = listRes.body.data.list[0].id;
    const res = await request(app).get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('退款', async () => {
    const listRes = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    const orderId = listRes.body.data.list[0].id;
    const res = await request(app).post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '测试退款' });
    expect(res.body.code).toBe(0);
  });
});

describe('出勤 API 补充', () => {
  it('教练上课统计', async () => {
    const res = await request(app).get('/api/attendance/stats/coach')
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).toBe(0);
  });

  it('查询课次出勤', async () => {
    // 先排课并出勤
    const s = await createTestSession(adminToken, course.id, coach.id, memberId, { date: '2026-12-28' });
    await request(app).post(`/api/attendance/${s.id}/submit`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ attendance: [{ memberId, status: 'PRESENT' }] });
    const res = await request(app).get(`/api/attendance/${s.id}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).toBe(0);
  });

  it('修改出勤', async () => {
    const s = await createTestSession(adminToken, course.id, coach.id, memberId, { date: '2026-12-29' });
    await request(app).post(`/api/attendance/${s.id}/submit`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ attendance: [{ memberId, status: 'LEAVE' }] });
    const res = await request(app).patch(`/api/attendance/${s.id}/attendance/${memberId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ABSENT', reason: '改状态' });
    expect(res.body.code).toBe(0);
  });
});
