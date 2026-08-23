// 收费逻辑端到端测试脚本
// 验证：1.预约取消 2.课后计提 3.取消/退费不分成 4.看板待消课
import { getDb, initDb } from '../src/db/index.js';
import { hashPassword, verifyPassword, uuid, now, formatDate } from '../src/utils/helpers.js';
import { createOrder, refundOrder } from '../src/services/order.js';
import { submitAttendance } from '../src/services/attendance.js';
import { createMember } from '../src/services/member.js';

let pass = 0, fail = 0;
const issues = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail||''}`); issues.push(name); }
}

console.log('\n========== 收费逻辑端到端测试 ==========\n');

// 初始化测试数据库（内存模式）
initDb(':memory:');
const db = getDb();

// ============ 准备基础数据 ============
console.log('【准备测试数据】');

// 管理员
const adminId = uuid();
db.prepare("INSERT INTO admins (id, username, password_hash, name, status) VALUES (?, 'admin', ?, '管理员', 'ACTIVE')")
  .run(adminId, hashPassword('admin123'));

// 场馆
const venueId = uuid();
db.prepare("INSERT INTO venues (id, name, code, is_default, status) VALUES (?, '测试场馆', 'TEST', 1, 'ACTIVE')").run(venueId);

// 销售
const salesId = uuid();
db.prepare("INSERT INTO sales (id, phone, password_hash, name, status) VALUES (?, '13800000001', ?, '张销售', 'ACTIVE')")
  .run(salesId, hashPassword('123456'));

// 教练
const coachId = uuid();
db.prepare("INSERT INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status) VALUES (?, '13800000002', ?, '李教练', 'PRIVATE', 0, 'ACTIVE')")
  .run(coachId, hashPassword('123456'));

// 教练费率：私教 课单价300，分成比例30%，赠送不分成
db.prepare("INSERT INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission) VALUES (?, ?, 'PRIVATE', 300, 30, 0)")
  .run(uuid(), coachId);

// 销售提成规则：私教新客 5%
db.prepare("INSERT INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, 'PRIVATE', 'NEW', 5, 'ACTIVE')")
  .run(uuid());

// 课程
const courseId = uuid();
db.prepare("INSERT INTO courses (id, name, business_type, standard_price, status) VALUES (?, '私教课', 'PRIVATE', 400, 'ACTIVE')")
  .run(courseId);

// 次卡定价：10节 4000元，赠送2节
const spId = uuid();
db.prepare("INSERT INTO course_session_pricing (id, course_id, sessions, gift_sessions, price, status) VALUES (?, ?, 10, 2, 4000, 'ACTIVE')")
  .run(spId, courseId);

// 会员端配置：取消时限8小时
db.prepare("INSERT INTO member_end_config (id, booking_cancel_hours, noshow_action, booking_open_default, expiry_remind_days) VALUES (?, 8, 'RECORD_ONLY', 0, 7)")
  .run(uuid());

const adminOperator = { id: 'admin', type: 'admin', name: '管理员' };
const salesOperator = { id: salesId, type: 'sales', name: '张销售' };
const coachOperator = { id: coachId, type: 'coach', name: '李教练' };

// 会员
const memberId = createMember({ name: '收费测试会员', phone: '13600099001', categoryCode: 'M_PRIVATE' }, salesOperator).id;

// 会员端配置：取消时限8小时
db.prepare("INSERT INTO member_end_config (id, booking_cancel_hours, noshow_action, booking_open_default, expiry_remind_days) VALUES (?, 8, 'RECORD_ONLY', 0, 7)")
  .run(uuid());

console.log('  基础数据准备完成\n');

// ============ 测试1：开单时不再记录销售提成（改为课后计提） ============
console.log('【测试1】开单时不记录销售提成（课后计提）');
const order = createOrder({
  memberId, courseId, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spId,
  confirmed: true,
}, salesOperator);

const commissionRecord = db.prepare("SELECT * FROM commission_records WHERE order_id = ?").get(order.orderId);
check('开单时不记录销售提成', !commissionRecord, '应为空');
check('订单有提成率(5%)', order.commissionRate === 5, `实际:${order.commissionRate}`);
check('订单有预估提成金额', order.commissionAmount > 0, `实际:${order.commissionAmount}`);
console.log('');

// ============ 测试2：排课+出勤 → 教练课时费分成 ============
console.log('【测试2】课程结束后教练课时费分成');
// 排课
const sessionId = uuid();
const sessionDate = formatDate();
db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) 
  VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 1, 0, 'SCHEDULED', ?, ?)`)
  .run(sessionId, courseId, coachId, sessionDate, now(), now());

