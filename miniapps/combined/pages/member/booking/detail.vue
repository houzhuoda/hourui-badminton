<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">{{ courseName || '课程预约' }}</text>
    </view>

    <view v-if="course" class="course-info">
      <view class="course-info-bg"></view>
      <view class="course-info-content">
        <text class="course-name">{{ course.name }}</text>
        <view class="course-tags">
          <text class="course-type">{{ bizName(course.business_type) }}</text>
          <text class="price">💰 ￥{{ course.standard_price }}</text>
        </view>
        <text class="desc" v-if="course.description">{{ course.description }}</text>
      </view>
    </view>

    <view class="filter-bar">
      <view class="filter-item" :class="{ active: date === today }" @click="setDate(today)">今天</view>
      <view class="filter-item" :class="{ active: date === tomorrow }" @click="setDate(tomorrow)">明天</view>
      <view class="filter-item" :class="{ active: date === afterTomorrow }" @click="setDate(afterTomorrow)">后天</view>
      <view class="filter-item" :class="{ active: date === next3 }" @click="setDate(next3)">三天后</view>
    </view>

    <view v-if="sessions.length === 0" class="empty">
      <text class="empty-emoji">📅</text>
      <text class="empty-text">该课程所选日期暂无可约课次</text>
    </view>

    <view v-for="s in sessions" :key="s.id" class="session-card" :class="{ disabled: isBooked(s.id) }">
      <view class="card-main">
        <view class="time-col">
          <text class="time-text">{{ s.start_time }}</text>
          <text class="time-end">- {{ s.end_time }}</text>
        </view>
        <view class="info-col">
          <view class="info-head">
            <text class="course-name">{{ s.course_name }}</text>
            <text class="biz-tag">{{ bizName(s.business_type) }}</text>
          </view>
          <view class="info-meta">
            <text class="meta-text">🏸 教练 {{ s.coach_name || '待定' }}</text>
            <text class="meta-text" v-if="s.court_name">· {{ s.court_name }}</text>
          </view>
          <text class="capacity">可约 {{ s.available_slots }} 位</text>
        </view>
      </view>
      <view class="card-action">
        <button class="book-btn" @click="bookSession(s)" v-if="!isBooked(s.id)">立即预约</button>
        <text v-else class="booked-tag">已预约</text>
      </view>
    </view>

    <view v-if="serviceVisible" class="service-mask" @click="serviceVisible = false">
      <view class="service-sheet" @click.stop>
        <view class="service-handle"></view>
        <text class="service-title">需要开通课包才能约课</text>
        <text class="service-desc">您当前没有该课程的有效次卡或月卡，请添加客服微信开通课包</text>
        <view v-if="serviceWechatQr" class="service-qr-box">
          <image :src="serviceWechatQr" mode="aspectFit" class="service-qr" />
        </view>
        <view v-if="serviceWechat" class="service-wechat-box">
          <text class="service-wechat-label">客服微信：</text>
          <text class="service-wechat-value">{{ serviceWechat }}</text>
          <text class="service-copy" @click="copyWechat">复制</text>
        </view>
        <button class="service-btn" @click="serviceVisible = false">我知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, BOOKING_STATUS } from '../../../utils/constants.js';

