// 销售视角端到端测试脚本
process.env.NODE_ENV = 'test';
// 模拟销售登录、建档、开单、业绩、提成全流程，检查设计缺陷
import { getDb, initDb } from '../src/db/index.js';
import { hashPassword, uuid, now, formatDate } from '../src/utils/helpers.js';
import { createMember } from '../src/services/member.js';
import { createOrder, refundOrder } from '../src/services/order.js';
import { submitAttendance } from '../src/services/attendance.js';
import request from 'supertest';
import { app } from '../src/app.js';

let pass = 0, fail = 0;
const issues = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail||''}`); issues.push(name); }
}

console.log('\n========== 销售视角端到端测试 ==========\n');

// 使用内存数据库并清理
initDb(':memory:');
const db = getDb();

// ============ 准备基础数据 ============
console.log('【准备测试数据】');
const adminId = uuid();
db.prepare("INSERT INTO admins (id, username, password_hash, name, status) VALUES (?, 'admin', ?, '管理员', 'ACTIVE')")
  .run(adminId, hashPassword('admin123'));

const venueId = uuid();
db.prepare("INSERT INTO venues (id, name, code, is_default, status) VALUES (?, '测试场馆', 'TEST', 1, 'ACTIVE')").run(venueId);

const salesId = uuid();
db.prepare("INSERT INTO sales (id, phone, password_hash, name, status) VALUES (?, '13800000001', ?, '张销售', 'ACTIVE')")
  .run(salesId, hashPassword('123456'));

const salesId2 = uuid();
db.prepare("INSERT INTO sales (id, phone, password_hash, name, status) VALUES (?, '13800000009', ?, '李销售', 'ACTIVE')")
  .run(salesId2, hashPassword('123456'));

const coachId = uuid();
db.prepare("INSERT INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status) VALUES (?, '13800000002', ?, '李教练', 'PRIVATE', 1, 'ACTIVE')")
  .run(coachId, hashPassword('123456'));
db.prepare("INSERT INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission) VALUES (?, ?, 'PRIVATE', 300, 30, 0)").run(uuid(), coachId);
db.prepare("INSERT INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission) VALUES (?, ?, 'ADULT_GROUP', 100, 20, 0)").run(uuid(), coachId);

// 提成规则
db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'PRIVATE', 'NEW', 5, 'ACTIVE')").run(uuid());
db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'PRIVATE', 'RENEW', 3, 'ACTIVE')").run(uuid());
db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'ADULT_GROUP', 'NEW', 4, 'ACTIVE')").run(uuid());
db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'ADULT_GROUP', 'RENEW', 2, 'ACTIVE')").run(uuid());

// 课程
const coursePrivate = uuid();
db.prepare("INSERT INTO courses (id, name, business_type, standard_price, status) VALUES (?, '私教课', 'PRIVATE', 400, 'ACTIVE')").run(coursePrivate);
const spPrivate = uuid();
db.prepare("INSERT INTO course_session_pricing (id, course_id, sessions, gift_sessions, price, status) VALUES (?, ?, 10, 0, 6000, 'ACTIVE')").run(spPrivate, coursePrivate);

const courseAdult = uuid();
db.prepare("INSERT INTO courses (id, name, business_type, standard_price, status) VALUES (?, '成人大课', 'ADULT_GROUP', 150, 'ACTIVE')").run(courseAdult);
const spAdult = uuid();
db.prepare("INSERT INTO course_session_pricing (id, course_id, sessions, gift_sessions, price, status) VALUES (?, ?, 10, 0, 1200, 'ACTIVE')").run(spAdult, courseAdult);

const courseCommunity = uuid();
db.prepare("INSERT INTO courses (id, name, business_type, standard_price, status) VALUES (?, '群活动', 'COMMUNITY', 80, 'ACTIVE')").run(courseCommunity);

const salesOperator = { id: salesId, type: 'sales', name: '张销售' };
const coachOperator = { id: coachId, type: 'coach', name: '李教练' };

console.log('  基础数据准备完成\n');

// ============ 测试1：销售登录 ============
console.log('【测试1】销售登录');
const loginRes = await request(app).post('/api/auth/sales/login').send({ phone: '13800000001', password: '123456' });
check('销售登录成功', loginRes.body.code === 0, `实际:${loginRes.body.message}`);
check('销售登录返回token', !!loginRes.body.data?.token, '缺少token');
const salesToken = loginRes.body.data?.token;
console.log('');

// ============ 测试2：销售工作台 ============
console.log('【测试2】销售工作台 /sales/dashboard');
const dashboardRes = await request(app).get('/api/sales/dashboard').set('Authorization', `Bearer ${salesToken}`);
check('工作台可访问', dashboardRes.body.code === 0, `实际:${dashboardRes.body.message}`);
check('工作台有今日数据', dashboardRes.body.data?.today !== undefined, '缺少今日数据');
check('工作台有本月数据', dashboardRes.body.data?.month !== undefined, '缺少本月数据');
console.log('');

// ============ 测试3：销售建档 ============
console.log('【测试3】销售建档 /members');
const member = createMember({ name: '销售测试会员', phone: '13600099001', categoryCode: 'M_PRIVATE' }, salesOperator);
check('销售建档成功', !!member?.id, '');
check('建档人记录为销售', member?.creator_type === 'sales' && member?.creator_id === salesId, '建档人错误');
console.log('');

// ============ 测试4：销售只能看自己建的会员 ============
console.log('【测试4】销售查看会员列表（权限隔离）');
// 另一个销售建档
const member2 = createMember({ name: '其他销售会员', phone: '13600099002', categoryCode: 'M_PRIVATE' }, { id: salesId2, type: 'sales', name: '李销售' });
const listRes = await request(app).get('/api/members').set('Authorization', `Bearer ${salesToken}`);
check('销售可查看会员列表', listRes.body.code === 0, `实际:${listRes.body.message}`);
const listMemberIds = listRes.body.data?.list?.map((m) => m.id) || [];
check('销售列表只包含自己的会员', listMemberIds.includes(member.id) && !listMemberIds.includes(member2.id), `看到自己的:${listMemberIds.includes(member.id)}, 看到别人的:${listMemberIds.includes(member2.id)}`);
console.log('');

// ============ 测试5：销售开单（次卡） ============
console.log('【测试5】销售开单（次卡）');
const order1 = createOrder({
  memberId: member.id, courseId: coursePrivate, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spPrivate, confirmed: true,
}, salesOperator);
check('次卡开单成功', !!order1?.orderId, '');
check('开单人为销售', order1?.salesId === salesId, `实际:${order1?.salesId}`);
console.log('');

// ============ 测试6：销售开单（大课） ============
console.log('【测试6】销售开单（大课）');
const order2 = createOrder({
  memberId: member.id, courseId: courseAdult, businessType: 'ADULT_GROUP',
  chargeMode: 'SESSION_PACK', sessionPricingId: spAdult, confirmed: true,
}, salesOperator);
check('大课开单成功', !!order2?.orderId, '');
console.log('');

// ============ 测试7：销售工作台应统计开单金额 ============
console.log('【测试7】销售工作台统计');
const dashboardRes2 = await request(app).get('/api/sales/dashboard').set('Authorization', `Bearer ${salesToken}`);
const today = dashboardRes2.body.data?.today;
check('今日开单数>0', today?.order_count >= 2, `实际:${today?.order_count}`);
check('今日开单金额>0', today?.total_amount > 0, `实际:${today?.total_amount}`);
console.log('');

// ============ 测试8：销售业绩明细 ============
console.log('【测试8】销售业绩明细 /sales/performance');
const perfRes = await request(app).get('/api/sales/performance').set('Authorization', `Bearer ${salesToken}`);
check('业绩明细可访问', perfRes.body.code === 0, `实际:${perfRes.body.message}`);
check('业绩有订单明细', perfRes.body.data?.list?.length >= 2, `实际:${perfRes.body.data?.list?.length}`);
check('业绩合计金额正确', perfRes.body.data?.summary?.totalAmount === (order1.amount + order2.amount), `实际:${perfRes.body.data?.summary?.totalAmount}`);
console.log('');

// ============ 测试9：销售提成统计（课后计提） ============
console.log('【测试9】销售提成（课后计提模式）');
// 创建大课课次并出勤
const sessionDate = formatDate();
const sessionAdult = uuid();
db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) VALUES (?, ?, ?, 'ADULT_GROUP', ?, '19:00', '20:00', 20, 0, 'SCHEDULED', ?, ?)`)
  .run(sessionAdult, courseAdult, coachId, sessionDate, now(), now());
