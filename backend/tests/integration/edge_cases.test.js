// 集成测试：边界与错误场景（提升分支覆盖率）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb, getAdminToken, getCoachToken, getSalesToken, getMemberToken, createTestMember, getFirstCourseId, getFirstCoachId, createTestOrder, createTestSession } from '../helpers.js';

let adminToken, coachToken, salesToken;
let memberId, course, coach;

beforeAll(async () => {
  await setupTestDb();
  adminToken = await getAdminToken();
  coachToken = await getCoachToken();
  salesToken = await getSalesToken();
  const member = await createTestMember(adminToken, { phone: '13900007001', name: '边界测试' });
  memberId = member.id;
  course = await getFirstCourseId(adminToken, 'PRIVATE');
  coach = await getFirstCoachId(adminToken);
});

afterAll(async () => {
  await teardownTestDb();
});

describe('认证边界', () => {
  it('缺少字段登录', async () => {
    expect((await request(app).post('/api/auth/login').send({})).body.code).not.toBe(0);
    expect((await request(app).post('/api/auth/sales/login').send({})).body.code).not.toBe(0);
    expect((await request(app).post('/api/auth/coach/login').send({})).body.code).not.toBe(0);
    expect((await request(app).post('/api/auth/member/login').send({})).body.code).not.toBe(0);
    expect((await request(app).post('/api/auth/member/send-code').send({})).body.code).not.toBe(0);
  });

  it('错误验证码格式', async () => {
    const res = await request(app).post('/api/auth/member/login').send({ phone: '13900007001', code: 'abc' });
    expect(res.body.code).not.toBe(0);
  });

  it('无效 token', async () => {
    const res = await request(app).get('/api/members').set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  it('无权限访问', async () => {
    // 销售访问看板
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
    // 教练访问看板
    const res2 = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${coachToken}`);
    expect(res2.status).toBe(403);
  });

  it('教练未开启销售能力不可建档', async () => {
    // 先关闭教练销售能力
    await request(app).patch(`/api/coaches/${coach.id}/sales-enabled`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false });
    // 重新登录教练获取新 token
    const newCoachToken = await request(app).post('/api/auth/coach/login')
      .send({ phone: '13800000002', password: '123456' }).then((r) => r.body.data.token);
    const res = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${newCoachToken}`)
      .send({ name: '教练建会员', phone: '13900007002', categoryCode: 'M_PRIVATE' });
    expect(res.body.code).not.toBe(0);
    // 恢复
    await request(app).patch(`/api/coaches/${coach.id}/sales-enabled`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true });
  });
});

describe('会员边界', () => {
  it('无效手机号格式', async () => {
    const res = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '无效手机', phone: '123', categoryCode: 'M_PRIVATE' });
    expect(res.body.code).not.toBe(0);
  });

  it('缺少会员分类', async () => {
    const res = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '无分类', phone: '13900007003' });
    expect(res.body.code).not.toBe(0);
  });

  it('无效标签', async () => {
    const res = await request(app).post(`/api/members/${memberId}/tags`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryCode: 'INVALID' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的会员', async () => {
    const res = await request(app).get('/api/members/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).not.toBe(0);
  });

  it('无效会员状态', async () => {
    const res = await request(app).patch(`/api/members/${memberId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INVALID' });
    expect(res.body.code).not.toBe(0);
  });

  it('会员查看他人档案', async () => {
    const memberToken = await getMemberToken('13900007001');
    const otherMember = await createTestMember(adminToken, { phone: '13900007004', name: '他人' });
    const res = await request(app).get(`/api/members/${otherMember.id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).not.toBe(0);
  });
});

describe('课程边界', () => {
  it('无效业务类型', async () => {
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '无效', businessType: 'INVALID' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的课程', async () => {
    const res = await request(app).get('/api/courses/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).not.toBe(0);
  });

  it('无效折扣类型', async () => {
    const res = await request(app).post('/api/courses/discount-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '无效折扣', discountType: 'INVALID', discountValue: 10 });
    expect(res.body.code).not.toBe(0);
  });

  it('月卡定价缺少字段', async () => {
    const res = await request(app).post(`/api/courses/${course.id}/monthly-pricing`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyFee: 700 });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的定价档位', async () => {
    const res = await request(app).put(`/api/courses/${course.id}/session-pricing/nonexistent`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 500 });
    expect(res.body.code).not.toBe(0);
  });
});

describe('教练边界', () => {
  it('重复手机号', async () => {
    const res = await request(app).post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '重复', phone: '13800000002', password: '123456' });
    expect(res.body.code).not.toBe(0);
  });

  it('无效手机号', async () => {
    const res = await request(app).post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '无效', phone: '123', password: '123456' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的教练', async () => {
    const res = await request(app).put('/api/coaches/nonexistent/rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rates: [] });
    expect(res.body.code).not.toBe(0);
  });

  it('教练查看他人详情', async () => {
    // 新建另一个教练
    const newCoach = await request(app).post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '另一教练', phone: '13800007777', password: '123456' });
    const res = await request(app).get(`/api/coaches/${newCoach.body.data.id}`)
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).not.toBe(0);
  });
});

