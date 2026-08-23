// 销售管理 API 测试
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb, getAdminToken, getSalesToken } from '../helpers.js';

let adminToken;

beforeAll(async () => {
  await setupTestDb();
  adminToken = await getAdminToken();
});

afterAll(async () => { await teardownTestDb(); });

describe('销售管理 API', () => {
  it('列表', async () => {
    const res = await request(app).get('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.list.length).toBeGreaterThan(0);
  });

  it('新增销售', async () => {
    const res = await request(app).post('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`).send({ name: '新销售', phone: '13800003333', password: '123456' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('新销售');
  });

  it('新增销售手机号重复', async () => {
    const res = await request(app).post('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`).send({ name: '重复', phone: '13800003333', password: '123456' });
    expect(res.body.code).not.toBe(0);
  });

  it('销售手机号不能与已有教练手机号重复', async () => {
    const res = await request(app).post('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`).send({ name: '冲突销售', phone: '13800000002', password: '123456' });
    expect(res.body.code).not.toBe(0);
    expect(res.body.message).toContain('教练');
  });

  it('新增销售缺少字段', async () => {
    const res = await request(app).post('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`).send({ name: '缺字段' });
    expect(res.body.code).not.toBe(0);
  });

  it('编辑销售', async () => {
    const list = await request(app).get('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`);
    const id = list.body.data.list[0].id;
    const res = await request(app).put(`/api/sales-admin/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: '改名' });
    expect(res.body.code).toBe(0);
    expect(res.body.data.name).toBe('改名');
  });

  it('停用/启用', async () => {
    const list = await request(app).get('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`);
    const id = list.body.data.list[0].id;
    const r1 = await request(app).patch(`/api/sales-admin/${id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'DISABLED' });
    expect(r1.body.code).toBe(0);
    const r2 = await request(app).patch(`/api/sales-admin/${id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACTIVE' });
    expect(r2.body.code).toBe(0);
  });

  it('重置密码', async () => {
    const list = await request(app).get('/api/sales-admin').set('Authorization', `Bearer ${adminToken}`);
    const id = list.body.data.list[0].id;
    const res = await request(app).patch(`/api/sales-admin/${id}/reset-password`).set('Authorization', `Bearer ${adminToken}`).send({ password: 'newpass' });
    expect(res.body.code).toBe(0);
  });

  it('非管理员不能访问', async () => {
    const salesToken = await getSalesToken();
    const res = await request(app).get('/api/sales-admin').set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});
