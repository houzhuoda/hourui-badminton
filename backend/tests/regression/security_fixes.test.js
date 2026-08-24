// 回归测试：云端测试报告缺陷修复
// 覆盖 P0 安全漏洞 + P1 业务逻辑缺陷 + P2 功能缺口 + P3 观察项
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getAdminToken, createTestMember } from '../helpers.js';
import { createMember } from '../../src/services/member.js';
import { createOrder, refundOrder } from '../../src/services/order.js';
import { createSession } from '../../src/services/session.js';
import { submitAttendance } from '../../src/services/attendance.js';
import { getDb } from '../../src/db/index.js';
import { hashPhone } from '../../src/utils/helpers.js';
import request from 'supertest';
import { app } from '../../src/app.js';

const adminOperator = { id: 'test-admin', type: 'admin', name: '管理员' };
const salesOperator = { id: 'test-sales-1', type: 'sales', name: '测试销售' };

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

function getCourse(businessType = 'PRIVATE') {
  return getDb().prepare('SELECT * FROM courses WHERE business_type = ?').get(businessType);
}

function getCoach() {
  return getDb().prepare('SELECT * FROM coaches LIMIT 1').get();
}

function getSessionPricing(courseId) {
  return getDb().prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ?').get(courseId, 'ACTIVE');
}

// ============ P0-1: 验证码明文返回 ============
describe('SEC-FIX-01: 验证码明文返回修复', () => {
  it('测试/开发环境可返回 demoCode（便于调试）', async () => {
    const res = await request(app).post('/api/auth/member/send-code').send({ phone: '13900000099' });
    expect(res.body.code).toBe(0);
    // 测试环境（NODE_ENV=test）允许返回 demoCode
    expect(res.body.data).toHaveProperty('demoCode');
  });

  it('生产环境不应返回 demoCode', async () => {
    // 直接测试 config.env 条件逻辑
    const { config } = await import('../../src/utils/config.js');
    const originalEnv = config.env;
    config.env = 'production';
    // 重新请求 send-code 路由（路由内读取 config.env）
    const res = await request(app).post('/api/auth/member/send-code').send({ phone: '13900000098' });
    expect(res.body.code).toBe(0);
    expect(res.body.data).not.toHaveProperty('demoCode');
    expect(res.body.data.sent).toBe(true);
    config.env = originalEnv;
  });
});

// ============ P0-2: 管理员弱口令 + 首次登录强制改密 ============
describe('SEC-FIX-02: 管理员首次登录强制改密', () => {
  it('默认管理员登录应返回 mustChangePassword 标记', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('mustChangePassword');
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it('修改密码后 mustChangePassword 应为 false', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    const token = loginRes.body.data.token;
    const res = await request(app)
      .post('/api/auth/admin/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'admin123', newPassword: 'newPass123' });
    expect(res.body.code).toBe(0);

    // 重新登录
    const reLogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'newPass123' });
    expect(reLogin.body.code).toBe(0);
    expect(reLogin.body.data.mustChangePassword).toBe(false);

    // 改回原密码以便后续测试
    await request(app)
      .post('/api/auth/admin/change-password')
      .set('Authorization', `Bearer ${reLogin.body.data.token}`)
      .send({ oldPassword: 'newPass123', newPassword: 'admin123' });
  });
});

// ============ P1-3: 退款不冲销提成 ============
describe('BIZ-FIX-03: 退款后 commission_amount 应清零', () => {
  it('退款后订单 commission_amount 应被清零', () => {
    const member = createMember({ name: '退款冲销测试', phone: '13900007001', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    // 上课产生提成
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-12-10',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, salesOperator);
    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);

    // 确认订单有预估提成
    const dbOrderBefore = getDb().prepare('SELECT commission_amount FROM orders WHERE id = ?').get(order.orderId);
    expect(dbOrderBefore.commission_amount).toBeGreaterThan(0);

    // 退款
    refundOrder(order.orderId, adminOperator, '测试退款冲销');

    // 退款后 commission_amount 应为 0
    const dbOrderAfter = getDb().prepare('SELECT commission_amount, commission_status FROM orders WHERE id = ?').get(order.orderId);
    expect(dbOrderAfter.commission_amount).toBe(0);
    expect(dbOrderAfter.commission_status).toBe('REVERSED');
  });
});

// ============ P1-4: 看板课消数系统性偏差 ============
describe('BIZ-FIX-04: 看板课消数应等于 pack_consumptions 记录数', () => {
  it('monthConsumption 应等于当月 pack_consumptions 记录数', async () => {
    const adminToken = await getAdminToken();
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);

    const dashboardCount = res.body.data.metrics.monthConsumption;
    // 直接查 pack_consumptions 表当月记录数
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const actualCount = getDb().prepare("SELECT COUNT(*) as cnt FROM pack_consumptions WHERE date(created_at) >= ?").get(monthStart).cnt;

    expect(dashboardCount).toBe(actualCount);
  });
});

