<template>
  <view class="mdet-page">
    <!-- Gradient profile header -->
    <view class="mdet-profile">
      <view class="mdet-profile-row">
        <view class="mdet-avatar">{{ member.name?.[0] || '?' }}</view>
        <view class="mdet-info">
          <text class="mdet-name">{{ member.name }}</text>
          <text class="mdet-phone">{{ member.phone }}</text>
        </view>
      </view>
      <view class="mdet-tags" v-if="member.tags && member.tags.length">
        <text v-for="t in (member.tags || [])" :key="t" class="mdet-tag">{{ categoryName(t) }}</text>
      </view>
    </view>

    <!-- Course packs section -->
    <view class="mdet-card">
      <view class="mdet-card-header">
        <view class="mdet-accent-bar"></view>
        <text class="mdet-card-title">课包列表</text>
      </view>
      <view v-if="!member.packs || member.packs.length === 0" class="mdet-empty">暂无课包</view>
      <view v-for="p in (member.packs || [])" :key="p.id" class="mdet-pack-card">
        <view class="mdet-pack-header">
          <text class="mdet-pack-name">{{ p.course_name }}</text>
          <text class="mdet-pack-type">{{ p.pack_type === 'SESSION_PACK' ? '次卡' : p.pack_type === 'MONTHLY' ? '月卡' : p.pack_type }}</text>
        </view>
        <view class="mdet-pack-detail">
          <text v-if="p.pack_type === 'SESSION_PACK'">剩余 {{ p.remaining_sessions }}/{{ p.total_sessions }} 节</text>
          <text v-else>剩余 {{ p.monthly_remaining }}/{{ p.monthly_quota }} 次</text>
          <text class="mdet-pack-valid">有效期至 {{ p.valid_until }}</text>
        </view>
      </view>
    </view>

    <!-- Order history section -->
    <view class="mdet-card">
      <view class="mdet-card-header">
        <view class="mdet-accent-bar"></view>
        <text class="mdet-card-title">购课历史</text>
      </view>
      <view v-if="!member.orders || member.orders.length === 0" class="mdet-empty">暂无订单</view>
      <view v-for="o in (member.orders || [])" :key="o.id" class="mdet-order-row">
        <view class="mdet-order-info">
          <text class="mdet-order-no">{{ o.order_no }}</text>
          <text class="mdet-order-type">{{ o.business_type }} · {{ o.charge_mode }}</text>
        </view>
        <text class="mdet-order-amount">￥{{ o.amount }}</text>
      </view>
    </view>

    <button class="mdet-action-btn" @click="goCreateOrder">购课开单</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { memberCategoryName } from '../../../utils/constants.js';

export default {
  data() { return { member: {} }; },
  onLoad(options) { this.memberId = options.id; },
  onShow() { this.loadMember(); },
  methods: {
    async loadMember() {
      try { this.member = await api.memberDetail(this.memberId); } catch (e) {}
    },
    categoryName(t) { return memberCategoryName(t); },
    goCreateOrder() { uni.navigateTo({ url: `/pages/sales/orders/create?memberId=${this.memberId}` }); },
  },
};
</script>

<style scoped>
.mdet-page {
  min-height: 100vh;
  background: var(--sp-bg, #F0F2F5);
  padding: 32rpx;
  box-sizing: border-box;
}

/* Profile header card with dark gradient */
.mdet-profile {
  background: var(--grad-dark, linear-gradient(135deg, #0F172A 0%, #1E293B 100%));
  border-radius: 28rpx;
  padding: 40rpx 32rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  margin-bottom: 24rpx;
}
.mdet-profile-row {
  display: flex;
  align-items: center;
}
.mdet-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: var(--grad-orange, linear-gradient(135deg, #FF4D28 0%, #FF7A5C 100%));
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: var(--sp-shadow-orange, 0 8rpx 28rpx rgba(255, 77, 40, 0.25));
}
.mdet-info {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}
.mdet-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
}
.mdet-phone {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 8rpx;
}
.mdet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 24rpx;
}
.mdet-tag {
  font-size: 22rpx;
  color: var(--sp-orange-light, #FF7A5C);
  background: rgba(255, 122, 92, 0.15);
  padding: 6rpx 18rpx;
  border-radius: 100rpx;
}

/* Info cards */
.mdet-card {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  margin-bottom: 24rpx;
}
.mdet-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}
.mdet-accent-bar {
  width: 8rpx;
  height: 32rpx;
  background: var(--sp-orange, #FF4D28);
  border-radius: 4rpx;
  margin-right: 16rpx;
}
.mdet-card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}
.mdet-empty {
  text-align: center;
  color: var(--text-sec, #6B7280);
  font-size: 26rpx;
  padding: 40rpx 0;
}

/* Balance row */
.mdet-balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mdet-balance-item {
  flex: 1;
  text-align: center;
}
.mdet-balance-label {
  font-size: 22rpx;
  color: var(--text-sec, #6B7280);
  display: block;
  margin-bottom: 8rpx;
}
.mdet-balance-value {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}
.mdet-balance-total {
  color: var(--sp-orange, #FF4D28);
}
.mdet-balance-divider {
  width: 1rpx;
  height: 56rpx;
  background: var(--border, #EEF0F3);
}

/* Pack cards */
.mdet-pack-card {
  background: var(--sp-bg, #F0F2F5);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.mdet-pack-card:last-child {
  margin-bottom: 0;
}
.mdet-pack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.mdet-pack-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text, #0F172A);
}
.mdet-pack-type {
  font-size: 22rpx;
  color: var(--sp-orange, #FF4D28);
  background: var(--sp-bg-warm, #FFF5F0);
  padding: 4rpx 16rpx;
  border-radius: 100rpx;
}
.mdet-pack-detail {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: var(--text-sec, #6B7280);
}
.mdet-pack-valid {
  color: var(--text-sec, #6B7280);
}

/* Order rows */
.mdet-order-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border, #EEF0F3);
}
.mdet-order-row:last-child {
  border-bottom: none;
}
.mdet-order-info {
  display: flex;
  flex-direction: column;
}
.mdet-order-no {
  font-size: 26rpx;
  color: var(--text, #0F172A);
  font-weight: 500;
}
.mdet-order-type {
  font-size: 22rpx;
  color: var(--text-sec, #6B7280);
  margin-top: 6rpx;
}
.mdet-order-amount {
  font-size: 32rpx;
  color: var(--sp-orange, #FF4D28);
  font-weight: 700;
}

/* Action button */
.mdet-action-btn {
  background: var(--grad-orange, linear-gradient(135deg, #FF4D28 0%, #FF7A5C 100%));
  color: #FFFFFF;
  border-radius: 24rpx;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  box-shadow: var(--sp-shadow-orange, 0 8rpx 28rpx rgba(255, 77, 40, 0.25));
  border: none;
  margin-top: 16rpx;
  transition: transform 0.2s;
}
.mdet-action-btn:active {
  transform: scale(0.97);
}
</style>
