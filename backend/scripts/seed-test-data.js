// 全量测试数据种子脚本
// 用法：node scripts/seed-test-data.js
// 幂等：重复执行不会产生重复数据（使用 INSERT OR IGNORE / 先清后插）
import { initDb } from '../src/db/index.js';
import { uuid, hashPassword, now, encryptPhone, hashPhone, generateOrderNo, formatDate, addDays, addMonths, currentMonth } from '../src/utils/helpers.js';
import { BUSINESS_TYPE_CODES, BUSINESS_TO_CATEGORY } from '../../shared/constants.js';

const db = initDb();

// ============ 清理旧测试数据（保留 admins/sales/coaches/courses/courts/venues/channels/prepaid_rules/commission_rules/member_end_config） ============
console.log('[seed-test] 清理旧测试数据...');
// 按外键依赖逆序删除
for (const t of ['attendance_change_logs', 'attendance', 'pack_consumptions', 'prepaid_transactions', 'prepaid_accounts', 'packs', 'private_bookings', 'bookings', 'session_participants', 'sessions', 'commission_records', 'orders', 'member_tag_history', 'member_tags', 'coach_time_off', 'coach_availability_templates']) {
  db.exec(`DELETE FROM ${t}`);
}
// members 最后删（被 orders 等引用）
db.exec('DELETE FROM members');
// 清理测试教练（保留种子教练 13800000002）
db.prepare("DELETE FROM coach_rates WHERE coach_id IN (SELECT id FROM coaches WHERE phone IN ('13800000003','13800000004'))").run();
db.prepare("DELETE FROM coaches WHERE phone IN ('13800000003','13800000004')").run();

// ============ 1. 会员（10 个，覆盖各种业务类型） ============
console.log('[seed-test] 创建会员...');
const members = [];
const memberData = [
  { name: '王大力', phone: '13900000001', gender: 'M', birth: '1990-03-15' },
  { name: '李美玲', phone: '13900000002', gender: 'F', birth: '1995-07-22' },
  { name: '张伟', phone: '13900000003', gender: 'M', birth: '1988-11-10' },
  { name: '陈晓燕', phone: '13900000004', gender: 'F', birth: '1992-05-18' },
  { name: '刘子轩', phone: '13900000005', gender: 'M', birth: '2015-09-01' }, // 儿童
  { name: '黄思琪', phone: '13900000006', gender: 'F', birth: '2016-04-12' }, // 儿童
  { name: '周建国', phone: '13900000007', gender: 'M', birth: '1985-02-28' },
  { name: '吴雅婷', phone: '13900000008', gender: 'F', birth: '1993-12-05' },
  { name: '孙志强', phone: '13900000009', gender: 'M', birth: '1980-06-30' },
  { name: '赵丽华', phone: '13900000010', gender: 'F', birth: '1998-08-15' },
];
const salesRow = db.prepare("SELECT * FROM sales WHERE phone = '13800000001'").get();
const coachRow = db.prepare("SELECT * FROM coaches WHERE phone = '13800000002'").get();
for (const m of memberData) {
  const id = uuid();
  const enc = encryptPhone(m.phone);
  const hash = hashPhone(m.phone);
  db.prepare(`INSERT INTO members (id, name, phone, phone_hash, gender, birth_date, status, creator_id, creator_type, creator_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 'sales', ?, ?, ?)`)
    .run(id, m.name, enc, hash, m.gender, m.birth, salesRow.id, salesRow.name, now(), now());
  members.push({ id, ...m });
}

