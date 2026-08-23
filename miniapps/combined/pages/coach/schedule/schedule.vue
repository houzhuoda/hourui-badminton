<template>
  <view class="sched-page">
    <view class="sched-hero">
      <view class="sched-hero-top">
        <view class="sched-hero-info">
          <text class="sched-hero-emoji">🏸</text>
          <text class="sched-hero-title">我的课表</text>
        </view>
        <button class="sched-switch-btn" size="mini" @click="switchRole">切换身份</button>
      </view>
      <view class="sched-range-bar">
        <view class="sched-range-pill" :class="{ active: range === 'today' }" @click="setRange('today')">今日</view>
        <view class="sched-range-pill" :class="{ active: range === 'week' }" @click="setRange('week')">本周</view>
        <view class="sched-range-pill" :class="{ active: range === 'month' }" @click="setRange('month')">本月</view>
      </view>
    </view>

    <view v-if="list.length === 0" class="sched-empty">
      <text class="sched-empty-emoji">🏸</text>
      <text class="sched-empty-text">暂无课程安排</text>
    </view>

    <view v-for="group in groupedList" :key="group.date" class="sched-date-card">
      <view class="sched-date-header">
        <view class="sched-date-badge">
          <text class="sched-date-day">{{ group.day }}</text>
          <text class="sched-date-week">{{ group.week }}</text>
        </view>
        <view class="sched-date-line"></view>
        <text v-if="group.gap" class="sched-date-gap">{{ group.gap }}</text>
      </view>
      <view class="sched-sessions">
        <view v-for="s in group.sessions" :key="s.id" class="sched-session-row" @click="goAttendance(s)">
          <view class="sched-time-col">
            <text class="sched-time-start">{{ s.start_time }}</text>
            <text class="sched-time-end">{{ s.end_time }}</text>
          </view>
          <view class="sched-info-col">
            <text class="sched-course-name">{{ s.course_name }}</text>
            <view class="sched-info-tags">
              <text class="sched-biz-tag">{{ businessName(s.business_type) }}</text>
              <text class="sched-capacity">{{ s.booked_count }}/{{ s.capacity }} 人</text>
            </view>
          </view>
          <view class="sched-status-col">
            <text class="sched-status-badge" :class="s.status">{{ statusName(s.status) }}</text>
            <text v-if="s.status === 'SCHEDULED' && s.booked_count > 0" class="sched-arrow">›</text>
          </view>
        </view>
      </view>
    </view>
    <CoachTabBar active="schedule" />
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { businessTypeName } from '../../../utils/constants.js';
import CoachTabBar from '../../../components/CoachTabBar.vue';

export default {
  components: { CoachTabBar },
  data() { return { list: [], range: 'today' }; },
  onShow() { this.loadSchedule(); },
  computed: {
    groupedList() {
      const groups = {};
      [...this.list].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`)).forEach((session) => {
        if (!groups[session.date]) {
          const d = new Date(`${session.date}T00:00:00`);
          const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          groups[session.date] = { date: session.date, day: session.date.slice(5), week: weekNames[d.getDay()], sessions: [] };
        }
        groups[session.date].sessions.push(session);
      });
      const dates = Object.values(groups);
      return dates.map((group, index) => ({
        ...group,
        gap: index > 0 ? this.dateGap(dates[index - 1].date, group.date) : '',
      }));
    },
  },
  methods: {
    setRange(r) { this.range = r; this.loadSchedule(); },
    dateGap(previous, current) {
      const days = Math.round((new Date(`${current}T00:00:00`) - new Date(`${previous}T00:00:00`)) / 86400000);
      return days > 1 ? `间隔${days - 1}天` : '';
    },
    async loadSchedule() {
      const today = new Date();
      let startDate, endDate;
      if (this.range === 'today') {
        startDate = endDate = this.fmtDate(today);
      } else if (this.range === 'week') {
        const day = today.getDay() || 7;
        const monday = new Date(today); monday.setDate(today.getDate() - day + 1);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        startDate = this.fmtDate(monday); endDate = this.fmtDate(sunday);
      } else {
        startDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
        endDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-31`;
      }
      try { this.list = await api.mySchedule({ startDate, endDate }); } catch (e) {}
    },
    fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    businessName(b) { return businessTypeName(b); },
    statusName(s) { return { SCHEDULED: '待上课', COMPLETED: '已完成', CANCELLED: '已取消' }[s] || s; },
    goAttendance(s) {
      if (s.status === 'CANCELLED') return;
      if (s.status === 'SCHEDULED' && (!s.booked_count || s.booked_count === 0)) {
        uni.showToast({ title: '暂无学员预约', icon: 'none' });
        return;
      }
      uni.navigateTo({ url: `/pages/coach/attendance/attendance?id=${s.id}` });
    },
    async switchRole() {
      const memberToken = uni.getStorageSync('memberToken');
      const memberUser = uni.getStorageSync('memberUser');
      if (memberToken && memberUser) {
        uni.setStorageSync('token', memberToken);
        uni.setStorageSync('user', memberUser);
        uni.setStorageSync('role', 'member');
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = memberToken; app.globalData.user = JSON.parse(memberUser); app.globalData.role = 'member'; }
        uni.reLaunch({ url: '/pages/member/assets/assets' });
        return;
      }
      try {
        const d = await api.switchIdentity('member');
        uni.setStorageSync('token', d.token); uni.setStorageSync('user', JSON.stringify(d.user)); uni.setStorageSync('role', 'member');
        uni.reLaunch({ url: '/pages/member/assets/assets' });
      } catch (e) { uni.showToast({ title: e.message || '无法返回会员端', icon: 'none' }); }
    },
  },
};
</script>

