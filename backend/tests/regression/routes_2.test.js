// 路由层补充测试：看板/报表/会员端/课程低分支
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb, getAdminToken, getMemberToken } from '../helpers.js';

let adminToken, memberToken;

beforeAll(async () => {
  await setupTestDb();
  adminToken = await getAdminToken();
  const m = await request(app).post('/api/members').set('Authorization', `Bearer ${adminToken}`).send({ name: '会员A', phone: '13900030001', categoryCode: 'M_PRIVATE' });
  await request(app).post('/api/auth/member/send-code').send({ phone: '13900030001' });
  const login = await request(app).post('/api/auth/member/login').send({ phone: '13900030001', code: '1234' });
  memberToken = login.body.data.token;
});

afterAll(async () => { await teardownTestDb(); });

describe('看板路由分支', () => {
  it('不同 range 参数', async () => {
    for (const r of ['today', '7d', '30d', 'month']) {
      const res = await request(app).get(`/api/dashboard?range=${r}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.code).toBe(0);
    }
  });

  it('无效 range 使用默认值', async () => {
    const res = await request(app).get('/api/dashboard?range=bad').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });
});

describe('报表路由分支', () => {
  it('不同报表不同范围', async () => {
    for (const r of ['coach', 'sales', 'consumption', 'channel']) {
      const res = await request(app).get(`/api/reports/${r}?startDate=2026-08-01&endDate=2026-08-31`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.code).toBe(0);
    }
  });

  it('缺少日期使用默认值', async () => {
    const res = await request(app).get('/api/reports/coach').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
  });

  it('不存在报表类型', async () => {
    const res = await request(app).get('/api/reports/unknown?startDate=2026-08-01&endDate=2026-08-31').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('会员端路由分支', () => {
  it('我的资产', async () => {
    const res = await request(app).get('/api/member-end/my-assets').set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('我的消费', async () => {
    const res = await request(app).get('/api/member-end/my-consumption').set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('我的出勤', async () => {
    const res = await request(app).get('/api/member-end/my-attendance').set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('会员端配置', async () => {
    const res = await request(app).get('/api/member-end/config').set('Authorization', `Bearer ${memberToken}`);
    expect(res.body.code).toBe(0);
  });

  it('修改会员端配置（非管理员拦截）', async () => {
    const res = await request(app).put('/api/member-end/config').set('Authorization', `Bearer ${memberToken}`).send({});
    expect(res.status).toBe(403);
  });
});

describe('课程路由补充', () => {
  it('课程列表带业务过滤', async () => {
    for (const bt of ['PRIVATE', 'ADULT_GROUP']) {
      const res = await request(app).get(`/api/courses?businessType=${bt}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.code).toBe(0);
    }
  });

  it('修改不存在课程', async () => {
    const res = await request(app).put('/api/courses/nonexistent').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});