describe('订单边界', () => {
  it('缺少必填字段', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId });
    expect(res.body.code).not.toBe(0);
  });

  it('无效收费模式', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId, businessType: 'PRIVATE', chargeMode: 'INVALID' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的会员', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: 'nonexistent', businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', confirmed: true });
    expect(res.body.code).not.toBe(0);
  });

  it('大额订单需二次确认', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessions: 10, price: 5000 });
    expect(res.body.data.needConfirm).toBe(true);
  });

  it('不存在的次卡档位', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId, courseId: course.id, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: 'nonexistent', confirmed: true });
    expect(res.body.code).not.toBe(0);
  });

  it('退款不存在的订单', async () => {
    const res = await request(app).post('/api/orders/nonexistent/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '测试' });
    expect(res.body.code).not.toBe(0);
  });

  it('销售/教练查看他人订单', async () => {
    const listRes = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    const orderId = listRes.body.data.list[0]?.id;
    if (orderId) {
      const res = await request(app).get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${salesToken}`);
      expect(res.body.code).not.toBe(0);
    }
  });
});

describe('课表边界', () => {
  it('缺少必填字段', async () => {
    const res = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: course.id });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的课程', async () => {
    const res = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: 'nonexistent', coachId: coach.id, date: '2026-12-01', startTime: '10:00', endTime: '11:00' });
    expect(res.body.code).not.toBe(0);
  });

  it('教练查看他人课次', async () => {
    const s = await createTestSession(adminToken, course.id, coach.id, null);
    // 新建另一个教练
    const newCoach = await request(app).post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '教练B', phone: '13800008888', password: '123456' });
    const newCoachToken = await request(app).post('/api/auth/coach/login')
      .send({ phone: '13800008888', password: '123456' }).then((r) => r.body.data.token);
    const res = await request(app).get(`/api/sessions/${s.id}`)
      .set('Authorization', `Bearer ${newCoachToken}`);
    expect(res.body.code).not.toBe(0);
  });

  it('批量排课缺少字段', async () => {
    const res = await request(app).post('/api/sessions/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: course.id });
    expect(res.body.code).not.toBe(0);
  });
});

describe('约课边界', () => {
  it('预约不存在的课次', async () => {
    const memberToken = await getMemberToken('13900007001');
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ sessionId: 'nonexistent' });
    expect(res.body.code).not.toBe(0);
  });

  it('取消不存在的预约', async () => {
    const memberToken = await getMemberToken('13900007001');
    const res = await request(app).delete('/api/bookings/nonexistent')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).not.toBe(0);
  });
});

describe('出勤边界', () => {
  it('提交非数组出勤', async () => {
    const res = await request(app).post('/api/attendance/nonexistent/submit')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ attendance: 'not-array' });
    expect(res.body.code).not.toBe(0);
  });

  it('教练提交他人课次出勤', async () => {
    const newCoach = await request(app).post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '教练C', phone: '13800009999', password: '123456' });
    const newCoachToken = await request(app).post('/api/auth/coach/login')
      .send({ phone: '13800009999', password: '123456' }).then((r) => r.body.data.token);
    const s = await createTestSession(adminToken, course.id, coach.id, memberId, { date: '2026-12-25', startTime: '16:00', endTime: '17:00' });
    const res = await request(app).post(`/api/attendance/${s.id}/submit`)
      .set('Authorization', `Bearer ${newCoachToken}`)
      .send({ attendance: [{ memberId, status: 'PRESENT' }] });
    expect(res.body.code).not.toBe(0);
  });
});

describe('渠道边界', () => {
  it('缺少必填字段', async () => {
    const res = await request(app).post('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '测试' });
    expect(res.body.code).not.toBe(0);
  });

  it('无效渠道类型', async () => {
    const res = await request(app).post('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '测试', type: 'INVALID' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的父渠道', async () => {
    const res = await request(app).post('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '二级', type: 'ONLINE', parentId: 'nonexistent' });
    expect(res.body.code).not.toBe(0);
  });

  it('无效状态', async () => {
    const listRes = await request(app).get('/api/channels').set('Authorization', `Bearer ${adminToken}`);
    const ch = listRes.body.data.tree[0];
    const res = await request(app).patch(`/api/channels/${ch.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INVALID' });
    expect(res.body.code).not.toBe(0);
  });
});

describe('404 与健康检查', () => {
  it('不存在的接口', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('健康检查', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.code).toBe(0);
  });
});
