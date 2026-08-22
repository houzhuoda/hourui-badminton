<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">私教/陪练预约</text>
    </view>

    <view class="filter-bar">
      <view class="filter-item" :class="{ active: statusFilter === '' }" @click="setFilter('')">全部</view>
      <view class="filter-item" :class="{ active: statusFilter === 'BOOKED' }" @click="setFilter('BOOKED')">已约</view>
      <view class="filter-item" :class="{ active: statusFilter === 'CANCELLED' }" @click="setFilter('CANCELLED')">已取消</view>
    </view>

    <view v-if="list.length === 0" class="empty">暂无预约记录</view>

    <view v-for="b in list" :key="b.id" class="booking-card">
      <view class="card-top">
        <view class="time-block">
          <text class="date-text">{{ b.date }}</text>
          <text class="time-text">{{ b.start_time }}</text>
          <text class="time-end">- {{ b.end_time }}</text>
        </view>
        <view class="info-block">
          <text class="member-name">{{ b.member_name }}</text>
          <text class="biz-tag">{{ b.business_type === 'PRIVATE' ? '私教' : '陪练' }}</text>
          <text class="member-phone" v-if="b.member_phone">{{ b.member_phone }}</text>
        </view>
      </view>
      <view class="card-bottom">
        <text class="status-tag" :class="b.status">{{ statusName(b.status) }}</text>
        <button v-if="b.status === 'BOOKED'" class="cancel-btn" @click="cancelBooking(b)">取消预约</button>
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
.page { min-height: 100vh; background: var(--bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 40rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; cursor: pointer; }
.title { font-size: 40rpx; font-weight: 800; color: var(--text); }
.filter-bar { display: flex; padding: 0 32rpx; gap: 16rpx; margin-bottom: 20rpx; }
.filter-item { padding: 12rpx 28rpx; border-radius: 12rpx; font-size: 26rpx; color: var(--text-sec); background: var(--card); }
.filter-item.active { color: #fff; background: var(--primary); font-weight: 600; }
.empty { text-align: center; color: var(--text-sec); padding: 80rpx; font-size: 28rpx; }
.booking-card { background: var(--card); border-radius: 24rpx; padding: 32rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); }
.card-top { display: flex; align-items: flex-start; margin-bottom: 20rpx; }
.time-block { width: 150rpx; }
.date-text { font-size: 24rpx; color: var(--text-sec); display: block; }
.time-text { font-size: 32rpx; font-weight: 800; color: var(--text); display: block; margin-top: 8rpx; }
.time-end { font-size: 22rpx; color: var(--text-sec); display: block; margin-top: 8rpx; }
.info-block { flex: 1; margin-left: 24rpx; }
.member-name { font-size: 32rpx; font-weight: 800; color: var(--text); }
.biz-tag { font-size: 22rpx; color: var(--primary); background: rgba(255,77,40,0.08); padding: 4rpx 16rpx; border-radius: 8rpx; margin-left: 12rpx; }
.member-phone { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 8rpx; }
.card-bottom { display: flex; justify-content: space-between; align-items: center; }
.status-tag { font-size: 26rpx; font-weight: 600; }
.status-tag.BOOKED { color: #2E7D5A; }
.status-tag.CANCELLED { color: #999; }
.status-tag.COMPLETED { color: var(--primary); }
.cancel-btn { width: auto; min-width: 120rpx; height: 60rpx; line-height: 60rpx; font-size: 24rpx; border-radius: 10rpx; background: #ff4d4f; color: #fff; }
</style>