// ============ 2. 会员标签（多标签） ============
console.log('[seed-test] 创建会员标签...');
const tagAssignments = [
  [0, ['M_PRIVATE', 'M_ADULT_GROUP']],           // 王大力：私教+成人大课
  [1, ['M_PRACTICE', 'M_GYM']],                  // 李美玲：陪练+健身
  [2, ['M_PRIVATE', 'M_PRACTICE', 'M_FITNESS']], // 张伟：私教+陪练+体能
  [3, ['M_ADULT_GROUP', 'M_COMMUNITY']],         // 陈晓燕：成人大课+群活动
  [4, ['M_KID_GROUP']],                          // 刘子轩：儿童大课
  [5, ['M_KID_GROUP', 'M_FITNESS']],             // 黄思琪：儿童大课+体能
  [6, ['M_PRIVATE', 'M_ADULT_GROUP', 'M_GYM']],  // 周建国：私教+成人大课+健身
  [7, ['M_PRACTICE', 'M_COMMUNITY']],            // 吴雅婷：陪练+群活动
  [8, ['M_PRIVATE', 'M_FITNESS']],               // 孙志强：私教+体能
  [9, ['M_ADULT_GROUP', 'M_GYM', 'M_COMMUNITY']],// 赵丽华：成人大课+健身+群活动
];
for (const [idx, cats] of tagAssignments) {
  for (const code of cats) {
    db.prepare('INSERT OR IGNORE INTO member_tags (id, member_id, category_code, source, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), members[idx].id, code, 'AUTO', now());
  }
}

// ============ 3. 教练可用时间模板（私教/陪练） ============
console.log('[seed-test] 创建教练可用时间模板...');
// 李教练：周一至周日 09:00-21:00
for (let dow = 1; dow <= 7; dow++) {
  db.prepare(`INSERT INTO coach_availability_templates (id, coach_id, day_of_week, start_hour, end_hour, business_types, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PRIVATE,PRACTICE', 'ACTIVE', ?, ?)`)
    .run(uuid(), coachRow.id, dow, 9, 21, now(), now());
}

// 再加一个教练（陪练为主）
const coach2Id = uuid();
db.prepare(`INSERT OR IGNORE INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status) VALUES (?, ?, ?, ?, 'PRACTICE', 0, 'ACTIVE')`)
  .run(coach2Id, '13800000003', hashPassword('123456'), '王教练');
for (const bt of BUSINESS_TYPE_CODES) {
  db.prepare(`INSERT OR IGNORE INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate) VALUES (?, ?, ?, ?, ?)`)
    .run(uuid(), coach2Id, bt, bt === 'PRACTICE' ? 150 : 100, 50);
}
for (let dow = 1; dow <= 5; dow++) {
  db.prepare(`INSERT INTO coach_availability_templates (id, coach_id, day_of_week, start_hour, end_hour, business_types, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PRACTICE', 'ACTIVE', ?, ?)`)
    .run(uuid(), coach2Id, dow, 14, 21, now(), now());
}

// 第三个教练（大课/体能）
const coach3Id = uuid();
db.prepare(`INSERT OR IGNORE INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status) VALUES (?, ?, ?, ?, 'ADULT_GROUP', 1, 'ACTIVE')`)
  .run(coach3Id, '13800000004', hashPassword('123456'), '赵教练');
for (const bt of BUSINESS_TYPE_CODES) {
  db.prepare(`INSERT OR IGNORE INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate) VALUES (?, ?, ?, ?, ?)`)
    .run(uuid(), coach3Id, bt, bt === 'ADULT_GROUP' ? 120 : 100, 40);
}

// ============ 4. 教练请假 ============
console.log('[seed-test] 创建教练请假...');
const today = formatDate();
db.prepare(`INSERT INTO coach_time_off (id, coach_id, date, start_time, end_time, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run(uuid(), coachRow.id, addDays(today, 3), '14:00', '18:00', '个人事务', now());

// ============ 5. 排课（sessions） ============
console.log('[seed-test] 创建排课...');
const court1 = db.prepare("SELECT * FROM courts WHERE name = '1号场'").get();
const court2 = db.prepare("SELECT * FROM courts WHERE name = '2号场'").get();
const courtGym = db.prepare("SELECT * FROM courts WHERE name = '健身区'").get();
const courses = db.prepare('SELECT * FROM courses WHERE status = ?').all('ACTIVE');
const courseByType = {};
for (const c of courses) courseByType[c.business_type] = c;

const sessions = [];
const sessionDefs = [
  // 今天
  { course: 'ADULT_GROUP', coach: coachRow.id, court: court1.id, date: today, start: '19:00', end: '20:30', cap: 8, open: 1 },
  { course: 'KID_GROUP', coach: coachRow.id, court: court2.id, date: today, start: '17:00', end: '18:30', cap: 6, open: 1 },
  { course: 'FITNESS', coach: coach3Id, court: courtGym.id, date: today, start: '10:00', end: '11:00', cap: 10, open: 1 },
  { course: 'COMMUNITY', coach: coach3Id, court: court1.id, date: today, start: '20:30', end: '22:00', cap: 12, open: 1 },
  { course: 'GYM', coach: coach3Id, court: courtGym.id, date: today, start: '14:00', end: '15:00', cap: 5, open: 1 },
  // 明天
  { course: 'ADULT_GROUP', coach: coach3Id, court: court1.id, date: addDays(today, 1), start: '19:00', end: '20:30', cap: 8, open: 1 },
  { course: 'KID_GROUP', coach: coachRow.id, court: court2.id, date: addDays(today, 1), start: '17:00', end: '18:30', cap: 6, open: 1 },
  { course: 'FITNESS', coach: coach3Id, court: courtGym.id, date: addDays(today, 1), start: '10:00', end: '11:00', cap: 10, open: 1 },
  // 后天
  { course: 'COMMUNITY', coach: coach3Id, court: court1.id, date: addDays(today, 2), start: '20:00', end: '22:00', cap: 15, open: 1 },
  { course: 'ADULT_GROUP', coach: coachRow.id, court: court1.id, date: addDays(today, 2), start: '19:00', end: '20:30', cap: 8, open: 1 },
  // 3 天后
  { course: 'KID_GROUP', coach: coachRow.id, court: court2.id, date: addDays(today, 3), start: '17:00', end: '18:30', cap: 6, open: 1 },
  { course: 'GYM', coach: coach3Id, court: courtGym.id, date: addDays(today, 3), start: '14:00', end: '15:00', cap: 5, open: 1 },
  // 5 天后
  { course: 'ADULT_GROUP', coach: coach3Id, court: court1.id, date: addDays(today, 5), start: '19:00', end: '20:30', cap: 8, open: 1 },
  { course: 'COMMUNITY', coach: coach3Id, court: court1.id, date: addDays(today, 5), start: '20:30', end: '22:00', cap: 12, open: 1 },
  // 7 天后
  { course: 'FITNESS', coach: coach3Id, court: courtGym.id, date: addDays(today, 7), start: '10:00', end: '11:00', cap: 10, open: 1 },
  // 已完成的课次（3 天前，用于出勤）
  { course: 'ADULT_GROUP', coach: coachRow.id, court: court1.id, date: addDays(today, -3), start: '19:00', end: '20:30', cap: 8, open: 0, status: 'COMPLETED' },
  { course: 'PRIVATE', coach: coachRow.id, court: court2.id, date: addDays(today, -2), start: '10:00', end: '11:00', cap: 1, open: 0, status: 'COMPLETED' },
];
for (const s of sessionDefs) {
  const c = courseByType[s.course];
  if (!c) continue;
  const id = uuid();
  db.prepare(`INSERT INTO sessions (id, course_id, business_type, coach_id, court_id, venue_id, date, start_time, end_time, capacity, booked_count, status, booking_open, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`)
    .run(id, c.id, s.course, s.coach, s.court, court1.venue_id, s.date, s.start, s.end, s.cap, s.status || 'SCHEDULED', s.open, now(), now());
  sessions.push({ id, ...s, courseId: c.id });
}

// ============ 6. 订单（覆盖各种收费模式） ============
console.log('[seed-test] 创建订单...');
const orders = [];
const orderDefs = [
  // 王大力：私教次卡 10 节
  { member: 0, business: 'PRIVATE', chargeMode: 'SESSION_PACK', amount: 2700, original: 3000, discount: 300, gift: 0, commissionType: 'NEW', pack: { type: 'SESSION_PACK', total: 10, gift: 2, unitPrice: 300 } },
  // 李美玲：陪练次卡 20 节
  { member: 1, business: 'PRACTICE', chargeMode: 'SESSION_PACK', amount: 3400, original: 4000, discount: 600, gift: 0, commissionType: 'NEW', pack: { type: 'SESSION_PACK', total: 20, gift: 4, unitPrice: 200 } },
  // 张伟：预存 5000 送 2000
  { member: 2, business: 'PRIVATE', chargeMode: 'PREPAID', amount: 5000, original: 5000, discount: 0, gift: 2000, commissionType: 'NEW', prepaid: { deposit: 5000, gift: 2000 } },
  // 陈晓燕：成人大课月卡
  { member: 3, business: 'ADULT_GROUP', chargeMode: 'MONTHLY', amount: 700, original: 700, discount: 0, gift: 0, commissionType: 'NEW', pack: { type: 'MONTHLY', quota: 8 } },
  // 刘子轩：儿童大课次卡 10 节
  { member: 4, business: 'KID_GROUP', chargeMode: 'SESSION_PACK', amount: 1080, original: 1200, discount: 120, gift: 0, commissionType: 'NEW', pack: { type: 'SESSION_PACK', total: 10, gift: 2, unitPrice: 120 } },
  // 周建国：私教次卡 10 节 + 健身月卡
  { member: 6, business: 'PRIVATE', chargeMode: 'SESSION_PACK', amount: 2700, original: 3000, discount: 300, gift: 0, commissionType: 'RENEW', pack: { type: 'SESSION_PACK', total: 10, gift: 2, unitPrice: 300 } },
  { member: 6, business: 'GYM', chargeMode: 'MONTHLY', amount: 700, original: 700, discount: 0, gift: 0, commissionType: 'NEW', pack: { type: 'MONTHLY', quota: 8 } },
  // 孙志强：体能课次卡 10 节
  { member: 8, business: 'FITNESS', chargeMode: 'SESSION_PACK', amount: 1350, original: 1500, discount: 150, gift: 0, commissionType: 'NEW', pack: { type: 'SESSION_PACK', total: 10, gift: 2, unitPrice: 150 } },
  // 赵丽华：群活动单次
  { member: 9, business: 'COMMUNITY', chargeMode: 'SINGLE', amount: 50, original: 50, discount: 0, gift: 0, commissionType: 'NEW' },
  // 赵丽华：成人大课次卡 10 节
  { member: 9, business: 'ADULT_GROUP', chargeMode: 'SESSION_PACK', amount: 900, original: 1000, discount: 100, gift: 0, commissionType: 'NEW', pack: { type: 'SESSION_PACK', total: 10, gift: 2, unitPrice: 100 } },
];

// 提成规则
const getCommissionRate = (bt, ct) => {
  const r = db.prepare('SELECT rate FROM commission_rules WHERE business_type = ? AND commission_type = ? AND status = ?').get(bt, ct, 'ACTIVE');
  return r ? r.rate : 10;
};

for (const o of orderDefs) {
  const m = members[o.member];
  const orderNo = generateOrderNo();
  const orderId = uuid();
  const rate = getCommissionRate(o.business, o.commissionType);
  const commissionAmount = Math.round(o.amount * rate / 100);
  db.prepare(`INSERT INTO orders (id, order_no, member_id, sales_id, sales_type, sales_name, business_type, course_id, charge_mode, amount, original_amount, discount_amount, gift_value, commission_type, commission_rate, commission_amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'sales', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)`)
    .run(orderId, orderNo, m.id, salesRow.id, salesRow.name, o.business, courseByType[o.business]?.id || null, o.chargeMode, o.amount, o.original, o.discount, o.gift, o.commissionType, rate, commissionAmount, now(), now());
  orders.push({ id: orderId, ...o, memberId: m.id });

  // 提成记录
  db.prepare(`INSERT INTO commission_records (id, order_id, beneficiary_id, beneficiary_type, beneficiary_name, commission_type, business_type, rate, amount, status, created_at) VALUES (?, ?, ?, 'sales', ?, ?, ?, ?, ?, 'ACTIVE', ?)`)
    .run(uuid(), orderId, salesRow.id, salesRow.name, o.commissionType, o.business, rate, commissionAmount, now());

  // 课包
  if (o.pack) {
    const packId = uuid();
    if (o.pack.type === 'SESSION_PACK') {
      const total = o.pack.total + o.pack.gift;
      db.prepare(`INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, total_sessions, used_sessions, remaining_sessions, gift_sessions, unit_price, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'SESSION_PACK', ?, 0, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
        .run(packId, m.id, orderId, courseByType[o.business]?.id || null, o.business, total, total, o.pack.gift, o.pack.unitPrice, today, addDays(today, 365), now(), now());
    } else if (o.pack.type === 'MONTHLY') {
      db.prepare(`INSERT INTO packs (id, member_id, order_id, course_id, business_type, pack_type, total_sessions, used_sessions, remaining_sessions, gift_sessions, unit_price, monthly_quota, monthly_used, monthly_remaining, monthly_period, valid_from, valid_until, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'MONTHLY', 0, 0, 0, 0, 0, ?, 0, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
        .run(packId, m.id, orderId, courseByType[o.business]?.id || null, o.business, o.pack.quota, o.pack.quota, currentMonth(), today, addMonths(today, 1), now(), now());
    }
  }

  // 预存账户
  if (o.prepaid) {
    const acctId = uuid();
    const existing = db.prepare('SELECT * FROM prepaid_accounts WHERE member_id = ?').get(m.id);
    if (existing) {
      db.prepare(`UPDATE prepaid_accounts SET principal_balance = principal_balance + ?, gift_balance = gift_balance + ?, total_balance = total_balance + ?, updated_at = ? WHERE id = ?`)
        .run(o.prepaid.deposit, o.prepaid.gift, o.prepaid.deposit + o.prepaid.gift, now(), existing.id);
      db.prepare(`INSERT INTO prepaid_transactions (id, account_id, member_id, order_id, type, principal_delta, gift_delta, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, 'DEPOSIT', ?, ?, ?, ?, '预存入账', ?)`)
        .run(uuid(), existing.id, m.id, orderId, o.prepaid.deposit, o.prepaid.gift, o.prepaid.deposit + o.prepaid.gift, existing.total_balance + o.prepaid.deposit + o.prepaid.gift, now());
    } else {
      db.prepare(`INSERT INTO prepaid_accounts (id, member_id, principal_balance, gift_balance, total_balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(acctId, m.id, o.prepaid.deposit, o.prepaid.gift, o.prepaid.deposit + o.prepaid.gift, now(), now());
      db.prepare(`INSERT INTO prepaid_transactions (id, account_id, member_id, order_id, type, principal_delta, gift_delta, amount, balance_after, note, created_at) VALUES (?, ?, ?, ?, 'DEPOSIT', ?, ?, ?, ?, '预存入账', ?)`)
        .run(uuid(), acctId, m.id, orderId, o.prepaid.deposit, o.prepaid.gift, o.prepaid.deposit + o.prepaid.gift, o.prepaid.deposit + o.prepaid.gift, now());
    }
  }
}

// ============ 7. 约课记录（bookings） ============
console.log('[seed-test] 创建约课记录...');
// 王大力约今天的成人大课
const adultSessionToday = sessions.find((s) => s.course === 'ADULT_GROUP' && s.date === today);
if (adultSessionToday) {
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), adultSessionToday.id, members[0].id, now(), now());
  db.prepare(`UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?`).run(adultSessionToday.id);
}
// 陈晓燕约今天的成人大课
if (adultSessionToday) {
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), adultSessionToday.id, members[3].id, now(), now());
  db.prepare(`UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?`).run(adultSessionToday.id);
}
// 刘子轩约今天的儿童大课
const kidSessionToday = sessions.find((s) => s.course === 'KID_GROUP' && s.date === today);
if (kidSessionToday) {
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), kidSessionToday.id, members[4].id, now(), now());
  db.prepare(`UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?`).run(kidSessionToday.id);
}
// 黄思琪约今天的儿童大课
if (kidSessionToday) {
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), kidSessionToday.id, members[5].id, now(), now());
  db.prepare(`UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?`).run(kidSessionToday.id);
}
// 赵丽华约今天的群活动
const communitySessionToday = sessions.find((s) => s.course === 'COMMUNITY' && s.date === today);
if (communitySessionToday) {
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), communitySessionToday.id, members[9].id, now(), now());
  db.prepare(`UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?`).run(communitySessionToday.id);
}
// 周建国约明天的成人大课
const adultSessionTmr = sessions.find((s) => s.course === 'ADULT_GROUP' && s.date === addDays(today, 1));
if (adultSessionTmr) {
  db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
    .run(uuid(), adultSessionTmr.id, members[6].id, now(), now());
  db.prepare(`UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?`).run(adultSessionTmr.id);
}

