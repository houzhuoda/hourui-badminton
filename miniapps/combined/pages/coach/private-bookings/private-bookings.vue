<template>
  <view class="pb-page">
    <view class="pb-hero">
      <view class="pb-hero-top">
        <text class="pb-back" @click="back">‹</text>
        <text class="pb-hero-emoji">📋</text>
        <text class="pb-hero-title">私教/陪练预约</text>
      </view>
      <view class="pb-filter-bar">
        <view class="pb-filter-pill" :class="{ active: statusFilter === '' }" @click="setFilter('')">全部</view>
        <view class="pb-filter-pill" :class="{ active: statusFilter === 'BOOKED' }" @click="setFilter('BOOKED')">已约</view>
        <view class="pb-filter-pill" :class="{ active: statusFilter === 'CANCELLED' }" @click="setFilter('CANCELLED')">已取消</view>
      </view>
    </view>

    <view v-if="list.length === 0" class="pb-empty">
      <text class="pb-empty-emoji">📋</text>
      <text class="pb-empty-text">暂无预约记录</text>
    </view>

    <view v-for="b in list" :key="b.id" class="pb-booking-card">
      <view class="pb-card-top">
        <view class="pb-time-block">
          <text class="pb-date-text">{{ b.date }}</text>
          <text class="pb-time-text">{{ b.start_time }}</text>
          <text class="pb-time-end">- {{ b.end_time }}</text>
        </view>
        <view class="pb-info-block">
          <view class="pb-info-top">
            <text class="pb-member-name">{{ b.member_name }}</text>
            <text class="pb-biz-tag">{{ b.business_type === 'PRIVATE' ? '私教' : '陪练' }}</text>
          </view>
          <text class="pb-member-phone" v-if="b.member_phone">{{ b.member_phone }}</text>
        </view>
      </view>
      <view class="pb-card-bottom">
        <text class="pb-status-tag" :class="b.status">{{ statusName(b.status) }}</text>
        <button v-if="b.status === 'BOOKED'" class="pb-cancel-btn" @click="cancelBooking(b)">取消预约</button>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';

export default {
  data() {
    return {
      list: [],
      statusFilter: '',
    };
  },
  onShow() { this.loadList(); },
  methods: {
    back() { uni.navigateBack(); },
    statusName(s) { return { BOOKED: '已约', CANCELLED: '已取消', COMPLETED: '已完成' }[s] || s; },
    setFilter(f) { this.statusFilter = f; this.loadList(); },
    async loadList() {
      try {
        const params = {};
        if (this.statusFilter) params.status = this.statusFilter;
        this.list = await api.myPrivateBookingsCoach(params);
      } catch (e) {}
    },
    async cancelBooking(b) {
      uni.showModal({
        title: '确认取消',
        content: `确定取消 ${b.member_name} 的预约吗？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.coachCancelPrivate(b.id, { reason: '教练取消' });
              uni.showToast({ title: '已取消', icon: 'success' });
              this.loadList();
            } catch (e) {}
          }
        },
      });
    },
  },
};
</script>

<style scoped>
.pb-page { min-height: 100vh; background: var(--sp-bg); padding-bottom: 40rpx; }

/* Hero header */
.pb-hero { background: var(--grad-orange); padding: 40rpx 32rpx 28rpx; border-bottom-left-radius: 28rpx; border-bottom-right-radius: 28rpx; box-shadow: var(--sp-shadow-orange); margin-bottom: 24rpx; }
.pb-hero-top { display: flex; align-items: center; gap: 12rpx; margin-bottom: 24rpx; }
.pb-back { font-size: 48rpx; color: #fff; margin-right: 8rpx; cursor: pointer; line-height: 1; }
.pb-hero-emoji { font-size: 40rpx; }
.pb-hero-title { font-size: 36rpx; font-weight: 800; color: #fff; }
.pb-filter-bar { display: flex; gap: 12rpx; }
.pb-filter-pill { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 100rpx; font-size: 26rpx; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.15); transition: all 0.2s; }
.pb-filter-pill.active { color: var(--sp-orange); background: #fff; font-weight: 700; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1); }
.pb-filter-pill:active { transform: scale(0.97); }

/* Empty state */
.pb-empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.pb-empty-emoji { font-size: 80rpx; margin-bottom: 20rpx; opacity: 0.4; }
.pb-empty-text { font-size: 28rpx; color: var(--text-sec); }

/* Booking card */
.pb-booking-card { background: var(--card); border-radius: 28rpx; padding: 28rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); }
.pb-card-top { display: flex; align-items: flex-start; margin-bottom: 20rpx; }
.pb-time-block { flex: 0 0 150rpx; min-width: 0; }
.pb-date-text { font-size: 24rpx; color: var(--text-sec); display: block; }
.pb-time-text { font-size: 32rpx; font-weight: 800; color: var(--sp-dark); display: block; margin-top: 8rpx; }
.pb-time-end { font-size: 22rpx; color: var(--text-sec); display: block; margin-top: 6rpx; }
.pb-info-block { flex: 1; min-width: 0; margin-left: 24rpx; overflow: hidden; }
.pb-info-top { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.pb-member-name { font-size: 32rpx; font-weight: 800; color: var(--text); white-space: nowrap; }
.pb-biz-tag { font-size: 22rpx; color: var(--sp-orange); background: rgba(255,77,40,0.08); padding: 4rpx 16rpx; border-radius: 8rpx; font-weight: 600; white-space: nowrap; }
.pb-member-phone { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 10rpx; }
.pb-card-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 20rpx; border-top: 2rpx solid var(--border); }
.pb-status-tag { font-size: 26rpx; font-weight: 700; padding: 6rpx 20rpx; border-radius: 100rpx; }
.pb-status-tag.BOOKED { color: #fff; background: var(--sp-green); }
.pb-status-tag.CANCELLED { color: #fff; background: var(--text-sec); }
.pb-status-tag.COMPLETED { color: #fff; background: var(--sp-orange); }
.pb-cancel-btn { width: auto; min-width: 140rpx; height: 64rpx; line-height: 60rpx; font-size: 24rpx; border-radius: 100rpx !important; background: var(--card) !important; color: var(--sp-red) !important; border: 2rpx solid var(--sp-red) !important; font-weight: 600; padding: 0 28rpx; margin: 0; }
.pb-cancel-btn:active { transform: scale(0.97); }
</style>