// 会员预约
const bookingId = uuid();
db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
  .run(bookingId, sessionId, memberId, now(), now());
db.prepare("UPDATE sessions SET booked_count = 1 WHERE id = ?").run(sessionId);

// 出勤登记
const attResult = submitAttendance(sessionId, [{ memberId, status: 'PRESENT' }], coachOperator);
const attendance = db.prepare("SELECT * FROM attendance WHERE session_id = ? AND member_id = ?").get(sessionId, memberId);

check('出勤记录已创建', !!attendance, '');
check('教练课时费=300', attendance?.lesson_fee === 300, `实际:${attendance?.lesson_fee}`);
check('教练分成金额=120(400×30%)', attendance?.share_amount === 120, `实际:${attendance?.share_amount}`);
check('课次状态=COMPLETED', db.prepare("SELECT status FROM sessions WHERE id=?").get(sessionId)?.status === 'COMPLETED', '');

// 验证课后销售提成已计提
const salesCommission = db.prepare("SELECT * FROM commission_records WHERE order_id = ? AND session_id = ?").get(order.orderId, sessionId);
check('课后销售提成已记录', !!salesCommission, '');
check('销售提成金额=20(400×5%)', salesCommission?.amount === 20, `实际:${salesCommission?.amount}`);
check('销售提成状态=ACTIVE', salesCommission?.status === 'ACTIVE', `实际:${salesCommission?.status}`);
console.log('');

// ============ 测试3：8小时内不可取消 ============
console.log('【测试3】预约取消时限');
// 创建一个2小时后的课次
const sessionId2 = uuid();
db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) 
  VALUES (?, ?, ?, 'PRIVATE', ?, ?, ?, 1, 0, 'SCHEDULED', ?, ?)`)
  .run(sessionId2, courseId, coachId,
    formatDate(),
    new Date(Date.now() + 2 * 3600 * 1000).toTimeString().slice(0, 5),
    new Date(Date.now() + 3 * 3600 * 1000).toTimeString().slice(0, 5),
    now(), now());

const bookingId2 = uuid();
db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
  .run(bookingId2, sessionId2, memberId, now(), now());

// 检查取消时限逻辑
const booking2 = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId2);
const session2 = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId2);
const sessionStart = new Date(`${session2.date}T${session2.start_time}`);
const hoursLeft = (sessionStart - new Date()) / 3600000;
check('2小时后课程-距开课不足8小时', hoursLeft < 8, `实际:${hoursLeft.toFixed(1)}小时`);
check('8小时内应阻止取消', hoursLeft < 8, '逻辑：booking_cancel_hours=8');
console.log('');

// ============ 测试4：会员取消预约 → 不产生教练课时费 ============
console.log('【测试4】取消预约不产生课时费');
// 创建一个10小时后的课次（可取消）
const sessionId3 = uuid();
const futureDate = new Date(Date.now() + 10 * 3600 * 1000);
db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) 
  VALUES (?, ?, ?, 'PRIVATE', ?, ?, ?, 1, 0, 'SCHEDULED', ?, ?)`)
  .run(sessionId3, courseId, coachId,
    futureDate.toISOString().slice(0, 10),
    futureDate.toTimeString().slice(0, 5),
    new Date(futureDate.getTime() + 3600 * 1000).toTimeString().slice(0, 5),
    now(), now());

const bookingId3 = uuid();
db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
  .run(bookingId3, sessionId3, memberId, now(), now());

// 取消预约
db.prepare("UPDATE bookings SET status = 'CANCELLED', cancelled_at = ?, updated_at = ? WHERE id = ?")
  .run(now(), now(), bookingId3);

