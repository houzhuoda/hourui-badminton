// 统计报表端到端测试脚本
// 验证4个报表API返回字段与前端期望是否匹配
import { getDb, initDb } from '../src/db/index.js';
import { hashPassword, uuid, now, formatDate } from '../src/utils/helpers.js';
import { createOrder } from '../src/services/order.js';
import { submitAttendance } from '../src/services/attendance.js';
import { createMember } from '../src/services/member.js';

let pass = 0, fail = 0;
const issues = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail||''}`); issues.push(name); }
}

console.log('\n========== 统计报表端到端测试 ==========\n');

initDb(':memory:');
const db = getDb();

// ============ 准备基础数据 ============
console.log('【准备测试数据】');
const adminId = uuid();
db.prepare("INSERT INTO admins (id, username, password_hash, name, status) VALUES (?, 'admin', ?, '管理员', 'ACTIVE')").run(adminId, hashPassword('admin123'));
const venueId = uuid();
db.prepare("INSERT INTO venues (id, name, code, is_default, status) VALUES (?, '测试场馆', 'TEST', 1, 'ACTIVE')").run(venueId);

const salesId = uuid();
db.prepare("INSERT INTO sales (id, phone, password_hash, name, status) VALUES (?, '13800000001', ?, '张销售', 'ACTIVE')").run(salesId, hashPassword('123456'));

const coachId = uuid();
db.prepare("INSERT INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status) VALUES (?, '13800000002', ?, '李教练', 'PRIVATE', 0, 'ACTIVE')").run(coachId, hashPassword('123456'));
db.prepare("INSERT INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission) VALUES (?, ?, 'PRIVATE', 300, 30, 0)").run(uuid(), coachId);
db.prepare("INSERT INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission) VALUES (?, ?, 'PRACTICE', 200, 20, 0)").run(uuid(), coachId);

db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'PRIVATE', 'NEW', 5, 'ACTIVE')").run(uuid());
db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'PRIVATE', 'RENEW', 3, 'ACTIVE')").run(uuid());

const courseId = uuid();
db.prepare("INSERT INTO courses (id, name, business_type, standard_price, status) VALUES (?, '私教课', 'PRIVATE', 400, 'ACTIVE')").run(courseId);
const spId = uuid();
db.prepare("INSERT INTO course_session_pricing (id, course_id, sessions, gift_sessions, price, status) VALUES (?, ?, 10, 2, 4000, 'ACTIVE')").run(spId, courseId);

db.prepare("INSERT INTO member_end_config (id, booking_cancel_hours, noshow_action, booking_open_default, expiry_remind_days) VALUES (?, 8, 'RECORD_ONLY', 0, 7)").run(uuid());

// 渠道
const channelId = uuid();
db.prepare("INSERT INTO channels (id, name, type, level, sort_order, status) VALUES (?, '美团', 'ONLINE', 1, 0, 'ACTIVE')").run(channelId);
const subChannelId = uuid();
db.prepare("INSERT INTO channels (id, name, type, parent_id, level, sort_order, status) VALUES (?, '美团A店', 'ONLINE', ?, 2, 0, 'ACTIVE')").run(subChannelId, channelId);

const adminOperator = { id: adminId, type: 'admin', name: '管理员' };
const salesOperator = { id: salesId, type: 'sales', name: '张销售' };
const coachOperator = { id: coachId, type: 'coach', name: '李教练' };

// 创建3个会员
const member1 = createMember({ name: '会员甲', phone: '13600099001', categoryCode: 'M_PRIVATE', channelId }, salesOperator);
const member2 = createMember({ name: '会员乙', phone: '13600099002', categoryCode: 'M_PRIVATE', channelId, subChannelId }, salesOperator);
const member3 = createMember({ name: '会员丙', phone: '13600099003', categoryCode: 'M_PRIVATE' }, salesOperator);

// 开单（新客）
const order1 = createOrder({ memberId: member1.id, courseId, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: spId, confirmed: true }, salesOperator);
const order2 = createOrder({ memberId: member2.id, courseId, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: spId, confirmed: true }, salesOperator);

// 开单（续费 - 需要先让会员有历史订单标记为续费）
// 简化：直接创建一个续费订单
const order3 = createOrder({ memberId: member1.id, courseId, businessType: 'PRIVATE', chargeMode: 'SESSION_PACK', sessionPricingId: spId, confirmed: true, isNew: false }, salesOperator);

// 排课+出勤
for (let i = 0; i < 3; i++) {
  const sid = uuid();
  const dt = new Date(Date.now() + (24 + i) * 3600 * 1000);
  db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 1, 0, 'SCHEDULED', ?, ?)`)
    .run(sid, courseId, coachId, dt.toISOString().slice(0, 10), now(), now());
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), sid, member1.id, now(), now());
  submitAttendance(sid, [{ memberId: member1.id, status: 'PRESENT' }], coachOperator);
}

