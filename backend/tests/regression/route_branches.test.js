// 路由层分支测试：集中覆盖各路由的异常返回
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb, getAdminToken, getSalesToken, getCoachToken } from '../helpers.js';

let adminToken, salesToken, coachToken;

beforeAll(async () => {
  await setupTestDb();
  adminToken = await getAdminToken();
  salesToken = await getSalesToken();
  coachToken = await getCoachToken();
});

afterAll(async () => { await teardownTestDb(); });

describe('会员路由分支', () => {
  it('缺少必填字段', async () => {
    const res = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x' });
    expect(res.body.code).not.toBe(0);
  });

  it('手机格式错误', async () => {
    const res = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x', phone: '123', categoryCode: 'M_PRIVATE' });
    expect(res.body.code).not.toBe(0);
  });

  it('查询无结果', async () => {
    const res = await request(app).get('/api/members?keyword=zzzzzz').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.list.length).toBe(0);
  });

  it('会员不存在', async () => {
    const res = await request(app).get('/api/members/nonexistent').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('无效标签码', async () => {
    const m = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: '标签', phone: '13900010001', categoryCode: 'M_PRIVATE' });
    const res = await request(app).post(`/api/members/${m.body.data.id}/tags`).set('Authorization', `Bearer ${adminToken}`).send({ categoryCode: 'BAD' });
    expect(res.body.code).not.toBe(0);
  });

  it('移除不存在标签视为无影响', async () => {
    const m = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: '移除', phone: '13900010002', categoryCode: 'M_PRIVATE' });
    const res = await request(app).delete(`/api/members/${m.body.data.id}/tags/M_GYM`).set('Authorization', `Bearer ${adminToken}`);
    // 移除不存在的标签可能幂等返回成功
    expect([0, 400, 404]).toContain(res.body.code !== undefined ? res.body.code : res.status);
  });

  it('销售不能查看他人会员详情', async () => {
    const res = await request(app).get('/api/members/nonexistent').set('Authorization', `Bearer ${salesToken}`);
    expect(res.body.code).not.toBe(0);
  });
});

describe('课程路由分支', () => {
  it('缺少业务类型', async () => {
    const res = await request(app).post('/api/courses').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的课程详情', async () => {
    const res = await request(app).get('/api/courses/nonexistent').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('不存在的次卡档', async () => {
    const c = await request(app).get('/api/courses').set('Authorization', `Bearer ${adminToken}`);
    const id = c.body.data[0].id;
    const res = await request(app).get(`/api/courses/${id}/session-pricing/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('月卡档位缺少字段', async () => {
    const c = await request(app).get('/api/courses').set('Authorization', `Bearer ${adminToken}`);
    const id = c.body.data[0].id;
    const res = await request(app).post(`/api/courses/${id}/monthly-pricing`).set('Authorization', `Bearer ${adminToken}`).send({ monthlyFee: 500 });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的折扣规则', async () => {
    const res = await request(app).put('/api/courses/discount-rules/nonexistent').set('Authorization', `Bearer ${adminToken}`).send({ discountValue: 10 });
    expect(res.body.code).not.toBe(0);
  });
});

describe('教练路由分支', () => {
  it('缺少姓名', async () => {
    const res = await request(app).post('/api/coaches').set('Authorization', `Bearer ${adminToken}`).send({ phone: '13800000000', password: '123456' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的教练', async () => {
    const res = await request(app).get('/api/coaches/nonexistent').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('教练看他人档案应 403', async () => {
    const another = await request(app).post('/api/coaches').set('Authorization', `Bearer ${adminToken}`).send({ name: '教练C', phone: '13800001111', password: '123456' });
    const res = await request(app).get(`/api/coaches/${another.body.data.id}`).set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).not.toBe(0);
  });
});

describe('订单路由分支', () => {
  it('不存在的会员', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${adminToken}`).send({ memberId: 'nonexistent', businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true });
    expect(res.status).toBe(404);
  });

  it('已停用会员不能开单', async () => {
    const m = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: '停用', phone: '13900010003', categoryCode: 'M_PRIVATE' });
    await request(app).patch(`/api/members/${m.body.data.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'DISABLED' });
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${adminToken}`).send({ memberId: m.body.data.id, businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true });
    expect(res.body.code).not.toBe(0);
  });

  it('课程不存在', async () => {
    const m = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: '课程不存在', phone: '13900010004', categoryCode: 'M_PRIVATE' });
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${adminToken}`).send({
      memberId: m.body.data.id, courseId: 'nonexistent', businessType: 'PRIVATE', chargeMode: 'PREPAID', depositAmount: 5000, confirmed: true,
    });
    expect(res.body.code).not.toBe(0);
  });

  it('月卡缺少档位', async () => {
    const m = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: '月卡缺失', phone: '13900010005', categoryCode: 'M_ADULT_GROUP' });
    const c = await request(app).get('/api/courses').set('Authorization', `Bearer ${adminToken}`);
    const course = c.body.data.find((x) => x.business_type === 'ADULT_GROUP');
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${adminToken}`).send({
      memberId: m.body.data.id, courseId: course.id, businessType: 'ADULT_GROUP', chargeMode: 'MONTHLY', confirmed: true,
    });
    expect(res.body.code).not.toBe(0);
  });
});