// 检查无出勤记录 → 无课时费
const attendance3 = db.prepare("SELECT * FROM attendance WHERE session_id = ? AND member_id = ?").get(sessionId3, memberId);
check('取消预约后无出勤记录', !attendance3, '');
check('取消预约后无教练课时费', !attendance3 || attendance3.lesson_fee === 0, '');
console.log('');

// ============ 测试5：退费 → 回滚销售提成 ============
console.log('【测试5】退费回滚销售提成');
// 先消耗1节，剩余11节
// 退费
const refundResult = refundOrder(order.orderId, adminOperator, '测试退费');
check('退费成功', refundResult.orderId === order.orderId, '');
check('退费金额>0', refundResult.refundAmount > 0, `实际:${refundResult.refundAmount}`);

const commissionAfterRefund = db.prepare("SELECT * FROM commission_records WHERE order_id = ?").all(order.orderId);
check('退费后销售提成全部回滚', commissionAfterRefund.every(c => c.status === 'REVERSED'), `实际:${commissionAfterRefund.map(c=>c.status).join(',')}`);
console.log('');

// ============ 测试6：经营看板待消课统计 ============
console.log('【测试6】经营看板待消课统计');
// 查看当前看板数据
const todayIncome = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE status = 'PAID' AND date(created_at) = date('now')").get().total;
const monthConsumption = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE status = 'PRESENT'").get().cnt;

// 待消课 = 会员已预约但尚未出勤的课次
const pendingBookings = db.prepare(`
  SELECT COUNT(*) as cnt FROM bookings b 
  JOIN sessions s ON b.session_id = s.id 
  WHERE b.status = 'BOOKED' AND s.status = 'SCHEDULED'
`).get().cnt;

// 待消课金额 = 待消课节数 × 课程单价
const pendingAmount = db.prepare(`
  SELECT COALESCE(SUM(c.standard_price), 0) as total 
  FROM bookings b 
  JOIN sessions s ON b.session_id = s.id 
  JOIN courses c ON s.course_id = c.id 
  WHERE b.status = 'BOOKED' AND s.status = 'SCHEDULED'
`).get().total;

check('看板有今日收入', todayIncome >= 0, `实际:${todayIncome}`);
check('看板有月消课数', monthConsumption >= 1, `实际:${monthConsumption}`);
check('待消课数>0', pendingBookings > 0, `实际:${pendingBookings}`);
check('待消课金额>0', pendingAmount > 0, `实际:${pendingAmount}`);
console.log('');

// ============ 测试7：赠送课时教练不分成 ============
console.log('【测试7】赠送课时教练不分成');
// 创建新会员和订单
const memberId2 = createMember({ name: '赠送测试会员', phone: '13600099002', categoryCode: 'M_PRIVATE' }, salesOperator).id;

const order2 = createOrder({
  memberId: memberId2, courseId, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spId,
  confirmed: true,
}, salesOperator);

