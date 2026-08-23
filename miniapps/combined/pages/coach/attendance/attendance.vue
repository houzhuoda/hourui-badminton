<template>
  <view class="att-page">
    <!-- 课次信息卡片 -->
    <view class="att-session-card" v-if="session">
      <view class="att-session-top">
        <text class="att-session-emoji">🏸</text>
        <view class="att-session-info">
          <text class="att-course-name">{{ session.course_name }}</text>
          <text class="att-time">{{ session.date }} {{ session.start_time }} - {{ session.end_time }}</text>
        </view>
      </view>
      <view class="att-capacity-bar">
        <text class="att-capacity-text">已约 {{ bookedCount }}/{{ session.capacity }} 人</text>
        <text class="att-status-tag" :class="session.status">{{ sessionStatusName(session.status) }}</text>
      </view>
    </view>

    <!-- 出勤状态提示 -->
    <view class="att-notice" v-if="session && session.status === 'SCHEDULED'">
      <text v-if="canMarkAttendance" class="att-notice-text active">✅ 可开始出勤登记</text>
      <text v-else class="att-notice-text">⏰ 开课前5分钟可开始签到（{{ countdownText }}）</text>
    </view>

    <!-- 已出勤完成提示 -->
    <view class="att-notice" v-if="session && session.status === 'COMPLETED'">
      <text class="att-notice-text done">✅ 本节课已完成出勤登记</text>
    </view>

    <!-- 学员列表 -->
    <view class="att-section">
      <view class="att-section-header">
        <text class="att-section-title">已预约学员</text>
        <text class="att-section-count" v-if="members.length">{{ members.length }} 人</text>
      </view>
      <view v-if="members.length === 0" class="att-empty">暂无学员预约</view>

      <view v-for="m in members" :key="m.member_id" class="att-member-card">
        <view class="att-member-info">
          <view class="att-avatar">{{ m.member_name ? m.member_name.charAt(0) : '?' }}</view>
          <view class="att-member-detail">
            <text class="att-member-name">{{ m.member_name || '未知' }}</text>
            <text class="att-member-status" :class="m.status">{{ memberStatusName(m.status) }}</text>
          </view>
        </view>

        <!-- 未登记状态：显示出勤操作按钮 -->
        <view class="att-action-btns" v-if="!m.status && canMarkAttendance">
          <button size="mini" class="att-btn-present" @click="markOne(m.member_id, 'PRESENT')">出勤</button>
          <button size="mini" class="att-btn-leave" @click="markOne(m.member_id, 'LEAVE')">请假</button>
          <button size="mini" class="att-btn-absent" @click="markOne(m.member_id, 'ABSENT')">缺勤</button>
        </view>

        <!-- 未到签到时间 -->
        <view class="att-action-btns" v-else-if="!m.status && !canMarkAttendance">
          <text class="att-wait-text">待签到</text>
        </view>

        <!-- 已登记状态：可修改 -->
        <view class="att-action-btns" v-else-if="m.status">
          <button size="mini" class="att-btn-edit" @click="changeStatus(m)">修改</button>
        </view>
      </view>
    </view>

    <!-- 批量出勤按钮 -->
    <button
      class="att-submit-btn"
      v-if="hasUnregistered && canMarkAttendance"
      @click="submitAllPresent"
      :loading="loading"
    >一键全部出勤（{{ unregisteredCount }}人）</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { ATTENDANCE_STATUS } from '../../../utils/constants.js';

