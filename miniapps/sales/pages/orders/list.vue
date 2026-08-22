<template>
  <view class="page">
    <view v-if="list.length === 0" class="empty">暂无订单</view>
    <view v-for="o in list" :key="o.id" class="order-card">
      <view class="order-header">
        <text class="order-no">{{ o.order_no }}</text>
        <text class="order-status" :class="o.status">{{ statusName(o.status) }}</text>
      </view>
      <view class="order-body">
        <text class="order-member">{{ o.member_name }}</text>
        <text class="order-type">{{ businessName(o.business_type) }} · {{ chargeName(o.charge_mode) }}</text>
      </view>
      <view class="order-footer">
        <text class="order-time">{{ formatTime(o.created_at) }}</text>
        <text class="order-amount">￥{{ o.amount }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { businessTypeName, chargeModeName } from '../../utils/constants.js';

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
.page { padding: 20rpx; }
.empty { text-align: center; color: #999; padding: 80rpx; }
.order-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.order-header { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.order-no { font-size: 24rpx; color: #999; }
.order-status { font-size: 24rpx; }
.order-status.PAID { color: #52c41a; }
.order-status.REFUNDED { color: #ff4d4f; }
.order-body { margin-bottom: 12rpx; }
.order-member { font-size: 30rpx; font-weight: bold; }
.order-type { display: block; font-size: 24rpx; color: #666; margin-top: 6rpx; }
.order-footer { display: flex; justify-content: space-between; align-items: center; }
.order-time { font-size: 22rpx; color: #999; }
.order-amount { font-size: 34rpx; color: #1890ff; font-weight: bold; }
</style>