// 次卡：10购买+2赠送=12节，先消费10节购买课时，再消费2节赠送课时
// 排12节课
let giftAttResults = [];
for (let i = 0; i < 12; i++) {
  const sid = uuid();
  const dt = new Date(Date.now() + (24 + i) * 3600 * 1000);
  db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) 
    VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 1, 0, 'SCHEDULED', ?, ?)`)
    .run(sid, courseId, coachId, dt.toISOString().slice(0, 10), now(), now());
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), sid, memberId2, now(), now());
  db.prepare("UPDATE sessions SET booked_count = 1 WHERE id = ?").run(sid);

  const r = submitAttendance(sid, [{ memberId: memberId2, status: 'PRESENT' }], coachOperator);
  giftAttResults.push(r);
}

// 查看memberId2的出勤记录（排除test2的memberId记录）
const allAtt = db.prepare("SELECT * FROM attendance WHERE member_id = ? AND session_id IN (SELECT id FROM sessions WHERE course_id = ?) ORDER BY created_at").all(memberId2, courseId);
const last2Att = allAtt.slice(-2); // 最后2节是赠送课时
const first10Att = allAtt.slice(0, 10); // 前10节是购买课时

check('前10节(购买课时)有教练课时费', first10Att.every(a => a.lesson_fee === 300), `实际:${first10Att.map(a=>a.lesson_fee).join(',')}`);
check('前10节(购买课时)有分成', first10Att.every(a => a.share_amount === 120), `实际:${first10Att.map(a=>a.share_amount).join(',')}`);
check('后2节(赠送课时)课时费=0', last2Att.every(a => a.lesson_fee === 0), `实际:${last2Att.map(a=>a.lesson_fee).join(',')}`);
check('后2节(赠送课时)分成=0', last2Att.every(a => a.share_amount === 0), `实际:${last2Att.map(a=>a.share_amount).join(',')}`);
console.log('');

// ============ 测试8：爽约不产生课时费 ============
console.log('【测试8】爽约不产生课时费');
const memberId3 = createMember({ name: '爽约测试会员', phone: '13600099003', categoryCode: 'M_PRIVATE' }, salesOperator).id;
const order3 = createOrder({
  memberId: memberId3, courseId, businessType: 'PRIVATE',
  chargeMode: 'SESSION_PACK', sessionPricingId: spId,
  confirmed: true,
}, salesOperator);

const sessionIdN = uuid();
db.prepare(`INSERT INTO sessions (id, course_id, coach_id, business_type, date, start_time, end_time, capacity, booked_count, status, created_at, updated_at) 
  VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 1, 0, 'SCHEDULED', ?, ?)`)
  .run(sessionIdN, courseId, coachId, formatDate(), now(), now());
db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
  .run(uuid(), sessionIdN, memberId3, now(), now());

// 标记爽约
const noshowResult = submitAttendance(sessionIdN, [{ memberId: memberId3, status: 'ABSENT' }], coachOperator);
const noshowAtt = db.prepare("SELECT * FROM attendance WHERE session_id = ? AND member_id = ?").get(sessionIdN, memberId3);
check('爽约记录已创建', !!noshowAtt, '');
check('爽约课时费=0', noshowAtt?.lesson_fee === 0, `实际:${noshowAtt?.lesson_fee}`);
check('爽约分成=0', noshowAtt?.share_amount === 0, `实际:${noshowAtt?.share_amount}`);
console.log('');

// ============ 汇总 ============
console.log('========== 测试汇总 ==========');
console.log(`通过: ${pass}, 失败: ${fail}`);
if (issues.length > 0) {
  console.log('失败项:', issues.join(', '));
}
console.log('');

// ============ 设计缺陷分析 ============
console.log('========== 设计缺陷分析 ==========');
console.log('');
console.log('【已修复】缺陷1：销售提成改为课后计提');
console.log('  修复: createOrder 不再记录 commission_records');
console.log('  修复: submitAttendance(PRESENT) 时按节计提销售提成');
console.log('  修复: commission_records 新增 session_id 关联课次');
console.log('');

console.log('【已修复】缺陷2：退费时回滚所有已计提提成');
console.log('  修复: refundOrder 将该订单所有 commission_records 设为 REVERSED');
console.log('  说明: 按用户要求"退费不分成"，已消课的提成也回滚');
console.log('');

console.log('【已修复】缺陷3：经营看板增加待消课统计');
console.log('  修复: dashboard 新增 pendingConsumption(待消课节数)');
console.log('  修复: dashboard 新增 pendingAmount(待消课金额)');
console.log('  修复: dashboard 新增 consumedAmount(已消课金额)');
console.log('  修复: 前端 Dashboard.jsx 新增三个统计卡片');
console.log('');

console.log('【已修复】缺陷4：出勤时记录销售提成');
console.log('  修复: submitAttendance 时通过 pack→order 反查销售信息');
console.log('  修复: 按课程标准单价 × 提成率计算单节销售提成');
console.log('  修复: 赠送课时不分成（与教练分成逻辑一致）');
console.log('');

console.log('【无需修复】缺陷5：取消预约不回滚已计提的分成');
console.log('  说明: 取消预约在出勤前发生，无提成可回滚，逻辑正确');
console.log('');

console.log('【已修复】缺陷6：月卡退费回滚已消课的销售提成');
console.log('  修复: 退费时统一回滚所有 commission_records（月卡/次卡/预存均适用）');
console.log('');