// ============ P2-5: 会员软删/归档 ============
describe('FEAT-05: 会员软删/归档端点', () => {
  it('DELETE /members/:id 应将会员标记为 ARCHIVED', async () => {
    const adminToken = await getAdminToken();
    const member = await createTestMember(adminToken, { name: '归档测试', phone: '13900007010' });

    const delRes = await request(app).delete(`/api/members/${member.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.body.code).toBe(0);

    // 验证状态为 ARCHIVED
    const dbMember = getDb().prepare('SELECT status FROM members WHERE id = ?').get(member.id);
    expect(dbMember.status).toBe('ARCHIVED');
  });

  it('归档会员不应出现在默认列表中', async () => {
    const adminToken = await getAdminToken();
    const member = await createTestMember(adminToken, { name: '归档列表测试', phone: '13900007011' });
    await request(app).delete(`/api/members/${member.id}`).set('Authorization', `Bearer ${adminToken}`);

    const listRes = await request(app).get('/api/members').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.code).toBe(0);
    const found = listRes.body.data.list.find((m) => m.id === member.id);
    expect(found).toBeUndefined();
  });

  it('归档会员可通过 status=ARCHIVED 筛选查看', async () => {
    const adminToken = await getAdminToken();
    const member = await createTestMember(adminToken, { name: '归档筛选测试', phone: '13900007012' });
    await request(app).delete(`/api/members/${member.id}`).set('Authorization', `Bearer ${adminToken}`);

    const listRes = await request(app).get('/api/members?status=ARCHIVED').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.code).toBe(0);
    const found = listRes.body.data.list.find((m) => m.id === member.id);
    expect(found).toBeDefined();
  });
});

// ============ P2-6: 看板 newMembers 应按当月筛选 ============
describe('BIZ-FIX-06: 看板 newMembers 应按当月且非归档筛选', () => {
  it('newMembers 应等于当月新增且状态非 ARCHIVED 的会员数', async () => {
    const adminToken = await getAdminToken();
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);

    const dashboardCount = res.body.data.metrics.newMembers;
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const actualCount = getDb().prepare("SELECT COUNT(*) as cnt FROM members WHERE created_at >= ? AND status != 'ARCHIVED'").get(monthStart + ' 00:00:00').cnt;

    expect(dashboardCount).toBe(actualCount);
  });
});

// ============ P2-7: 退款金额计算明细 ============
describe('BIZ-FIX-07: 退款应返回金额计算明细', () => {
  it('退款返回值应包含 consumedValue 和 refundAmount 明细', () => {
    const member = createMember({ name: '退款明细测试', phone: '13900007020', categoryCode: 'M_PRIVATE' }, salesOperator);
    const course = getCourse('PRIVATE');
    const sp = getSessionPricing(course.id);

    const order = createOrder({
      memberId: member.id, courseId: course.id, businessType: 'PRIVATE',
      chargeMode: 'SESSION_PACK', sessionPricingId: sp.id, confirmed: true,
    }, salesOperator);

    // 上 1 节课
    const coach = getCoach();
    const session = createSession({
      courseId: course.id, coachId: coach.id, date: '2026-12-10',
      startTime: '10:00', endTime: '11:00', capacity: 1, participantIds: [member.id],
    }, salesOperator);
    submitAttendance(session.id, [{ memberId: member.id, status: 'PRESENT' }], salesOperator);

    const result = refundOrder(order.orderId, adminOperator, '测试退款明细');

    // 应返回明细字段
    expect(result).toHaveProperty('refundAmount');
    expect(result).toHaveProperty('consumedValue');
    expect(result).toHaveProperty('detail');
    expect(result.detail).toHaveProperty('mainConsumedValue');
    expect(result.detail).toHaveProperty('extraConsumedValue');
    expect(result.refundAmount + result.consumedValue).toBe(order.amount);
  });
});

// ============ P3-9: phone_hash 使用 HMAC-SHA256 ============
describe('SEC-FIX-09: phone_hash 使用 HMAC-SHA256', () => {
  it('hashPhone 应产生 HMAC-SHA256 哈希（64位hex）', () => {
    const hash = hashPhone('13900000001');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // 相同输入应产生相同输出（确定性）
    expect(hashPhone('13900000001')).toBe(hash);
    // 不同输入应产生不同输出
    expect(hashPhone('13900000002')).not.toBe(hash);
  });
});