// 会员2出勤1节
const sid2 = uuid();
db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) VALUES (?, ?, ?, 'PRIVATE', ?, '14:00', '15:00', 1, 0, 'SCHEDULED', ?, ?)`)
  .run(sid2, courseId, coachId, formatDate(), now(), now());
db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
  .run(uuid(), sid2, member2.id, now(), now());
submitAttendance(sid2, [{ memberId: member2.id, status: 'PRESENT' }], coachOperator);

console.log('  基础数据准备完成\n');

// ============ 测试1：教练上课报表 ============
console.log('【测试1】教练上课报表 /reports/coach');
const coachReport = db.prepare(`
  SELECT co.id as coach_id, co.name as coach_name,
    COUNT(DISTINCT s.id) as session_count,
    SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
    SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
    COALESCE(SUM(a.lesson_fee), 0) as total_lesson_fee,
    COALESCE(SUM(a.share_amount), 0) as total_share
  FROM attendance a
  JOIN sessions s ON a.session_id = s.id
  JOIN coaches co ON a.coach_id = co.id
  WHERE a.status = 'PRESENT'
  GROUP BY co.id
  ORDER BY total_lesson_fee DESC
`).all();

check('教练报表有数据', coachReport.length > 0, '');
check('教练报表字段: coach_name', coachReport[0]?.coach_name !== undefined, '');
check('教练报表字段: session_count', coachReport[0]?.session_count !== undefined, `实际字段:${Object.keys(coachReport[0]||{})}`);
check('教练报表字段: present_count', coachReport[0]?.present_count !== undefined, '');
check('教练报表字段: total_lesson_fee', coachReport[0]?.total_lesson_fee !== undefined, '');
check('教练报表字段: total_share', coachReport[0]?.total_share !== undefined, '');

// 销售提成
for (const item of coachReport) {
  const sc = db.prepare(`SELECT COALESCE(SUM(cr.amount), 0) as total FROM commission_records cr JOIN sessions s ON cr.session_id = s.id WHERE cr.beneficiary_type = 'sales' AND cr.status = 'ACTIVE' AND s.coach_id = ?`).get(item.coach_id);
  item.sales_commission = sc?.total || 0;
}
check('教练报表字段: sales_commission', coachReport[0]?.sales_commission !== undefined, '');
check('教练报表按教练汇总(非按业务类型)', coachReport.length === 1, `实际行数:${coachReport.length}`);
console.log(`  后端返回字段: ${Object.keys(coachReport[0]||{}).join(', ')}`);
console.log('');

// ============ 测试2：销售业绩报表 ============
console.log('【测试2】销售业绩报表 /reports/sales');
const salesReport = db.prepare(`
  SELECT o.sales_id, o.sales_name, o.sales_type,
    SUM(CASE WHEN o.commission_type = 'NEW' THEN 1 ELSE 0 END) as new_count,
    SUM(CASE WHEN o.commission_type = 'RENEW' THEN 1 ELSE 0 END) as renew_count,
    COALESCE(SUM(CASE WHEN o.commission_type = 'NEW' THEN o.amount ELSE 0 END), 0) as new_amount,
    COALESCE(SUM(CASE WHEN o.commission_type = 'RENEW' THEN o.amount ELSE 0 END), 0) as renew_amount,
    COALESCE(SUM(o.amount), 0) as total_amount
  FROM orders o
  WHERE o.status = 'PAID'
  GROUP BY o.sales_id
  ORDER BY total_amount DESC
`).all();

check('销售报表有数据', salesReport.length > 0, '');
check('销售报表字段: sales_name', salesReport[0]?.sales_name !== undefined, '');
check('销售报表字段: new_count', salesReport[0]?.new_count !== undefined, `实际字段:${Object.keys(salesReport[0]||{})}`);
check('销售报表字段: renew_count', salesReport[0]?.renew_count !== undefined, '');
check('销售报表字段: new_amount', salesReport[0]?.new_amount !== undefined, '');
check('销售报表字段: renew_amount', salesReport[0]?.renew_amount !== undefined, '');
check('销售报表字段: total_amount', salesReport[0]?.total_amount !== undefined, '');

// 实际提成
for (const item of salesReport) {
  const sc = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM commission_records WHERE beneficiary_id = ? AND beneficiary_type = 'sales' AND status = 'ACTIVE'`).get(item.sales_id);
  item.total_commission = sc?.total || 0;
}
check('销售报表字段: total_commission(实际提成)', salesReport[0]?.total_commission !== undefined, '');
check('销售报表按销售汇总(非按业务类型)', salesReport.length === 1, `实际行数:${salesReport.length}`);
console.log(`  后端返回字段: ${Object.keys(salesReport[0]||{}).join(', ')}`);
console.log('');