db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
  .run(uuid(), sessionAdult, member.id, now(), now());

// 检查会员资产
const memberPacks = db.prepare("SELECT id, pack_type, business_type, remaining_sessions, status, valid_until FROM packs WHERE member_id = ?").all(member.id);
console.log('  会员课包:', JSON.stringify(memberPacks));

const attResult = submitAttendance(sessionAdult, [{ memberId: member.id, status: 'PRESENT' }], coachOperator);
console.log('  出勤结果:', JSON.stringify(attResult?.results));

// 此时应有销售提成记录
const commissionRes = await request(app).get('/api/commissions/mine').set('Authorization', `Bearer ${salesToken}`);
check('我的提成可访问', commissionRes.body.code === 0, `实际:${commissionRes.body.message}`);
const commissionRecords = commissionRes.body.data?.list || [];
check('出勤后产生销售提成记录', commissionRecords.length > 0, `实际:${commissionRecords.length}条`);

// 检查工作台提成显示
const dashboardRes3 = await request(app).get('/api/sales/dashboard').set('Authorization', `Bearer ${salesToken}`);
const today3 = dashboardRes3.body.data?.today;
check('工作台显示今日提成', today3?.commission !== undefined, `实际:${today3?.commission}`);
console.log('');

// ============ 测试10：销售退单后提成回滚 ============
console.log('【测试10】销售退单后提成回滚');
const beforeRefund = commissionRecords.length;
refundOrder(order2.orderId, { id: adminId, type: 'admin', name: '管理员' }, '测试退费');
const afterRefundRes = await request(app).get('/api/commissions/mine').set('Authorization', `Bearer ${salesToken}`);
const afterRefundRecords = afterRefundRes.body.data?.list || [];
check('退费后提成记录被回滚', afterRefundRecords.every((r) => r.status === 'REVERSED'), `实际:${afterRefundRecords.map(r=>r.status).join(',')}`);
console.log('');

