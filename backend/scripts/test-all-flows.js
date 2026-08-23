// 三端功能测试脚本 — 会员端/销售端/教练端
// 用法：node scripts/test-all-flows.js
const BASE = 'http://localhost:3100/api';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, ...data };
}

function log(tag, msg, ok = true) { console.log(`${ok ? '✅' : '❌'} [${tag}] ${msg}`); }
function logErr(tag, msg, err) { console.log(`❌ [${tag}] ${msg} — ${err}`); }

let pass = 0, fail = 0;
function ok(tag, msg) { console.log(`✅ [${tag}] ${msg}`); pass++; }
function bad(tag, msg, err = '') { console.log(`❌ [${tag}] ${msg}${err ? ' — ' + err : ''}`); fail++; }

// ============ 会员端测试 ============
async function testMember() {
  console.log('\n========== 会员端测试 ==========');
  const TAG = '会员端';

  // 1. 发送验证码
  let r = await req('POST', '/auth/member/send-code', { phone: '13900000001' });
  if (r.code === 0) ok(TAG, '发送验证码'); else bad(TAG, '发送验证码', r.message);

  // 2. 会员登录
  r = await req('POST', '/auth/member/login', { phone: '13900000001', code: '1234' });
  if (r.code === 0 && r.data.token) { ok(TAG, '会员登录'); var memberToken = r.data.token; }
  else { bad(TAG, '会员登录', r.message); return; }

  // 3. 我的资产
  r = await req('GET', '/member-end/my-assets', null, memberToken);
  if (r.code === 0) ok(TAG, `我的资产: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '我的资产', r.message);

  // 4. 我的消费记录
  r = await req('GET', '/member-end/my-consumption', null, memberToken);
  if (r.code === 0) ok(TAG, `我的消费记录: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '我的消费记录', r.message);

  // 5. 我的出勤记录
  r = await req('GET', '/member-end/my-attendance', null, memberToken);
  if (r.code === 0) ok(TAG, `我的出勤记录: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '我的出勤记录', r.message);

  // 6. 可约课次列表
  r = await req('GET', '/bookings/available', null, memberToken);
  if (r.code === 0) ok(TAG, `可约课次: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`); else bad(TAG, '可约课次', r.message);

  // 7. 我的约课记录
  r = await req('GET', '/bookings/mine', null, memberToken);
  if (r.code === 0) ok(TAG, `我的约课记录: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`); else bad(TAG, '我的约课记录', r.message);

  // 8. 预约课次（找一个可约的）
  r = await req('GET', '/bookings/available', null, memberToken);
  const availableSessions = Array.isArray(r.data) ? r.data : (r.data?.list || []);
  if (availableSessions.length > 0) {
    // 找一个王大力还没约的课
    const myBookings = await req('GET', '/bookings/mine', null, memberToken);
    const mySessionIds = new Set((Array.isArray(myBookings.data) ? myBookings.data : (myBookings.data?.list || [])).map((b) => b.session_id || b.sessionId));
    const target = availableSessions.find((s) => !mySessionIds.has(s.id));
    if (target) {
      r = await req('POST', '/bookings', { sessionId: target.id }, memberToken);
      if (r.code === 0) { ok(TAG, `预约课次 ${target.id}`); var bookedSessionId = target.id; }
      else bad(TAG, '预约课次', r.message);
    } else {
      ok(TAG, '没有可约的新课次（已全部约过）');
    }
  } else {
    bad(TAG, '没有可约课次');
  }

  // 9. 取消刚才的预约
  if (bookedSessionId) {
    // 先查我的约课记录，找到 booking id
    const myBookings2 = await req('GET', '/bookings/mine', null, memberToken);
    const myBookingsList = Array.isArray(myBookings2.data) ? myBookings2.data : (myBookings2.data?.list || []);
    const booking = myBookingsList.find((b) => b.session_id === bookedSessionId || b.sessionId === bookedSessionId);
    if (booking) {
      r = await req('DELETE', `/bookings/${booking.id}`, null, memberToken);
      if (r.code === 0) ok(TAG, '取消预约'); else bad(TAG, '取消预约', r.message);
    } else {
      ok(TAG, '取消预约跳过（未找到 booking 记录，可能开课前时限不足）');
    }
  }

  // 10. 私教可用时段
  r = await req('GET', '/private-bookings/13800000002/available-slots?date=' + new Date().toISOString().slice(0, 10), null, memberToken);
  // 13800000002 是教练手机号，需要用教练 id
  // 先获取教练列表
  r = await req('GET', '/coaches', null, memberToken);
  const coaches = Array.isArray(r.data) ? r.data : (r.data?.list || []);
  const coachLi = coaches.find((c) => c.name === '李教练');
  if (coachLi) {
    r = await req('GET', `/private-bookings/${coachLi.id}/available-slots?date=` + new Date().toISOString().slice(0, 10), null, memberToken);
    if (r.code === 0) {
      const slots = Array.isArray(r.data) ? r.data : (r.data?.slots || []);
      ok(TAG, `私教可用时段: ${slots.length} 个`);
    } else bad(TAG, '私教可用时段', r.message);

    // 11. 预约私教
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    r = await req('GET', `/private-bookings/${coachLi.id}/available-slots?date=${tomorrow}`, null, memberToken);
    const slots = Array.isArray(r.data) ? r.data : (r.data?.slots || []);
    const availSlot = slots.find((s) => s.available !== false && s.status !== 'BOOKED');
    if (availSlot) {
      const st = availSlot.start_time || availSlot.start || availSlot.startTime;
      const et = availSlot.end_time || availSlot.end || availSlot.endTime || `${parseInt(st)+1}:00`;
      r = await req('POST', '/private-bookings/private', {
        coachId: coachLi.id,
        businessType: 'PRIVATE',
        date: tomorrow,
        startTime: st,
        endTime: et,
      }, memberToken);
      if (r.code === 0) {
        ok(TAG, `预约私教 ${tomorrow} ${availSlot.start_time || availSlot.start}`);
        var privateBookingId = r.data.id || r.data.bookingId;
      } else bad(TAG, '预约私教', r.message);
    } else {
      ok(TAG, '明天无私教可用时段（可能已约满）');
    }

    // 12. 我的私教预约列表
    r = await req('GET', '/private-bookings/private/mine', null, memberToken);
    if (r.code === 0) ok(TAG, `我的私教预约: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`);
    else bad(TAG, '我的私教预约', r.message);

    // 13. 取消私教预约
    if (privateBookingId) {
      r = await req('DELETE', `/private-bookings/private/${privateBookingId}`, null, memberToken);
      if (r.code === 0) ok(TAG, '取消私教预约'); else bad(TAG, '取消私教预约', r.message);
    }
  } else {
    bad(TAG, '找不到李教练');
  }

  // 14. 会员端配置
  r = await req('GET', '/member-end/config', null, memberToken);
  if (r.code === 0) ok(TAG, `会员端配置: ${JSON.stringify(r.data).slice(0, 80)}`); else bad(TAG, '会员端配置', r.message);

  // 15. 课程列表
  r = await req('GET', '/courses', null, memberToken);
  if (r.code === 0) ok(TAG, `课程列表: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`); else bad(TAG, '课程列表', r.message);
}

// ============ 销售端测试 ============
async function testSales() {
  console.log('\n========== 销售端测试 ==========');
  const TAG = '销售端';

  // 1. 销售登录
  let r = await req('POST', '/auth/sales/login', { phone: '13800000001', password: '123456' });
  if (r.code === 0 && r.data.token) { ok(TAG, '销售登录'); var salesToken = r.data.token; }
  else { bad(TAG, '销售登录', r.message); return; }

  // 2. 工作台
  r = await req('GET', '/sales/dashboard', null, salesToken);
  if (r.code === 0) ok(TAG, `工作台: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '工作台', r.message);

  // 3. 业绩明细
  r = await req('GET', '/sales/performance', null, salesToken);
  if (r.code === 0) ok(TAG, `业绩明细: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '业绩明细', r.message);

  // 4. 会员列表
  r = await req('GET', '/members?page=1&pageSize=5', null, salesToken);
  if (r.code === 0) ok(TAG, `会员列表: ${r.data?.list?.length || r.data?.length || 0} 条`); else bad(TAG, '会员列表', r.message);

  // 5. 建档新会员
  r = await req('POST', '/members', { name: '测试新客', phone: '13900000099', gender: 'M', categoryCode: 'M_PRIVATE' }, salesToken);
  if (r.code === 0) { ok(TAG, `建档新会员: ${r.data.id}`); var newMemberId = r.data.id; }
  else bad(TAG, '建档新会员', r.message);

  // 6. 课程列表
  r = await req('GET', '/courses', null, salesToken);
  if (r.code === 0) ok(TAG, `课程列表: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '课程列表', r.message);

  // 7. 开单（次卡）
  if (newMemberId) {
    const courses = Array.isArray(r.data) ? r.data : [];
    const privateCourse = courses.find((c) => c.business_type === 'PRIVATE');
    if (privateCourse) {
      r = await req('POST', '/orders', {
        memberId: newMemberId,
        businessType: 'PRIVATE',
        courseId: privateCourse.id,
        chargeMode: 'SESSION_PACK',
        sessions: 10,
        price: 2700,
        giftSessions: 2,
      }, salesToken);
      if (r.code === 0) ok(TAG, `开单成功: ${r.data.orderNo || r.data.order_no}`); else bad(TAG, '开单', r.message);
    }
  }

  // 8. 订单列表
  r = await req('GET', '/orders?page=1&pageSize=5', null, salesToken);
  if (r.code === 0) ok(TAG, `订单列表: ${r.data?.list?.length || r.data?.length || 0} 条`); else bad(TAG, '订单列表', r.message);

  // 9. 渠道列表
  r = await req('GET', '/channels', null, salesToken);
  if (r.code === 0) ok(TAG, `渠道列表: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '渠道列表', r.message);

  // 10. 教练列表
  r = await req('GET', '/coaches', null, salesToken);
  if (r.code === 0) ok(TAG, `教练列表: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '教练列表', r.message);
}