// ============ 8. 私教/陪练预约（private_bookings） ============
console.log('[seed-test] 创建私教/陪练预约...');
// 王大力约李教练明天 10:00 私教
db.prepare(`INSERT INTO private_bookings (id, coach_id, member_id, business_type, date, start_time, end_time, status, created_at, updated_at) VALUES (?, ?, ?, 'PRIVATE', ?, '10:00', '11:00', 'BOOKED', ?, ?)`)
  .run(uuid(), coachRow.id, members[0].id, addDays(today, 1), now(), now());
// 张伟约李教练明天 14:00 陪练
db.prepare(`INSERT INTO private_bookings (id, coach_id, member_id, business_type, date, start_time, end_time, status, created_at, updated_at) VALUES (?, ?, ?, 'PRACTICE', ?, '14:00', '15:00', 'BOOKED', ?, ?)`)
  .run(uuid(), coachRow.id, members[2].id, addDays(today, 1), now(), now());
// 孙志强约李教练后天 15:00 私教
db.prepare(`INSERT INTO private_bookings (id, coach_id, member_id, business_type, date, start_time, end_time, status, created_at, updated_at) VALUES (?, ?, ?, 'PRIVATE', ?, '15:00', '16:00', 'BOOKED', ?, ?)`)
  .run(uuid(), coachRow.id, members[8].id, addDays(today, 2), now(), now());

