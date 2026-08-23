<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">我的订单</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ active: tab === 'orders' }" @click="tab = 'orders'">📋 购课订单</view>
      <view class="tab-item" :class="{ active: tab === 'consumption' }" @click="tab = 'consumption'">💸 课消记录</view>
    </view>

    <view v-if="tab === 'orders'">
      <view v-if="!orders || orders.length === 0" class="empty">
        <text class="empty-emoji">📋</text>
        <text class="empty-text">暂无订单</text>
      </view>
      <view v-for="o in orders" :key="o.id" class="order-card">
        <view class="order-accent" :class="o.status"></view>
        <view class="order-body">
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
    </view>

    <view v-if="tab === 'consumption'">
      <view v-if="!consumptions || consumptions.length === 0" class="empty">
        <text class="empty-emoji">💸</text>
        <text class="empty-text">暂无课消记录</text>
      </view>
      <view v-for="c in consumptions" :key="c.id" class="order-card">
        <view class="order-accent consumed"></view>
        <view class="order-body">
          <view class="order-top">
            <text class="order-course">{{ c.course_name || '课程' }}</text>
            <text class="order-amount">-￥{{ c.amount }}</text>
          </view>
          <view class="order-mid">
            <text class="order-biz">🏸 {{ c.coach_name || '' }} {{ c.date || '' }} {{ c.start_time || '' }}</text>
          </view>
          <view class="order-bottom">
            <text class="order-biz">{{ chargeModeName(c.charge_mode) }}</text>
            <text class="order-date">{{ formatDate(c.created_at) }}</text>
          </view>
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
.page { min-height: 100vh; background: var(--sp-bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 32rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; transition: transform 0.15s ease; }
.back:active { transform: scale(0.9); }
.title { font-size: 40rpx; font-weight: 800; color: var(--sp-dark); }
.tab-bar { display: flex; padding: 0 32rpx; gap: 16rpx; margin-bottom: 24rpx; }
.tab-item { padding: 18rpx 36rpx; border-radius: 100rpx; font-size: 28rpx; color: var(--text-sec); background: var(--card); font-weight: 600; box-shadow: var(--sp-shadow-sm); transition: transform 0.15s ease; }
.tab-item:active { transform: scale(0.97); }
.tab-item.active { color: #fff; background: var(--grad-orange); box-shadow: var(--sp-shadow-orange); }
.empty { text-align: center; padding: 80rpx 0; }
.empty-emoji { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }
.order-card { display: flex; background: var(--card); border-radius: 24rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); overflow: hidden; }
.order-accent { width: 8rpx; flex-shrink: 0; }
.order-accent.PAID { background: var(--sp-green); }
.order-accent.PENDING { background: var(--sp-amber); }
.order-accent.REFUNDED { background: var(--text-sec); }
.order-accent.CANCELLED { background: var(--text-sec); }
.order-accent.consumed { background: var(--sp-cyan); }
.order-body { flex: 1; padding: 28rpx; }
.order-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.order-no { font-size: 24rpx; color: var(--text-sec); }
.order-status { font-size: 24rpx; font-weight: 700; padding: 8rpx 20rpx; border-radius: 100rpx; }
.order-status.PAID { color: var(--sp-green); background: rgba(16,185,129,0.1); }
.order-status.PENDING { color: var(--sp-amber); background: rgba(245,158,11,0.1); }
.order-status.REFUNDED { color: var(--text-sec); background: rgba(107,114,128,0.1); }
.order-status.CANCELLED { color: var(--text-sec); background: rgba(107,114,128,0.1); }
.order-mid { margin-bottom: 16rpx; }
.order-course { font-size: 30rpx; font-weight: 700; color: var(--sp-dark); }
.order-biz { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 8rpx; }
.order-bottom { display: flex; justify-content: space-between; align-items: center; }
.order-amount { font-size: 36rpx; font-weight: 800; color: var(--sp-orange); }
.order-date { font-size: 24rpx; color: var(--text-sec); }
</style>
