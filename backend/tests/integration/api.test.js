// 集成测试：API 端到端（认证、会员、订单、出勤全流程）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb, getAdminToken, getCoachToken } from '../helpers.js';

let adminToken, coachToken;
let memberId, courseId, coachId, sessionId, packId;

beforeAll(async () => {
  await setupTestDb();
  adminToken = await getAdminToken();
  coachToken = await getCoachToken();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('认证 API', () => {
  it('管理员登录成功', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeTruthy();
  });

  it('管理员登录失败（密码错误）', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('教练登录成功', async () => {
    const res = await request(app).post('/api/auth/coach/login').send({ phone: '13800000002', password: '123456' });
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeTruthy();
  });

  it('会员登录（模拟验证码）', async () => {
    // 先建档
    const createRes = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '会员登录测试', phone: '13900004001', categoryCode: 'M_PRIVATE' });
    const sendRes = await request(app).post('/api/auth/member/send-code').send({ phone: '13900004001' });
    expect(sendRes.body.data.demoCode).toBe('1234');
    const loginRes = await request(app).post('/api/auth/member/login').send({ phone: '13900004001', code: '1234' });
    expect(loginRes.body.code).toBe(0);
    expect(loginRes.body.data.token).toBeTruthy();
  });

  it('未建档手机号登录应提示', async () => {
    const res = await request(app).post('/api/auth/member/login').send({ phone: '19999999999', code: '1234' });
    expect(res.body.code).not.toBe(0);
  });

  it('无 token 访问应 401', async () => {
    const res = await request(app).get('/api/members');
    expect(res.status).toBe(401);
  });
});

describe('会员 API 全流程', () => {
  it('建档 → 查询 → 详情', async () => {
    // 建档
    const createRes = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'API测试会员', phone: '13900004002', gender: 'F', birthDate: '1995-05-05', categoryCode: 'M_PRIVATE' });
    expect(createRes.status).toBe(201);
    memberId = createRes.body.data.id;
    expect(memberId).toBeTruthy();

    // 查询
    const listRes = await request(app).get('/api/members?keyword=13900004002')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.data.list.length).toBe(1);

    // 详情
    const detailRes = await request(app).get(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.body.data.name).toBe('API测试会员');
    expect(detailRes.body.data.tags).toContain('M_PRIVATE');
  });

  it('重复建档应拦截', async () => {
    const res = await request(app).post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '重复', phone: '13900004002', categoryCode: 'M_PRIVATE' });
    expect(res.body.code).not.toBe(0);
  });

  it('手动增删标签', async () => {
    const addRes = await request(app).post(`/api/members/${memberId}/tags`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryCode: 'M_GYM', reason: '测试添加' });
    expect(addRes.body.code).toBe(0);

    const delRes = await request(app).delete(`/api/members/${memberId}/tags/M_GYM`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '测试移除' });
    expect(delRes.body.code).toBe(0);
  });
});

describe('订单 API 全流程', () => {
  it('获取课程列表', async () => {
    const res = await request(app).get('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.length).toBe(7);
    courseId = res.body.data.find((c) => c.business_type === 'PRIVATE').id;
  });

  it('次卡开单', async () => {
    const courseRes = await request(app).get(`/api/courses/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const spId = courseRes.body.data.sessionPricing[0].id;

    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId, courseId, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: spId, confirmed: true });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBeGreaterThan(0);
    packId = res.body.data.packId;
  });

  it('订单列表', async () => {
    const res = await request(app).get('/api/orders?memberId=' + memberId)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.list.length).toBeGreaterThan(0);
  });
});

describe('课表与出勤 API 全流程', () => {
  it('排课', async () => {
    const coachRes = await request(app).get('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`);
    coachId = coachRes.body.data[0].id;

    const res = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId, coachId, date: '2026-11-01', startTime: '14:00', endTime: '15:00', capacity: 1, participantIds: [memberId] });
    expect(res.status).toBe(201);
    sessionId = res.body.data.id;
  });

  it('教练提交出勤', async () => {
    const res = await request(app).post(`/api/attendance/${sessionId}/submit`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ attendance: [{ memberId, status: 'PRESENT' }] });
    expect(res.body.code).toBe(0);
    expect(res.body.data.results[0].status).toBe('PRESENT');
  });

  it('教练查看本人课表', async () => {
    const res = await request(app).get('/api/sessions')
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.every((s) => s.coach_id === coachId)).toBe(true);
  });
});

describe('经营看板 API', () => {
  it('看板数据', async () => {
    const res = await request(app).get('/api/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.metrics.todayIncome).toBeDefined();
    expect(res.body.data.trend).toBeDefined();
  });
});

describe('统计报表 API', () => {
  it('教练上课报表', async () => {
    const res = await request(app).get('/api/reports/coach')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('销售业绩报表', async () => {
    const res = await request(app).get('/api/reports/sales')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('渠道获客报表', async () => {
    const res = await request(app).get('/api/reports/channel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('渠道来源 API', () => {
  it('渠道列表（树形）', async () => {
    const res = await request(app).get('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.tree.length).toBeGreaterThan(0);
  });

  it('新增二级渠道', async () => {
    const listRes = await request(app).get('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`);
    const parent = listRes.body.data.tree.find((c) => c.name === '线上广告');

    const res = await request(app).post('/api/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '快手', type: 'ONLINE', parentId: parent.id });
    expect(res.status).toBe(201);
    expect(res.body.data.level).toBe(2);
  });
});

describe('提成设置 API', () => {
  it('获取提成矩阵', async () => {
    const res = await request(app).get('/api/commissions/rules')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.matrix).toBeDefined();
  });

  it('设置提成比例', async () => {
    const res = await request(app).put('/api/commissions/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rules: [{ businessType: 'PRIVATE', commissionType: 'NEW', rate: 15 }] });
    expect(res.body.code).toBe(0);
  });
});
