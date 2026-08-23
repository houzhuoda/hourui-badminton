<template>
  <view class="page">
    <view class="course-info" v-if="course">
      <text class="course-name">{{ course.name }}</text>
      <text class="course-type">{{ businessTypeName(course.business_type) }}</text>
      <text class="price">标准价：￥{{ course.standard_price }}</text>
    </view>

    <view class="filter-bar">
      <view class="filter-item" :class="{ active: date === today }" @click="setDate(today)">今天</view>
      <view class="filter-item" :class="{ active: date === tomorrow }" @click="setDate(tomorrow)">明天</view>
      <view class="filter-item" :class="{ active: date === afterTomorrow }" @click="setDate(afterTomorrow)">后天</view>
    </view>

    <view v-if="sessions.length === 0" class="empty">该课程暂无可约课次</view>

    <view v-for="s in sessions" :key="s.id" class="session-card" :class="{ disabled: isBooked(s.id) }">
      <view class="session-main">
        <view class="session-time">{{ s.date }} {{ s.start_time }} - {{ s.end_time }}</view>
        <view class="coach">教练：{{ s.coach_name }}</view>
        <view class="capacity">已约 {{ s.booked_count }}/{{ s.capacity }} · 剩余 {{ s.capacity - s.booked_count }}</view>
      </view>
      <button size="mini" class="book-btn" @click="bookSession(s)" v-if="!isBooked(s.id)">预约</button>
      <text v-else class="booked-tag">已预约</text>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { businessTypeName } from '../../utils/constants.js';

export default {
  data() {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const afterTomorrow = new Date(today); afterTomorrow.setDate(today.getDate() + 2);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return {
      courseId: '', course: null, courseName: '',
      today: fmt(today), tomorrow: fmt(tomorrow), afterTomorrow: fmt(afterTomorrow), date: fmt(today),
      sessions: [], bookings: [],
    };
  },
  onLoad(options) {
    this.courseId = options.courseId;
    this.courseName = options.courseName || '';
    this.loadCourse();
    this.loadSessions();
    this.loadBookings();
  },
  methods: {
    businessTypeName,
    async loadCourse() {
      try {
        const list = await api.courses({ status: 'ACTIVE' });
        this.course = list.find((c) => c.id === this.courseId);
      } catch (e) {}
    },
    async loadSessions() {
      try {
        const list = await api.availableSessions({ courseId: this.courseId, date: this.date });
        this.sessions = list.filter((s) => s.course_id === this.courseId);
      } catch (e) {}
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
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.course-info { background: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 20rpx; }
.course-name { font-size: 36rpx; font-weight: bold; display: block; }
.course-type { display: block; font-size: 24rpx; color: #13c2c2; margin-top: 10rpx; }
.price { display: block; font-size: 28rpx; color: #ff4d4f; font-weight: bold; margin-top: 10rpx; }
.filter-bar { display: flex; background: #fff; border-radius: 10rpx; margin-bottom: 20rpx; overflow: hidden; }
.filter-item { flex: 1; text-align: center; padding: 20rpx 0; font-size: 28rpx; color: #666; }
.filter-item.active { color: #13c2c2; font-weight: bold; border-bottom: 4rpx solid #13c2c2; }
.empty { text-align: center; color: #999; padding: 80rpx 0; }
.session-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; display: flex; align-items: center; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.04); }
.session-card.disabled { opacity: 0.7; }
.session-main { flex: 1; }
.session-time { font-size: 28rpx; font-weight: bold; }
.coach { font-size: 26rpx; color: #666; margin-top: 6rpx; }
.capacity { font-size: 24rpx; color: #999; margin-top: 6rpx; }
.book-btn { background: #13c2c2; color: #fff; border-radius: 8rpx; font-size: 26rpx; }
.booked-tag { font-size: 26rpx; color: #52c41a; }
</style>