export default {
  data() {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const afterTomorrow = new Date(today); afterTomorrow.setDate(today.getDate() + 2);
    const next3 = new Date(today); next3.setDate(today.getDate() + 3);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return {
      courseId: '', course: null, courseName: '', businessType: '',
      today: fmt(today), tomorrow: fmt(tomorrow), afterTomorrow: fmt(afterTomorrow), next3: fmt(next3), date: fmt(today),
      sessions: [], bookings: [],
      serviceVisible: false, serviceWechat: '', serviceWechatQr: '',
    };
  },
  onLoad(options) {
    this.courseId = options.courseId;
    this.courseName = options.courseName || '';
    this.businessType = options.businessType || '';
    this.loadCourse();
    this.loadBookings();
    this.loadSessions();
  },
  methods: {
    back() { uni.navigateBack(); },
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    bookingStatusName(s) { return BOOKING_STATUS[s] || s; },
    async loadCourse() {
      try {
        const list = await api.courseList();
        this.course = list.find((c) => c.id === this.courseId);
      } catch (e) {}
    },
    async loadBookings() {
      try { this.bookings = await api.myBookings(); } catch (e) {}
    },
    async loadSessions() {
      try {
        const params = { courseId: this.courseId, date: this.date };
        this.sessions = await api.availableSessions(params);
      } catch (e) { this.sessions = []; }
    },
    setDate(d) { this.date = d; this.loadSessions(); },
    isBooked(id) { return this.bookings.some((b) => b.session_id === id && b.status === 'BOOKED'); },
    async bookSession(s) {
      try {
        await api.bookSession({ sessionId: s.id });
        this.loadBookings(); this.loadSessions();
        uni.showToast({ title: '预约成功', icon: 'success' });
      } catch (e) {
        if (e.message === 'NO_PACK' && e.data) {
          this.serviceWechat = e.data.serviceWechat || '';
          this.serviceWechatQr = e.data.serviceWechatQr || '';
          this.serviceVisible = true;
        } else {
          uni.showToast({ title: e.message || '预约失败', icon: 'none' });
        }
      }
    },
    copyWechat() {
      if (this.serviceWechat) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(this.serviceWechat);
        }
        uni.showToast({ title: '已复制', icon: 'success' });
      }
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--sp-bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 32rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; transition: transform 0.15s ease; }
.back:active { transform: scale(0.9); }
.title { font-size: 40rpx; font-weight: 800; color: var(--sp-dark); }
.course-info { border-radius: 28rpx; padding: 36rpx 32rpx; margin: 0 32rpx 24rpx 32rpx; position: relative; overflow: hidden; box-shadow: var(--sp-shadow); }
.course-info-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--grad-dark); }
.course-info-content { position: relative; z-index: 1; }
.course-name { font-size: 38rpx; font-weight: 800; color: #fff; display: block; }
.course-tags { display: flex; align-items: center; gap: 16rpx; margin-top: 16rpx; }
.course-type { font-size: 24rpx; color: #fff; background: rgba(255,255,255,0.2); padding: 8rpx 20rpx; border-radius: 100rpx; font-weight: 600; }
.price { font-size: 28rpx; color: var(--sp-amber); font-weight: 700; }
.desc { display: block; font-size: 24rpx; color: rgba(255,255,255,0.7); margin-top: 16rpx; line-height: 1.6; }
.filter-bar { display: flex; padding: 0 32rpx; gap: 16rpx; margin-bottom: 24rpx; }
.filter-item { flex: 1; text-align: center; padding: 20rpx 0; font-size: 28rpx; color: var(--text-sec); background: var(--card); border-radius: 100rpx; font-weight: 600; box-shadow: var(--sp-shadow-sm); transition: transform 0.15s ease; }
.filter-item:active { transform: scale(0.97); }
.filter-item.active { color: #fff; background: var(--grad-orange); box-shadow: var(--sp-shadow-orange); }
.empty { text-align: center; padding: 80rpx 0; }
.empty-emoji { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }
.session-card { background: var(--card); border-radius: 24rpx; padding: 32rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); border-left: 8rpx solid var(--sp-orange); }
.session-card.disabled { opacity: 0.6; border-left-color: var(--text-sec); }
.card-main { display: flex; align-items: flex-start; }
.time-col { width: 150rpx; }
.time-text { font-size: 34rpx; font-weight: 800; color: var(--sp-dark); display: block; }
.time-end { font-size: 22rpx; color: var(--text-sec); display: block; margin-top: 8rpx; }
.info-col { flex: 1; margin-left: 24rpx; }
.info-head { margin-bottom: 12rpx; display: flex; align-items: center; }
.course-name { font-size: 32rpx; font-weight: 800; color: var(--sp-dark); }
.biz-tag { font-size: 22rpx; color: var(--sp-orange); background: rgba(255,77,40,0.1); padding: 6rpx 18rpx; border-radius: 100rpx; margin-left: 12rpx; font-weight: 600; }
.info-meta { margin-bottom: 12rpx; }
.meta-text { font-size: 24rpx; color: var(--text-sec); }
.capacity { font-size: 26rpx; color: var(--sp-green); font-weight: 700; }
.card-action { margin-top: 24rpx; }
.book-btn { width: 100%; height: 84rpx; line-height: 84rpx; font-size: 28rpx; border-radius: 100rpx; background: var(--grad-orange); color: #fff; font-weight: 700; box-shadow: var(--sp-shadow-orange); }
.book-btn:active { transform: scale(0.97); }
.booked-tag { display: block; text-align: center; font-size: 28rpx; color: var(--sp-green); font-weight: 700; padding: 20rpx 0; background: rgba(16,185,129,0.1); border-radius: 100rpx; }

.service-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.5); z-index: 999; display: flex; align-items: flex-end; }
.service-sheet { width: 100%; background: #fff; border-radius: 32rpx 32rpx 0 0; padding: 24rpx 40rpx 48rpx; display: flex; flex-direction: column; align-items: center; animation: serviceUp 0.25s ease; }
@keyframes serviceUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.service-handle { width: 64rpx; height: 8rpx; background: #E5E7EB; border-radius: 100rpx; margin-bottom: 28rpx; }
.service-title { font-size: 36rpx; font-weight: 800; color: var(--sp-dark); margin-bottom: 16rpx; }
.service-desc { font-size: 28rpx; color: var(--text-sec); text-align: center; line-height: 1.6; margin-bottom: 32rpx; }
.service-qr-box { margin-bottom: 24rpx; }
.service-qr { width: 360rpx; height: 360rpx; border-radius: 16rpx; }
.service-wechat-box { display: flex; align-items: center; background: var(--sp-bg); border-radius: 16rpx; padding: 20rpx 28rpx; margin-bottom: 32rpx; }
.service-wechat-label { font-size: 28rpx; color: var(--text-sec); }
.service-wechat-value { font-size: 32rpx; font-weight: 700; color: var(--sp-dark); margin: 0 16rpx; }
.service-copy { font-size: 26rpx; color: var(--sp-orange); font-weight: 600; padding: 8rpx 20rpx; background: var(--sp-bg-warm); border-radius: 100rpx; }
.service-btn { width: 100%; height: 88rpx; line-height: 88rpx; border-radius: 24rpx; background: var(--grad-orange); color: #fff; font-size: 32rpx; font-weight: 700; box-shadow: var(--sp-shadow-orange); }
.service-btn:active { transform: scale(0.97); }
</style>