// ============ 测试11：大额订单二次确认 ============
console.log('【测试11】大额订单二次确认');
const largeOrder = await request(app).post('/api/orders').set('Authorization', `Bearer ${salesToken}`).send({
  memberId: member.id, courseId: coursePrivate, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spPrivate,
});
check('大额订单提示需二次确认', largeOrder.body.data?.needConfirm === true, `实际:${JSON.stringify(largeOrder.body.data)}`);
console.log('');

// ============ 测试12：教练带销售能力开单 ============
console.log('【测试12】教练带销售能力开单');
const coachLoginRes = await request(app).post('/api/auth/coach/login').send({ phone: '13800000002', password: '123456' });
const coachToken = coachLoginRes.body.data?.token;
// 教练需为自己建档的会员开单
const coachMember = createMember({ name: '教练测试会员', phone: '13600099003', categoryCode: 'M_PRIVATE' }, coachOperator);
const coachOrder = await request(app).post('/api/orders').set('Authorization', `Bearer ${coachToken}`).send({
  memberId: coachMember.id, courseId: coursePrivate, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spPrivate, confirmed: true,
});
check('教练可开单', coachOrder.body.code === 0, `实际:${coachOrder.body.message}`);
console.log('');

// ============ 设计缺陷分析 ============
console.log('\n========== 设计缺陷分析 ==========');
console.log('');

// 缺陷1：工作台/业绩提成是否显示实际提成（出勤后、退费后重新获取）
const perfAfterAtt = await request(app).get('/api/sales/performance').set('Authorization', `Bearer ${salesToken}`);
const perfCommission = perfAfterAtt.body.data?.summary?.actualCommission || 0;
const estimatedCommission = perfAfterAtt.body.data?.summary?.estimatedCommission || 0;
// 重新获取提成记录（退费后已回滚）
const commissionAfterRefund = await request(app).get('/api/commissions/mine').set('Authorization', `Bearer ${salesToken}`);
const actualCommission = (commissionAfterRefund.body.data?.list || []).reduce((s, r) => s + (r.status === 'ACTIVE' ? r.amount : 0), 0);
if (perfCommission !== actualCommission) {
  console.log('【缺陷1】工作台/业绩提成显示与实际不一致');
  console.log(`  业绩接口预估提成: ${estimatedCommission}`);
  console.log(`  业绩接口实际提成: ${perfCommission}`);
  console.log(`  commission_records 实际: ${actualCommission}`);
} else {
  console.log(`【已修复】业绩提成显示实际课后计提金额（预估${estimatedCommission}，实际${actualCommission}）`);
}

// 缺陷2：销售能否看到所有课程和定价
const courseListRes = await request(app).get('/api/courses').set('Authorization', `Bearer ${salesToken}`);
if (courseListRes.body.code !== 0 || !courseListRes.body.data?.length) {
  console.log('【缺陷2】销售无法查看课程列表，影响开单');
  console.log(`  实际: ${courseListRes.body.message}`);
} else {
  console.log('【无缺陷】销售可查看课程列表');
}

// 缺陷3：退款后销售业绩未扣减
const perfAfterRefund = await request(app).get('/api/sales/performance').set('Authorization', `Bearer ${salesToken}`);
const afterRefundTotal = perfAfterRefund.body.data?.summary?.totalAmount || 0;
if (afterRefundTotal >= order1.amount + order2.amount) {
  console.log('【缺陷3】退费后销售业绩未扣减');
  console.log(`  退费前业绩金额: ${order1.amount + order2.amount}`);
  console.log(`  退费后业绩金额: ${afterRefundTotal}（未扣减退费）`);
} else {
  console.log('【无缺陷】退费后业绩金额已扣减');
}

// 缺陷4：销售创建订单时课程下拉是否支持搜索/筛选
console.log('【建议】销售开单页面若课程多，建议增加搜索和分类筛选，提升效率');

// 缺陷5：销售能否为非同一人建档的会员开单
const otherMemberOrder = await request(app).post('/api/orders').set('Authorization', `Bearer ${salesToken}`).send({
  memberId: member2.id, courseId: coursePrivate, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spPrivate, confirmed: true,
});
if (otherMemberOrder.body.code === 0) {
  console.log('【缺陷4】销售可为其他销售建档的会员开单');
} else {
  console.log('【已修复】销售不能为其他销售建档的会员开单:', otherMemberOrder.body.message);
}

// ============ 测试汇总 ============
console.log('\n========== 测试汇总 ==========');
console.log(`通过: ${pass}, 失败: ${fail}`);
if (issues.length > 0) {
  console.log('失败项:', issues.join(', '));
}
console.log('');