<style scoped>
.sched-page { padding: 32rpx; padding-bottom: 160rpx; background: var(--sp-bg); min-height: 100vh; }

/* Hero header */
.sched-hero { background: var(--grad-orange); border-radius: 28rpx; padding: 32rpx 28rpx 24rpx; margin-bottom: 24rpx; box-shadow: var(--sp-shadow-orange); }
.sched-hero-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.sched-hero-info { display: flex; align-items: center; gap: 12rpx; }
.sched-hero-emoji { font-size: 40rpx; }
.sched-hero-title { font-size: 36rpx; font-weight: 800; color: #fff; }
.sched-switch-btn { background: rgba(255,255,255,0.25) !important; color: #fff !important; border: 2rpx solid rgba(255,255,255,0.4) !important; border-radius: 100rpx !important; height: 60rpx; line-height: 60rpx; padding: 0 28rpx; font-size: 24rpx; margin: 0; min-width: 0; width: auto; }
.sched-switch-btn:active { transform: scale(0.97); }
.sched-range-bar { display: flex; gap: 12rpx; }
.sched-range-pill { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 100rpx; font-size: 26rpx; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.15); transition: all 0.2s; }
.sched-range-pill.active { color: #FF4D28; background: #fff; font-weight: 700; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1); }
.sched-range-pill:active { transform: scale(0.97); }

/* Empty state */
.sched-empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.sched-empty-emoji { font-size: 80rpx; margin-bottom: 20rpx; opacity: 0.4; }
.sched-empty-text { font-size: 28rpx; color: var(--text-sec); }

/* Date card */
.sched-date-card { background: var(--card); border-radius: 28rpx; margin-bottom: 24rpx; box-shadow: var(--sp-shadow); overflow: hidden; }
.sched-date-header { display: flex; align-items: center; padding: 24rpx 28rpx; background: var(--sp-bg-warm); border-bottom: 2rpx solid var(--border); }
.sched-date-badge { display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--grad-orange); border-radius: 16rpx; padding: 10rpx 24rpx; flex-shrink: 0; box-shadow: var(--sp-shadow-orange); }
.sched-date-day { font-size: 28rpx; font-weight: 800; color: #fff; white-space: nowrap; line-height: 1.2; }
.sched-date-week { font-size: 20rpx; color: rgba(255,255,255,0.9); white-space: nowrap; margin-top: 2rpx; }
.sched-date-line { flex: 1; height: 2rpx; background: var(--border); margin: 0 20rpx; }
.sched-date-gap { font-size: 22rpx; color: var(--sp-amber); font-weight: 600; white-space: nowrap; flex-shrink: 0; background: rgba(245,158,11,0.1); padding: 6rpx 16rpx; border-radius: 100rpx; }

/* Sessions */
.sched-sessions { padding: 12rpx 20rpx 20rpx; }
.sched-session-row { display: flex; align-items: center; padding: 24rpx 16rpx; border-radius: 20rpx; margin-top: 12rpx; background: var(--sp-bg); transition: all 0.2s; }
.sched-session-row:first-child { margin-top: 0; }
.sched-session-row:active { transform: scale(0.97); background: var(--sp-bg-warm); }
.sched-time-col { flex: 0 0 120rpx; min-width: 0; display: flex; flex-direction: column; align-items: center; border-right: 2rpx solid var(--border); padding-right: 16rpx; }
.sched-time-start { font-size: 28rpx; font-weight: 800; color: var(--sp-dark); white-space: nowrap; line-height: 1.3; }
.sched-time-end { font-size: 22rpx; color: var(--text-sec); white-space: nowrap; margin-top: 4rpx; }
.sched-info-col { flex: 1 1 auto; min-width: 0; margin-left: 20rpx; overflow: hidden; }
.sched-course-name { display: block; font-size: 30rpx; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sched-info-tags { display: flex; align-items: center; gap: 12rpx; margin-top: 10rpx; }
.sched-biz-tag { font-size: 22rpx; color: var(--sp-orange); background: rgba(255,77,40,0.08); padding: 4rpx 14rpx; border-radius: 8rpx; white-space: nowrap; font-weight: 600; }
.sched-capacity { font-size: 22rpx; color: var(--text-sec); white-space: nowrap; }
.sched-status-col { flex: 0 0 auto; margin-left: 12rpx; display: flex; align-items: center; gap: 8rpx; }
.sched-status-badge { font-size: 22rpx; font-weight: 700; padding: 8rpx 20rpx; border-radius: 100rpx; white-space: nowrap; display: block; text-align: center; }
.sched-arrow { font-size: 32rpx; color: var(--text-sec); }
.sched-status-badge.SCHEDULED { color: #fff; background: var(--sp-cyan); }
.sched-status-badge.COMPLETED { color: #fff; background: var(--sp-green); }
.sched-status-badge.CANCELLED { color: #fff; background: var(--sp-red); }
</style>
