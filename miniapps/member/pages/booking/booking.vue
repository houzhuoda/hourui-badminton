<template>
  <view class="page">
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: date === today }" @click="setDate(today)">今天</view>
      <view class="filter-item" :class="{ active: date === tomorrow }" @click="setDate(tomorrow)">明天</view>
    </view>

    <view v-if="list.length === 0" class="empty">暂无可约课次</view>

    <view v-for="s in list" :key="s.id" class="session-card" @click="goDetail(s)">
      <view class="session-time">
        <text class="time">{{ s.start_time }} - {{ s.end_time }}</text>
        <text class="course">{{ s.course_name }}</text>
      </view>
      <view class="session-info">
        <text class="coach">教练：{{ s.coach_name }}</text>
        <text class="capacity">可约 {{ s.capacity - s.booked_count }}</text>
      </view>
      <button size="mini" class="book-btn" @click.stop="bookSession(s)" v-if="!isBooked(s.id)">预约</button>
      <text v-else class="booked-tag">已预约</text>
    </view>

    <view class="section">
      <text class="section-title">我的约课</text>
      <view v-if="bookings.length === 0" class="empty">暂无约课</view>
      <view v-for="b in bookings" :key="b.id" class="booking-row">
        <view>
          <text class="course-name">{{ b.course_name }}</text>
          <text class="booking-time">{{ b.date }} {{ b.start_time }}</text>
        </view>
        <view class="booking-actions">
          <text class="booking-status">{{ bookingStatusName(b.status) }}</text>
          <button size="mini" class="cancel-btn" v-if="b.status === 'BOOKED'" @click="cancelBooking(b)">取消</button>
          <button size="mini" class="leave-btn" v-if="b.status === 'BOOKED'" @click="requestLeave(b)">请假</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { BOOKING_STATUS } from '../../utils/constants.js';

export default {
  data() {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { today: fmt(today), tomorrow: fmt(tomorrow), date: fmt(today), list: [], bookings: [] };
  },
  onShow() { this.loadSessions(); this.loadBookings(); },
  methods: {
    async loadSessions() {
      try { this.list = await api.availableSessions({ date: this.date }); } catch (e) {}
    },
    async loadBookings() {
      try { this.bookings = await api.myBookings(); } catch (e) {}
    },
    setDate(d) { this.date = d; this.loadSessions(); },
    isBooked(id) { return this.bookings.some((b) => b.session_id === id && b.status === 'BOOKED'); },
    async bookSession(s) {
      try {
        await api.bookSession({ sessionId: s.id });
        uni.showToast({ title: '预约成功', icon: 'success' });
        this.loadBookings();
      } catch (e) {}
    },
    goDetail(s) { uni.navigateTo({ url: `/pages/booking/detail?id=${s.id}` }); },
    async cancelBooking(b) {
      try { await api.cancelBooking(b.id, { reason: '会员取消' }); uni.showToast({ title: '已取消', icon: 'success' }); this.loadBookings(); } catch (e) {}
    },
    requestLeave(b) {
      uni.navigateTo({ url: `/pages/history/history?action=leave&bookingId=${b.id}` });
    },
    bookingStatusName(s) { return BOOKING_STATUS[s] || s; },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.filter-bar { display: flex; background: #fff; border-radius: 10rpx; margin-bottom: 20rpx; overflow: hidden; }
.filter-item { flex: 1; text-align: center; padding: 20rpx 0; font-size: 28rpx; color: #666; }
.filter-item.active { color: #13c2c2; font-weight: bold; border-bottom: 4rpx solid #13c2c2; }
.empty { text-align: center; color: #999; padding: 60rpx; }
.session-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; display: flex; align-items: center; }
.session-time { width: 180rpx; }
.time { font-size: 28rpx; font-weight: bold; }
.course { display: block; font-size: 24rpx; color: #666; margin-top: 6rpx; }
.session-info { flex: 1; margin-left: 20rpx; }
.coach { font-size: 26rpx; }
.capacity { display: block; font-size: 24rpx; color: #999; margin-top: 6rpx; }
.book-btn { background: #13c2c2; color: #fff; border-radius: 8rpx; font-size: 24rpx; }
.booked-tag { font-size: 24rpx; color: #52c41a; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-top: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.booking-row { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.course-name { font-size: 28rpx; }
.booking-time { display: block; font-size: 24rpx; color: #999; margin-top: 4rpx; }
.booking-actions { display: flex; align-items: center; gap: 10rpx; }
.booking-status { font-size: 24rpx; }
.cancel-btn { background: #ff4d4f; color: #fff; font-size: 22rpx; margin-left: 10rpx; }
.leave-btn { background: #faad14; color: #fff; font-size: 22rpx; margin-left: 10rpx; }
</style>
