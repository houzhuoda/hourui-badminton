<template>
  <view class="page">
    <view class="category-tabs">
      <view class="tab" :class="{ active: currentBusiness === '' }" @click="setBusiness('')">全部</view>
      <view v-for="b in BUSINESS_TYPES" :key="b.code" class="tab" :class="{ active: currentBusiness === b.code }" @click="setBusiness(b.code)">{{ b.name }}</view>
    </view>

    <view v-if="courses.length === 0" class="empty">暂无可约课程</view>

    <view v-for="c in filteredCourses" :key="c.id" class="course-card" @click="goCourse(c)">
      <view class="course-head">
        <text class="course-name">{{ c.name }}</text>
        <text class="course-tag">{{ businessTypeName(c.business_type) }}</text>
      </view>
      <view class="course-info">
        <text class="price">标准价：￥{{ c.standard_price }}</text>
        <text class="desc" v-if="c.description">{{ c.description }}</text>
        <text class="coach" v-else>点击查看可约课次</text>
      </view>
      <view class="arrow">→</view>
    </view>

    <view class="section" v-if="bookings.length > 0">
      <text class="section-title">我的约课</text>
      <view v-for="b in bookings" :key="b.id" class="booking-row">
        <view>
          <text class="course-name">{{ b.course_name }}</text>
          <text class="booking-time">{{ b.date }} {{ b.start_time }}</text>
        </view>
        <view class="booking-actions">
          <text class="booking-status">{{ bookingStatusName(b.status) }}</text>
          <button size="mini" class="cancel-btn" v-if="b.status === 'BOOKED'" @click.stop="cancelBooking(b)">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { BUSINESS_TYPES, BOOKING_STATUS, businessTypeName } from '../../utils/constants.js';

export default {
  data() { return { BUSINESS_TYPES, currentBusiness: '', courses: [], bookings: [] }; },
  onShow() { this.loadCourses(); this.loadBookings(); },
  computed: {
    filteredCourses() {
      if (!this.currentBusiness) return this.courses;
      return this.courses.filter((c) => c.business_type === this.currentBusiness);
    },
  },
  methods: {
    businessTypeName,
    async loadCourses() {
      try { this.courses = await api.courses({ status: 'ACTIVE' }); } catch (e) {}
    },
    async loadBookings() {
      try { this.bookings = await api.myBookings(); } catch (e) {}
    },
    setBusiness(code) { this.currentBusiness = code; },
    goCourse(c) { uni.navigateTo({ url: `/pages/booking/detail?courseId=${c.id}&courseName=${encodeURIComponent(c.name)}` }); },
    async cancelBooking(b) {
      try { await api.cancelBooking(b.id, { reason: '会员取消' }); uni.showToast({ title: '已取消', icon: 'success' }); this.loadBookings(); } catch (e) {}
    },
    bookingStatusName(s) { return BOOKING_STATUS[s] || s; },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.category-tabs { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 24rpx; }
.tab { padding: 14rpx 28rpx; border-radius: 32rpx; background: #fff; color: #666; font-size: 26rpx; }
.tab.active { background: #13c2c2; color: #fff; }
.empty { text-align: center; color: #999; padding: 100rpx 0; }
.course-card { background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 20rpx; display: flex; align-items: center; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.04); }
.course-head { flex: 1; }
.course-name { font-size: 32rpx; font-weight: bold; color: #333; }
.course-tag { display: block; font-size: 22rpx; color: #13c2c2; background: #e6fffb; padding: 6rpx 14rpx; border-radius: 8rpx; margin-top: 10rpx; width: fit-content; }
.course-info { flex: 1; margin-left: 24rpx; }
.price { display: block; font-size: 28rpx; color: #ff4d4f; font-weight: bold; }
.desc, .coach { display: block; font-size: 24rpx; color: #999; margin-top: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arrow { font-size: 36rpx; color: #ccc; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-top: 24rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.booking-row { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.course-name { font-size: 28rpx; }
.booking-time { display: block; font-size: 24rpx; color: #999; margin-top: 4rpx; }
.booking-actions { display: flex; align-items: center; }
.booking-status { font-size: 24rpx; }
.cancel-btn { background: #ff4d4f; color: #fff; font-size: 22rpx; margin-left: 10rpx; }
</style>
