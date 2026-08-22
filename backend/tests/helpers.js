// 测试辅助：创建临时数据库、获取认证 token、通用请求辅助
import { initDb } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { getDb, resetDbInstance } from '../src/db/index.js';
import { hashPassword, uuid } from '../src/utils/helpers.js';
import request from 'supertest';
import { app } from '../src/app.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

let tmpDbPath = null;

// 每个测试文件前：创建临时数据库并初始化
export async function setupTestDb() {
  tmpDbPath = path.join(os.tmpdir(), `hourui-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  // 如果已有连接，先关闭
  resetDbInstance();
  // 设置环境变量指向临时数据库
  process.env.DB_PATH = tmpDbPath;
  // 重新初始化
  const db = initDb(tmpDbPath);
  seed(db);
  // 不关闭 db，让 getDb 单例使用它
  // 但 initDb 创建的是新连接，需要让 getDb 使用它
  // 简单做法：直接用这个 db 作为单例
  return db;
}

// 每个测试文件后：清理临时数据库
export async function teardownTestDb() {
  resetDbInstance();
  if (tmpDbPath && fs.existsSync(tmpDbPath)) {
    try { fs.unlinkSync(tmpDbPath); } catch {}
  }
  // 清理 WAL/SHM 文件
  for (const ext of ['-wal', '-shm']) {
    const p = tmpDbPath + ext;
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  }
}

// 获取管理员 token
export async function getAdminToken() {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  return res.body.data.token;
}

// 获取销售 token
export async function getSalesToken() {
  const res = await request(app).post('/api/auth/sales/login').send({ phone: '13800000001', password: '123456' });
  return res.body.data.token;
}

// 获取教练 token
export async function getCoachToken() {
  const res = await request(app).post('/api/auth/coach/login').send({ phone: '13800000002', password: '123456' });
  return res.body.data.token;
}

// 获取会员 token
export async function getMemberToken(phone) {
  const res = await request(app).post('/api/auth/member/send-code').send({ phone });
  const loginRes = await request(app).post('/api/auth/member/login').send({ phone, code: '1234' });
  return loginRes.body.data.token;
}

// 创建测试会员并返回 id
export async function createTestMember(token, overrides = {}) {
  const data = {
    name: '测试会员',
    phone: `139${Date.now().toString().slice(-8)}`,
    gender: 'M',
    birthDate: '1990-01-01',
    categoryCode: 'M_PRIVATE',
    ...overrides,
  };
  const res = await request(app).post('/api/members').set('Authorization', `Bearer ${token}`).send(data);
  return res.body.data;
}

// 获取第一门课程的 id
export async function getFirstCourseId(token, businessType = 'PRIVATE') {
  const res = await request(app).get('/api/courses').set('Authorization', `Bearer ${token}`);
  const course = res.body.data.find((c) => c.business_type === businessType);
  return course;
}

// 获取第一个教练 id
export async function getFirstCoachId(token) {
  const res = await request(app).get('/api/coaches').set('Authorization', `Bearer ${token}`);
  return res.body.data[0];
}

// 创建测试订单
export async function createTestOrder(token, memberId, course, overrides = {}) {
  const spRes = await request(app).get(`/api/courses/${course.id}`).set('Authorization', `Bearer ${token}`);
  const sp = spRes.body.data.sessionPricing[0];
  const data = {
    memberId,
    courseId: course.id,
    businessType: course.business_type,
    chargeMode: 'SESSION_PACK',
    sessionPricingId: sp.id,
    confirmed: true,
    ...overrides,
  };
  const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send(data);
  return res.body.data;
}

// 创建测试课次
export async function createTestSession(token, courseId, coachId, memberId, overrides = {}) {
  const data = {
    courseId,
    coachId,
    date: '2026-09-01',
    startTime: '10:00',
    endTime: '11:00',
    capacity: 1,
    participantIds: memberId ? [memberId] : [],
    ...overrides,
  };
  const res = await request(app).post('/api/sessions').set('Authorization', `Bearer ${token}`).send(data);
  return res.body.data;
}
