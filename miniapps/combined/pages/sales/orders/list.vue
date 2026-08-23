<template>
  <view class="olist-page">
    <view v-if="list.length === 0" class="olist-empty">暂无订单</view>
    <view v-for="o in list" :key="o.id" class="olist-order-card" :class="'olist-accent-' + (o.status === 'PAID' ? 'green' : o.status === 'REFUNDED' ? 'red' : 'amber')">
      <view class="olist-accent-bar"></view>
      <view class="olist-card-body">
        <view class="olist-order-header">
          <text class="olist-order-no">{{ o.order_no }}</text>
          <text class="olist-order-status" :class="'olist-status-' + o.status">{{ statusName(o.status) }}</text>
        </view>
        <view class="olist-order-body">
          <text class="olist-order-member">{{ o.member_name }}</text>
          <text class="olist-order-type">{{ businessName(o.business_type) }} · {{ chargeName(o.charge_mode) }}</text>
        </view>
        <view class="olist-order-footer">
          <text class="olist-order-time">{{ formatTime(o.created_at) }}</text>
          <text class="olist-order-amount">￥{{ o.amount }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { businessTypeName, chargeModeName } from '../../../utils/constants.js';

export default {
  data() { return { list: [], page: 1, total: 0 }; },
  onShow() { this.page = 1; this.loadList(); },
  onReachBottom() { if (this.list.length < this.total) { this.page++; this.loadList(true); } },
  methods: {
    async loadList(append) {
      try {
        const d = await api.orderList({ page: this.page, pageSize: 20 });
        this.list = append ? [...this.list, ...d.list] : d.list;
        this.total = d.total;
      } catch (e) {}
    },
    statusName(s) { return { PAID: '已支付', REFUNDED: '已退款', PARTIAL_REFUND: '部分退款' }[s] || s; },
    businessName(b) { return businessTypeName(b); },
    chargeName(c) { return chargeModeName(c); },
    formatTime(t) { return new Date(t).toLocaleString(); },
  },
};
</script>

<style scoped>
.olist-page {
  min-height: 100vh;
  background: var(--sp-bg, #F0F2F5);
  padding: 32rpx;
  box-sizing: border-box;
}

/* Empty state */
.olist-empty {
  text-align: center;
  color: var(--text-sec, #6B7280);
  font-size: 28rpx;
  padding: 80rpx 0;
}

/* Order cards with left colored accent bar */
.olist-order-card {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  display: flex;
  overflow: hidden;
  transition: transform 0.2s;
}
.olist-order-card:active {
  transform: scale(0.97);
}

/* Left accent bar by status */
.olist-accent-bar {
  width: 8rpx;
  flex-shrink: 0;
}
.olist-accent-green .olist-accent-bar {
  background: var(--sp-green, #10B981);
}
.olist-accent-amber .olist-accent-bar {
  background: var(--sp-amber, #F59E0B);
}
.olist-accent-red .olist-accent-bar {
  background: var(--sp-red, #EF4444);
}

.olist-card-body {
  flex: 1;
  padding: 28rpx 24rpx;
}

/* Order header */
.olist-order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.olist-order-no {
  font-size: 24rpx;
  color: var(--text-sec, #6B7280);
}

/* Status badges as pills */
.olist-order-status {
  font-size: 22rpx;
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  font-weight: 600;
}
.olist-status-PAID {
  color: var(--sp-green, #10B981);
  background: rgba(16, 185, 129, 0.1);
}
.olist-status-REFUNDED {
  color: var(--sp-red, #EF4444);
  background: rgba(239, 68, 68, 0.1);
}
.olist-status-PARTIAL_REFUND {
  color: var(--sp-amber, #F59E0B);
  background: rgba(245, 158, 11, 0.1);
}

/* Order body */
.olist-order-body {
  margin-bottom: 16rpx;
}
.olist-order-member {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}
.olist-order-type {
  display: block;
  font-size: 24rpx;
  color: var(--text-sec, #6B7280);
  margin-top: 6rpx;
}

/* Order footer */
.olist-order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.olist-order-time {
  font-size: 22rpx;
  color: var(--text-sec, #6B7280);
}
.olist-order-amount {
  font-size: 36rpx;
  color: var(--sp-orange, #FF4D28);
  font-weight: 700;
}
</style>