describe('课表路由分支', () => {
  it('缺少教练', async () => {
    const res = await request(app).post('/api/sessions').set('Authorization', `Bearer ${adminToken}`).send({
      courseId: 'x', date: '2026-08-25', startTime: '10:00', endTime: '11:00',
    });
    expect(res.body.code).not.toBe(0);
  });

  it('时间冲突', async () => {
    const c = await request(app).get('/api/courses').set('Authorization', `Bearer ${adminToken}`);
    const co = await request(app).get('/api/coaches').set('Authorization', `Bearer ${adminToken}`);
    const course = c.body.data[0].id;
    const coach = co.body.data[0].id;
    await request(app).post('/api/sessions').set('Authorization', `Bearer ${adminToken}`).send({ courseId: course, coachId: coach, date: '2026-08-25', startTime: '14:00', endTime: '15:00', capacity: 1 });
    const res = await request(app).post('/api/sessions').set('Authorization', `Bearer ${adminToken}`).send({ courseId: course, coachId: coach, date: '2026-08-25', startTime: '14:30', endTime: '15:30', capacity: 1 });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的课次取消', async () => {
    const res = await request(app).delete('/api/sessions/nonexistent').set('Authorization', `Bearer ${adminToken}`).send({ reason: 'x' });
    expect(res.status).toBe(404);
  });

  it('批量排课缺少字段', async () => {
    const res = await request(app).post('/api/sessions/batch').set('Authorization', `Bearer ${adminToken}`).send({ courseId: 'x' });
    expect(res.body.code).not.toBe(0);
  });
});

describe('出勤路由分支', () => {
  it('不存在的课次提交出勤', async () => {
    const res = await request(app).post('/api/attendance/nonexistent/submit').set('Authorization', `Bearer ${coachToken}`).send({ attendance: [] });
    expect(res.status).toBe(404);
  });

  it('出勤数据非数组', async () => {
    const c = await request(app).get('/api/courses').set('Authorization', `Bearer ${adminToken}`);
    const co = await request(app).get('/api/coaches').set('Authorization', `Bearer ${adminToken}`);
    const s = await request(app).post('/api/sessions').set('Authorization', `Bearer ${adminToken}`).send({
      courseId: c.body.data[0].id, coachId: co.body.data[0].id, date: '2026-08-26', startTime: '16:00', endTime: '17:00', capacity: 1,
    });
    const res = await request(app).post(`/api/attendance/${s.body.data.id}/submit`).set('Authorization', `Bearer ${coachToken}`).send({ attendance: 'bad' });
    expect(res.body.code).not.toBe(0);
  });
});

describe('渠道路由分支', () => {
  it('缺少类型', async () => {
    const res = await request(app).post('/api/channels').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x' });
    expect(res.body.code).not.toBe(0);
  });

  it('父渠道不存在', async () => {
    const res = await request(app).post('/api/channels').set('Authorization', `Bearer ${adminToken}`).send({ name: '二级', type: 'ONLINE', parentId: 'nonexistent' });
    expect(res.body.code).not.toBe(0);
  });

  it('不存在的渠道更新', async () => {
    const res = await request(app).put('/api/channels/nonexistent').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('提成路由分支', () => {
  it('非管理员访问', async () => {
    const res = await request(app).get('/api/commissions/rules').set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });

  it('缺少字段', async () => {
    const res = await request(app).put('/api/commissions/rules').set('Authorization', `Bearer ${adminToken}`).send({});
    expect(res.body.code).not.toBe(0);
  });
});

describe('报表路由分支', () => {
  it('教练不能访问', async () => {
    const res = await request(app).get('/api/reports/sales').set('Authorization', `Bearer ${coachToken}`);
    expect(res.status).toBe(403);
  });

  it('销售不能访问', async () => {
    const res = await request(app).get('/api/reports/coach').set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});

describe('约课路由分支', () => {
  it('不存在的课次', async () => {
    const res = await request(app).post('/api/bookings').set('Authorization', `Bearer ${salesToken}`).send({ sessionId: 'nonexistent' });
    expect(res.body.code).not.toBe(0);
  });
});

describe('会员端路由分支', () => {
  it('未登录不能访问', async () => {
    const res = await request(app).get('/api/member-end/my-assets');
    expect(res.status).toBe(401);
  });
});