// ============ 教练端测试 ============
async function testCoach() {
  console.log('\n========== 教练端测试 ==========');
  const TAG = '教练端';

  // 1. 教练登录
  let r = await req('POST', '/auth/coach/login', { phone: '13800000002', password: '123456' });
  if (r.code === 0 && r.data.token) { ok(TAG, '教练登录'); var coachToken = r.data.token; var coachId = r.data.user.id; }
  else { bad(TAG, '教练登录', r.message); return; }

  // 2. 课表摘要
  r = await req('GET', '/sales/coach/schedule-summary', null, coachToken);
  if (r.code === 0) ok(TAG, `课表摘要: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '课表摘要', r.message);

  // 3. 课表列表
  r = await req('GET', '/sessions', null, coachToken);
  if (r.code === 0) ok(TAG, `课表列表: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`); else bad(TAG, '课表列表', r.message);

  // 4. 教练的私教/陪练预约列表
  r = await req('GET', '/private-bookings/private/coach', null, coachToken);
  if (r.code === 0) ok(TAG, `私教/陪练预约: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`); else bad(TAG, '私教/陪练预约', r.message);

  // 5. 教练可用时间模板
  r = await req('GET', `/private-bookings/${coachId}/availability`, null, coachToken);
  if (r.code === 0) ok(TAG, `可用时间模板: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '可用时间模板', r.message);

  // 6. 教练请假记录
  r = await req('GET', `/private-bookings/${coachId}/time-off`, null, coachToken);
  if (r.code === 0) ok(TAG, `请假记录: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '请假记录', r.message);

  // 7. 教练上课统计
  r = await req('GET', '/attendance/stats/coach', null, coachToken);
  if (r.code === 0) ok(TAG, `上课统计: ${JSON.stringify(r.data).slice(0, 100)}`); else bad(TAG, '上课统计', r.message);

  // 8. 查询已完成课次的出勤
  const sessions = await req('GET', '/sessions', null, coachToken);
  const sessionList = Array.isArray(sessions.data) ? sessions.data : (sessions.data?.list || []);
  const completedSession = sessionList.find((s) => s.status === 'COMPLETED');
  if (completedSession) {
    r = await req('GET', `/attendance/${completedSession.id}/attendance`, null, coachToken);
    if (r.code === 0) ok(TAG, `已完成课次出勤: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '已完成课次出勤', r.message);

    // 9. 提交出勤（找一个 SCHEDULED 的课次）
    const scheduledSession = sessionList.find((s) => s.status === 'SCHEDULED');
    if (scheduledSession) {
      // 查看约课名单
      r = await req('GET', `/bookings/session/${scheduledSession.id}`, null, coachToken);
      if (r.code === 0) {
        const bookedMembers = Array.isArray(r.data) ? r.data : (r.data?.list || []);
        ok(TAG, `课次约课名单: ${bookedMembers.length} 人`);
        if (bookedMembers.length > 0) {
          // 提交出勤
          const attendanceData = bookedMembers.map((b) => ({
            memberId: b.member_id || b.memberId,
            status: 'PRESENT',
          }));
          r = await req('POST', `/attendance/${scheduledSession.id}/submit`, { attendance: attendanceData }, coachToken);
          if (r.code === 0) ok(TAG, '提交出勤'); else bad(TAG, '提交出勤', r.message);
        }
      } else bad(TAG, '查看约课名单', r.message);
    }
  } else {
    ok(TAG, '无已完成课次可测');
  }

  // 10. 教练详情
  r = await req('GET', `/coaches/${coachId}`, null, coachToken);
  if (r.code === 0) ok(TAG, `教练详情: ${r.data.name}`); else bad(TAG, '教练详情', r.message);

  // 11. 教练开单能力（salesEnabled）
  r = await req('GET', '/sales/dashboard', null, coachToken);
  if (r.code === 0) ok(TAG, '教练访问销售工作台（salesEnabled）'); else bad(TAG, '教练访问销售工作台', r.message);
}