export default {
  data() { return { sessionId: '', session: null, members: [], loading: false, nowTimer: null, currentTime: Date.now() }; },
  computed: {
    bookedCount() { return this.members.length; },
    hasUnregistered() { return this.members.some((m) => !m.status); },
    unregisteredCount() { return this.members.filter((m) => !m.status).length; },
    canMarkAttendance() {
      if (!this.session) return false;
      // 已取消的课次不能操作
      if (this.session.status === 'CANCELLED') return false;
      const sessionTime = new Date(`${this.session.date}T${this.session.start_time}:00`);
      const diff = sessionTime.getTime() - this.currentTime;
      // 开课前5分钟（300000ms）内，或已经开始（允许迟到签到）
      return diff <= 300000;
    },
    countdownText() {
      if (!this.session) return '';
      const sessionTime = new Date(`${this.session.date}T${this.session.start_time}:00`);
      const diff = sessionTime.getTime() - this.currentTime;
      if (diff <= 0) return '已到上课时间';
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `还有${mins}分钟`;
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `还有${hours}小时${remainMins}分`;
    },
  },
  onLoad(options) { this.sessionId = options.id; },
  onShow() {
    this.loadData();
    // 每秒更新当前时间，驱动倒计时和按钮状态
    this.nowTimer = setInterval(() => { this.currentTime = Date.now(); }, 1000);
  },
  onHide() { if (this.nowTimer) { clearInterval(this.nowTimer); this.nowTimer = null; } },
  onUnload() { if (this.nowTimer) { clearInterval(this.nowTimer); this.nowTimer = null; } },
  methods: {
    async loadData() {
      try {
        this.session = await api.sessionDetail(this.sessionId);
        const att = await api.sessionAttendance(this.sessionId);
        // 用 bookings 列表（大课会员通过预约进入），同时合并 participants（管理员指派）
        const allMembers = [];
        const seenIds = new Set();
        // 优先从 bookings 取已预约会员
        (this.session.bookings || []).forEach((b) => {
          const mid = b.member_id || b.id;
          if (!seenIds.has(mid)) {
            seenIds.add(mid);
            allMembers.push({ member_id: mid, member_name: b.member_name, booking_status: b.status });
          }
        });
        // 补充 participants 中未被 bookings 覆盖的
        (this.session.participants || []).forEach((p) => {
          const mid = p.member_id || p.id;
          if (!seenIds.has(mid)) {
            seenIds.add(mid);
            allMembers.push({ member_id: mid, member_name: p.member_name, booking_status: 'ENROLLED' });
          }
        });
        // 合并出勤记录
        const attMap = {};
        (att || []).forEach((a) => { attMap[a.member_id] = a; });
        this.members = allMembers.map((m) => ({
          ...m,
          status: attMap[m.member_id]?.status,
        }));
      } catch (e) {}
    },
    async markOne(memberId, status) {
      this.loading = true;
      try {
        await api.submitAttendance(this.sessionId, { attendance: [{ memberId, status }] });
        uni.showToast({ title: status === 'PRESENT' ? '已出勤' : status === 'LEAVE' ? '已请假' : '已缺勤', icon: 'success' });
        this.loadData();
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      this.loading = false;
    },
    async submitAllPresent() {
      const unregistered = this.members.filter((m) => !m.status);
      if (unregistered.length === 0) return;
      uni.showModal({
        title: '确认批量出勤',
        content: `将 ${unregistered.length} 名未登记学员全部标记为出勤，系统将自动扣减对应会员资产。`,
        success: async (res) => {
          if (!res.confirm) return;
          this.loading = true;
          try {
            await api.submitAttendance(this.sessionId, {
              attendance: unregistered.map((m) => ({ memberId: m.member_id, status: 'PRESENT' })),
            });
            uni.showToast({ title: '批量出勤成功，已消课', icon: 'success' });
            this.loadData();
          } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
          this.loading = false;
        },
      });
    },
    changeStatus(m) {
      uni.showActionSheet({
        itemList: ['出勤', '请假', '缺勤'],
        success: (res) => {
          const statuses = ['PRESENT', 'LEAVE', 'ABSENT'];
          api.updateAttendance(this.sessionId, m.member_id, { status: statuses[res.tapIndex], reason: '教练修改' })
            .then(() => { uni.showToast({ title: '已修改', icon: 'success' }); this.loadData(); })
            .catch(() => {});
        },
      });
    },
    sessionStatusName(s) { return { SCHEDULED: '待上课', COMPLETED: '已完成', CANCELLED: '已取消' }[s] || s; },
    memberStatusName(s) {
      if (!s) return '未登记';
      const found = ATTENDANCE_STATUS.find((a) => a.code === s);
      return found ? found.name : s;
    },
  },
};
</script>

<style scoped>
.att-page { padding: 32rpx; background: var(--sp-bg); min-height: 100vh; }

/* Session info card */
.att-session-card { background: var(--grad-orange); border-radius: 28rpx; padding: 28rpx; margin-bottom: 20rpx; box-shadow: var(--sp-shadow-orange); }
.att-session-top { display: flex; align-items: center; gap: 16rpx; }
.att-session-emoji { font-size: 44rpx; }
.att-session-info { flex: 1; min-width: 0; }
.att-course-name { display: block; font-size: 34rpx; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.att-time { display: block; font-size: 26rpx; color: rgba(255,255,255,0.9); margin-top: 8rpx; white-space: nowrap; }
.att-capacity-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 20rpx; background: rgba(255,255,255,0.2); border-radius: 100rpx; padding: 10rpx 24rpx; }
.att-capacity-text { font-size: 24rpx; color: #fff; font-weight: 600; }
.att-status-tag { font-size: 22rpx; font-weight: 700; padding: 4rpx 16rpx; border-radius: 100rpx; background: rgba(255,255,255,0.3); color: #fff; }
.att-status-tag.COMPLETED { background: rgba(16,185,129,0.5); }
.att-status-tag.CANCELLED { background: rgba(239,68,68,0.5); }

/* Notice */
.att-notice { background: var(--card); border-radius: 20rpx; padding: 20rpx 28rpx; margin-bottom: 20rpx; box-shadow: var(--sp-shadow-sm); }
.att-notice-text { font-size: 26rpx; color: var(--text-sec); font-weight: 600; }
.att-notice-text.active { color: var(--sp-green); }
.att-notice-text.done { color: var(--sp-green); }

/* Section */
.att-section { background: var(--card); border-radius: 28rpx; padding: 28rpx; box-shadow: var(--sp-shadow); }
.att-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.att-section-title { font-size: 30rpx; font-weight: 800; color: var(--text); }
.att-section-count { font-size: 24rpx; color: var(--sp-orange); font-weight: 700; background: rgba(255,77,40,0.08); padding: 4rpx 16rpx; border-radius: 100rpx; }
.att-empty { text-align: center; color: var(--text-sec); padding: 60rpx 0; font-size: 28rpx; }

/* Member card */
.att-member-card { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 0; border-bottom: 2rpx solid var(--border); }
.att-member-card:last-child { border-bottom: none; }
.att-member-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 16rpx; overflow: hidden; }
.att-avatar { flex-shrink: 0; width: 64rpx; height: 64rpx; border-radius: 50%; background: var(--grad-orange); display: flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 800; color: #fff; }
.att-member-detail { flex: 1; min-width: 0; overflow: hidden; }
.att-member-name { display: block; font-size: 30rpx; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.att-member-status { display: block; font-size: 24rpx; margin-top: 6rpx; color: var(--text-sec); }
.att-member-status.PRESENT { color: var(--sp-green); }
.att-member-status.LEAVE { color: var(--sp-amber); }
.att-member-status.ABSENT { color: var(--sp-red); }
.att-member-status.PENDING_PAY { color: var(--sp-red); }

.att-action-btns { display: flex; gap: 10rpx; flex-shrink: 0; align-items: center; }
.att-wait-text { font-size: 24rpx; color: var(--text-sec); }
.att-btn-present { background: var(--sp-green) !important; color: #fff !important; border-radius: 100rpx !important; font-size: 24rpx !important; height: 60rpx; line-height: 60rpx; padding: 0 24rpx; margin: 0; min-width: 0; }
.att-btn-present:active { transform: scale(0.97); }
.att-btn-leave { background: var(--sp-amber) !important; color: #fff !important; border-radius: 100rpx !important; font-size: 24rpx !important; height: 60rpx; line-height: 60rpx; padding: 0 24rpx; margin: 0; min-width: 0; }
.att-btn-leave:active { transform: scale(0.97); }
.att-btn-absent { background: var(--sp-red) !important; color: #fff !important; border-radius: 100rpx !important; font-size: 24rpx !important; height: 60rpx; line-height: 60rpx; padding: 0 24rpx; margin: 0; min-width: 0; }
.att-btn-absent:active { transform: scale(0.97); }
.att-btn-edit { background: var(--card) !important; color: var(--text-sec) !important; border: 2rpx solid var(--border) !important; border-radius: 100rpx !important; font-size: 24rpx !important; height: 60rpx; line-height: 56rpx; padding: 0 28rpx; margin: 0; min-width: 0; }
.att-btn-edit:active { transform: scale(0.97); }

/* Submit button */
.att-submit-btn { background: var(--grad-orange) !important; color: #fff !important; border-radius: 100rpx !important; height: 96rpx; line-height: 96rpx; font-size: 32rpx; font-weight: 700; margin-top: 24rpx; box-shadow: var(--sp-shadow-orange); }
.att-submit-btn:active { transform: scale(0.97); }
</style>
