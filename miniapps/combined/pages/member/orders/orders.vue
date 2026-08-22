<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">我的订单</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ active: tab === 'orders' }" @click="tab = 'orders'">购课订单</view>
      <view class="tab-item" :class="{ active: tab === 'consumption' }" @click="tab = 'consumption'">课消记录</view>
    </view>

    <view v-if="tab === 'orders'">
      <view v-if="!orders || orders.length === 0" class="empty">暂无订单</view>
      <view v-for="o in orders" :key="o.id" class="order-card">
        <view class="order-top">
          <text class="order-no">No.{{ o.order_no }}</text>
          <text class="order-status" :class="o.status">{{ statusName(o.status) }}</text>
        </view>
        <view class="order-mid">
          <text class="order-course">{{ o.course_name || bizName(o.business_type) }}</text>
          <text class="order-biz">{{ bizName(o.business_type) }} · {{ chargeModeName(o.charge_mode) }}</text>
        </view>
        <view class="order-bottom">
          <text class="order-amount">￥{{ o.amount }}</text>
          <text class="order-date">{{ formatDate(o.created_at) }}</text>
        </view>
      </view>
    </view>

    <view v-if="tab === 'consumption'">
      <view v-if="!consumptions || consumptions.length === 0" class="empty">暂无课消记录</view>
      <view v-for="c in consumptions" :key="c.id" class="order-card">
        <view class="order-top">
          <text class="order-course">{{ c.course_name || '课程' }}</text>
          <text class="order-amount">-￥{{ c.amount }}</text>
        </view>
        <view class="order-mid">
          <text class="order-biz">{{ c.coach_name || '' }} {{ c.date || '' }} {{ c.start_time || '' }}</text>
        </view>
        <view class="order-bottom">
          <text class="order-biz">{{ chargeModeName(c.charge_mode) }}</text>
          <text class="order-date">{{ formatDate(c.created_at) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, CHARGE_MODES } from '../../../utils/constants.js';

export default {
  data() { return { tab: 'orders', orders: [], consumptions: [] }; },
  onShow() { this.loadData(); },
  methods: {
    back() { uni.navigateBack(); },
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    chargeModeName(code) { const m = CHARGE_MODES.find((x) => x.code === code); return m ? m.name : code; },
    statusName(s) { return { PAID: '已支付', PENDING: '待支付', REFUNDED: '已退款', CANCELLED: '已取消' }[s] || s; },
    formatDate(d) { if (!d) return ''; return d.slice(0, 10); },
    async loadData() {
      try {
        const d = await api.myConsumption();
        this.orders = d.orders || [];
        this.consumptions = d.consumptions || [];
      } catch (e) {}
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 40rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; cursor: pointer; }
.title { font-size: 40rpx; font-weight: 800; color: var(--text); }
.tab-bar { display: flex; padding: 0 32rpx; gap: 16rpx; margin-bottom: 24rpx; }
.tab-item { padding: 16rpx 32rpx; border-radius: 12rpx; font-size: 28rpx; color: var(--text-sec); background: var(--card); font-weight: 600; }
.tab-item.active { color: #fff; background: var(--primary); }
.empty { text-align: center; color: var(--text-sec); padding: 80rpx; font-size: 28rpx; }
.order-card { background: var(--card); border-radius: 24rpx; padding: 32rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); }
.order-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.order-no { font-size: 24rpx; color: var(--text-sec); }
.order-status { font-size: 24rpx; font-weight: 600; padding: 4rpx 16rpx; border-radius: 8rpx; }
.order-status.PAID { color: #2E7D5A; background: rgba(46,125,90,0.1); }
.order-status.PENDING { color: var(--primary); background: rgba(255,77,40,0.1); }
.order-status.REFUNDED { color: #6B7280; background: rgba(107,114,128,0.1); }
.order-mid { margin-bottom: 16rpx; }
.order-course { font-size: 30rpx; font-weight: 700; color: var(--text); }
.order-biz { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 8rpx; }
.order-bottom { display: flex; justify-content: space-between; align-items: center; }
.order-amount { font-size: 34rpx; font-weight: 800; color: var(--primary); }
.order-date { font-size: 24rpx; color: var(--text-sec); }
</style>