// ============ 9. 出勤记录（已完成课次） ============
console.log('[seed-test] 创建出勤记录...');
const completedAdult = sessions.find((s) => s.course === 'ADULT_GROUP' && s.status === 'COMPLETED');
if (completedAdult) {
  // 王大力出勤
  const pack0 = db.prepare("SELECT * FROM packs WHERE member_id = ? AND business_type = 'ADULT_GROUP' AND status = 'ACTIVE'").get(members[0].id);
  // 王大力没有成人大课次卡，用预存扣费（这里简化记录）
  db.prepare(`INSERT INTO attendance (id, session_id, member_id, coach_id, status, lesson_fee, share_amount, created_at, updated_at) VALUES (?, ?, ?, ?, 'PRESENT', 100, 40, ?, ?)`)
    .run(uuid(), completedAdult.id, members[0].id, completedAdult.coach, now(), now());
  // 陈晓燕出勤
  db.prepare(`INSERT INTO attendance (id, session_id, member_id, coach_id, status, lesson_fee, share_amount, created_at, updated_at) VALUES (?, ?, ?, ?, 'PRESENT', 100, 40, ?, ?)`)
    .run(uuid(), completedAdult.id, members[3].id, completedAdult.coach, now(), now());
}
const completedPrivate = sessions.find((s) => s.course === 'PRIVATE' && s.status === 'COMPLETED');
if (completedPrivate) {
  // 张伟私教出勤
  db.prepare(`INSERT INTO attendance (id, session_id, member_id, coach_id, status, lesson_fee, share_amount, created_at, updated_at) VALUES (?, ?, ?, ?, 'PRESENT', 300, 150, ?, ?)`)
    .run(uuid(), completedPrivate.id, members[2].id, completedPrivate.coach, now(), now());
}

console.log('[seed-test] 全量测试数据已创建完成！');
console.log('[seed-test] 会员账号：');
for (const m of members) {
  console.log(`  ${m.name}: ${m.phone} (验证码 1234)`);
}
console.log('[seed-test] 教练账号：');
console.log('  李教练: 13800000002 / 123456');
console.log('  王教练: 13800000003 / 123456');
console.log('  赵教练: 13800000004 / 123456');
console.log('[seed-test] 销售账号：');
console.log('  张销售: 13800000001 / 123456');
db.close();