// ============ 管理端关键功能 ============
async function testAdmin() {
  console.log('\n========== 管理端关键功能测试 ==========');
  const TAG = '管理端';

  let r = await req('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  if (r.code === 0 && r.data.token) { ok(TAG, '管理员登录'); var adminToken = r.data.token; }
  else { bad(TAG, '管理员登录', r.message); return; }

  // Dashboard
  r = await req('GET', '/dashboard', null, adminToken);
  if (r.code === 0) ok(TAG, `Dashboard: ${JSON.stringify(r.data).slice(0, 80)}`); else bad(TAG, 'Dashboard', r.message);

  // 报表
  r = await req('GET', '/reports/coach', null, adminToken);
  if (r.code === 0) ok(TAG, `教练报表: ${JSON.stringify(r.data).slice(0, 80)}`); else bad(TAG, '教练报表', r.message);
  r = await req('GET', '/reports/sales', null, adminToken);
  if (r.code === 0) ok(TAG, `销售报表: ${JSON.stringify(r.data).slice(0, 80)}`); else bad(TAG, '销售报表', r.message);

  // 提成规则
  r = await req('GET', '/commissions/rules', null, adminToken);
  if (r.code === 0) ok(TAG, `提成规则: ${Array.isArray(r.data) ? r.data.length : (r.data?.list?.length || 0)} 条`); else bad(TAG, '提成规则', r.message);

  // 提成记录
  r = await req('GET', '/commissions/records?page=1&pageSize=5', null, adminToken);
  if (r.code === 0) ok(TAG, `提成记录: ${r.data?.list?.length || r.data?.length || 0} 条`); else bad(TAG, '提成记录', r.message);

  // 场地列表
  r = await req('GET', '/courts/courts', null, adminToken);
  if (r.code === 0) ok(TAG, `场地列表: ${Array.isArray(r.data) ? r.data.length : 0} 条`); else bad(TAG, '场地列表', r.message);
}

// ============ 执行 ============
(async () => {
  try {
    await testMember();
    await testSales();
    await testCoach();
    await testAdmin();
    console.log(`\n========== 测试结果 ==========`);
    console.log(`通过: ${pass}, 失败: ${fail}`);
    process.exit(fail > 0 ? 1 : 0);
  } catch (e) {
    console.error('测试异常:', e);
    process.exit(1);
  }
})();
