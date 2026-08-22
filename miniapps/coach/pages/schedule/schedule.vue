<template>
  <view class="page">
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: range === 'today' }" @click="setRange('today')">今日</view>
      <view class="filter-item" :class="{ active: range === 'week' }" @click="setRange('week')">本周</view>
      <view class="filter-item" :class="{ active: range === 'month' }" @click="setRange('month')">本月</view>
    </view>

    <view v-if="list.length === 0" class="empty">暂无课程</view>

    <view v-for="s in list" :key="s.id" class="session-card" @click="goAttendance(s)">
      <view class="session-time">
        <text class="time">{{ s.start_time }} - {{ s.end_time }}</text>
        <text class="date">{{ s.date }}</text>
      </view>
      <view class="session-info">
        <text class="course-name">{{ s.course_name }}</text>
        <text class="biz-type">{{ businessName(s.business_type) }}</text>
      </view>
      <view class="session-meta">
        <text class="capacity">{{ s.booked_count }}/{{ s.capacity }}人</text>
        <text class="status" :class="s.status">{{ statusName(s.status) }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { businessTypeName } from '../../utils/constants.js';

export default {
  data() { return { list: [], range: 'today' }; },
  onShow() { this.loadSchedule(); },
  methods: {
    setRange(r) { this.range = r; this.loadSchedule(); },
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
      uni.navigateTo({ url: `/pages/attendance/attendance?id=${s.id}` });
    },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.filter-bar { display: flex; background: #fff; border-radius: 10rpx; margin-bottom: 20rpx; overflow: hidden; }
.filter-item { flex: 1; text-align: center; padding: 20rpx 0; font-size: 28rpx; color: #666; }
.filter-item.active { color: #722ed1; font-weight: bold; border-bottom: 4rpx solid #722ed1; }
.empty { text-align: center; color: #999; padding: 80rpx; }
.session-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; display: flex; align-items: center; }
.session-time { width: 160rpx; }
.time { font-size: 28rpx; font-weight: bold; }
.date { display: block; font-size: 22rpx; color: #999; margin-top: 6rpx; }
.session-info { flex: 1; margin-left: 20rpx; }
.course-name { font-size: 30rpx; font-weight: bold; }
.biz-type { display: block; font-size: 24rpx; color: #722ed1; margin-top: 6rpx; }
.session-meta { text-align: right; }
.capacity { font-size: 24rpx; color: #999; display: block; }
.status { font-size: 24rpx; }
.status.SCHEDULED { color: #1890ff; }
.status.COMPLETED { color: #52c41a; }
.status.CANCELLED { color: #ff4d4f; }
</style>