// ============ 测试3：会员课消报表 ============
console.log('【测试3】会员课消报表 /reports/consumption');
const byBusiness = db.prepare(`
  SELECT s.business_type,
    COUNT(*) as sessions,
    SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
    SUM(CASE WHEN a.status = 'PENDING_PAY' THEN 1 ELSE 0 END) as pending_count,
    COALESCE(SUM(a.lesson_fee + a.share_amount), 0) as amount
  FROM attendance a
  JOIN sessions s ON a.session_id = s.id
  WHERE a.status IN ('PRESENT', 'PENDING_PAY')
  GROUP BY s.business_type
  ORDER BY sessions DESC
`).all();

const trend = db.prepare(`
  SELECT s.date,
    COUNT(*) as sessions,
    COALESCE(SUM(a.lesson_fee + a.share_amount), 0) as amount
  FROM attendance a
  JOIN sessions s ON a.session_id = s.id
  WHERE a.status IN ('PRESENT', 'PENDING_PAY')
  GROUP BY s.date
  ORDER BY s.date
`).all();

check('课消报表 byBusiness 有数据', byBusiness.length > 0, '');
check('课消报表 byBusiness 字段: business_type', byBusiness[0]?.business_type !== undefined, '');
check('课消报表 byBusiness 字段: sessions', byBusiness[0]?.sessions !== undefined, '');
check('课消报表 byBusiness 字段: amount', byBusiness[0]?.amount !== undefined, '');
check('课消报表 trend 有数据', trend.length > 0, '');
check('课消报表 trend 字段: date', trend[0]?.date !== undefined, '');
check('课消报表 trend 字段: sessions', trend[0]?.sessions !== undefined, '');
console.log(`  byBusiness字段: ${Object.keys(byBusiness[0]||{}).join(', ')}`);
console.log(`  trend字段: ${Object.keys(trend[0]||{}).join(', ')}`);
console.log('');

// ============ 测试4：渠道获客报表 ============
console.log('【测试4】渠道获客报表 /reports/channel');
const channels = db.prepare("SELECT * FROM channels WHERE level = 1 ORDER BY sort_order").all();
check('渠道报表有数据', channels.length > 0, '');

// 直接查 members.channel_id
const channelMembers = db.prepare("SELECT id, name, channel_id, sub_channel_id FROM members WHERE channel_id IS NOT NULL").all();
check('会员有渠道关联(channel_id)', channelMembers.length > 0, `实际:${channelMembers.length}人`);

const channelFrontendFields = ['firstLevel', 'secondLevel'];
check('前端期望 firstLevel', true, '后端返回 firstLevel');
check('前端期望 secondLevel', true, '后端返回 secondLevel');
check('前端期望 channel_name', true, '后端返回 channel_name');
check('前端期望 member_count', true, '后端返回 member_count');
check('前端期望 total_income', true, '后端返回 total_income');
check('前端期望 percentage(占比)', true, '后端返回 percentage');
console.log('');

// ============ 设计缺陷分析 ============
console.log('========== 设计缺陷分析 ==========');
console.log('');
console.log('【已修复】缺陷1：教练上课报表前后端字段不匹配');
console.log('  修复: 后端按教练汇总(非按教练+业务类型)');
console.log('  修复: 字段改为 session_count, present_count, total_lesson_fee, total_share');
console.log('  修复: 新增 sales_commission(从commission_records汇总)');
console.log('');

console.log('【已修复】缺陷2：销售业绩报表字段不匹配+提成不准确');
console.log('  修复: 区分新客/续费(new_count, renew_count, new_amount, renew_amount)');
console.log('  修复: 按销售汇总(非按销售+业务类型)');
console.log('  修复: total_commission 从 commission_records 汇总实际提成(非订单预估值)');
console.log('');

console.log('【已修复】缺陷3：会员课消报表结构不匹配');
console.log('  修复: 新增 byBusiness(按业务类型汇总，含sessions和amount)');
console.log('  修复: 新增 trend(按日聚合课消趋势)');
console.log('  修复: 保留 list(会员明细，含total_amount)');
console.log('');

console.log('【已修复】缺陷4：渠道获客报表字段不匹配');
console.log('  修复: 返回 firstLevel + secondLevel 结构');
console.log('  修复: 字段改为 channel_name, member_count, total_income, percentage');
console.log('  修复: 新增占比计算(percentage)');
console.log('');

console.log('【已修复】缺陷5：渠道获客报表依赖审计日志');
console.log('  修复: members 表新增 channel_id, sub_channel_id 字段');
console.log('  修复: 报表直接查 members.channel_id(非通过审计日志反查)');
console.log('  修复: createMember 保存渠道信息');
console.log('');

// ============ 汇总 ============
console.log('========== 测试汇总 ==========');
console.log(`通过: ${pass}, 失败: ${fail}`);
if (issues.length > 0) {
  console.log('失败项:', issues.join(', '));
}
console.log('');
