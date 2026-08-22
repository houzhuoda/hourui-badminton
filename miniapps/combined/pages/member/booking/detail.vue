<template>
  <view class="page" v-if="session">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">课程详情</text>
    </view>
    <view class="info-card">
      <text class="course-name">{{ session.course_name }}</text>
      <text class="biz-tag">{{ bizName(session.business_type) }}</text>
      <view class="info-row">
        <text class="info-label">时间</text>
        <text class="info-value">{{ session.date }} {{ session.start_time }} - {{ session.end_time }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">教练</text>
        <text class="info-value">{{ session.coach_name || '待定' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">场地</text>
        <text class="info-value">{{ session.court_name || '待定' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">容量</text>
        <text class="info-value">已约 {{ session.booked_count }}/{{ session.capacity }}</text>
      </view>
    </view>
    <view class="action-area">
      <button v-if="!booked" class="btn" @click="bookSession">立即预约</button>
      <view v-else class="booked-box"><text class="booked-tag">✓ 您已预约此课</text></view>
    </view>
  </view>
  <view v-else class="page loading">
    <text class="loading-text">加载中...</text>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES } from '../../../utils/constants.js';

export default {
  data() { return { sessionId: '', session: null, booked: false }; },
  onLoad(options) { this.sessionId = options.id; this.loadData(); },
  methods: {
    back() { uni.navigateBack(); },
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    async loadData() {
      try {
        const sessions = await api.availableSessions({});
        this.session = sessions.find((s) => s.id === this.sessionId);
        const bookings = await api.myBookings();
        this.booked = bookings.some((b) => b.session_id === this.sessionId && b.status === 'BOOKED');
      } catch (e) {}
    },
    async bookSession() {
      try {
        await api.bookSession({ sessionId: this.sessionId });
        this.booked = true;
        uni.showModal({
          title: '预约成功',
          content: `${this.session.course_name}\n${this.session.date} ${this.session.start_time}-${this.session.end_time}\n教练：${this.session.coach_name || '待定'}`,
          showCancel: true,
          cancelText: '关闭',
          confirmText: '查看订单',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/member/orders/orders' });
            }
          },
        });
      } catch (e) {}
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg); padding: 40rpx; }
.loading { display: flex; align-items: center; justify-content: center; }
.loading-text { color: var(--text-sec); font-size: 28rpx; }
.header { display: flex; align-items: center; margin-bottom: 40rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; cursor: pointer; }
.title { font-size: 40rpx; font-weight: 800; color: var(--text); }
.info-card { background: var(--card); border-radius: 28rpx; padding: 40rpx; margin-bottom: 40rpx; box-shadow: var(--sp-shadow); }
.course-name { font-size: 38rpx; font-weight: 800; color: var(--text); display: block; margin-bottom: 8rpx; }
.biz-tag { display: inline-block; font-size: 24rpx; color: var(--primary); background: rgba(255,77,40,0.08); padding: 6rpx 20rpx; border-radius: 8rpx; margin-bottom: 24rpx; }
.info-row { display: flex; padding: 20rpx 0; border-bottom: 1rpx solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { width: 120rpx; font-size: 28rpx; color: var(--text-sec); }
.info-value { flex: 1; font-size: 28rpx; color: var(--text); font-weight: 600; }
.action-area { padding: 0 32rpx; }
.booked-box { text-align: center; padding: 40rpx; }
.booked-tag { font-size: 32rpx; color: #2E7D5A; font-weight: 700; }
</style>
