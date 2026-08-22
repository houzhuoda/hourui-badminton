<template>
  <view class="page" v-if="session">
    <view class="session-info">
      <text class="course-name">{{ session.course_name }}</text>
      <text class="time">{{ session.date }} {{ session.start_time }} - {{ session.end_time }}</text>
      <text class="coach">教练：{{ session.coach_name }}</text>
      <text class="capacity">已约 {{ session.booked_count }}/{{ session.capacity }}</text>
    </view>
    <button v-if="!booked" class="submit-btn" @click="bookSession">预约此课</button>
    <text v-else class="booked-tag">您已预约此课</text>
  </view>
</template>

<script>
import { api } from '../../api/index.js';

export default {
  data() { return { sessionId: '', session: null, booked: false }; },
  onLoad(options) { this.sessionId = options.id; this.loadData(); },
  methods: {
    async loadData() {
      try {
        // 假设后端提供课次详情接口
        const sessions = await api.availableSessions({});
        this.session = sessions.find((s) => s.id === this.sessionId);
        const bookings = await api.myBookings();
        this.booked = bookings.some((b) => b.session_id === this.sessionId && b.status === 'BOOKED');
      } catch (e) {}
    },
    async bookSession() {
      try {
        await api.bookSession({ sessionId: this.sessionId });
        uni.showToast({ title: '预约成功', icon: 'success' });
        this.booked = true;
      } catch (e) {}
    },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.session-info { background: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 20rpx; }
.course-name { font-size: 36rpx; font-weight: bold; }
.time { display: block; font-size: 28rpx; color: #666; margin-top: 12rpx; }
.coach { display: block; font-size: 26rpx; color: #666; margin-top: 8rpx; }
.capacity { display: block; font-size: 24rpx; color: #999; margin-top: 8rpx; }
.submit-btn { background: #13c2c2; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; }
.booked-tag { display: block; text-align: center; color: #52c41a; font-size: 32rpx; padding: 30rpx; }
</style>
