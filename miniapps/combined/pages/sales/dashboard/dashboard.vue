<template>
  <view class="dash-page">
    <!-- Dark gradient header with sales name and quick stats -->
    <view class="dash-header">
      <view class="dash-header-top">
        <view class="dash-greeting">
          <text class="dash-welcome">你好，{{ user.name || '销售' }}</text>
          <text class="dash-subtitle">📊 今日工作台</text>
        </view>
        <button class="dash-back-member" size="mini" @click="goBack">{{ backLabel }}</button>
      </view>
      <view class="dash-header-stats">
        <view class="dash-hstat" @click="goTo('/pages/sales/members/members')">
          <text class="dash-hstat-val">{{ stats.memberCount || 0 }}</text>
          <text class="dash-hstat-label">我的会员</text>
        </view>
        <view class="dash-hstat-divider"></view>
        <view class="dash-hstat" @click="goTo('/pages/sales/orders/list')">
          <text class="dash-hstat-val">{{ stats.orderCount || 0 }}</text>
          <text class="dash-hstat-label">本月订单</text>
        </view>
        <view class="dash-hstat-divider"></view>
        <view class="dash-hstat" @click="goTo('/pages/sales/performance/performance')">
          <text class="dash-hstat-val">￥{{ stats.monthCommission || 0 }}</text>
          <text class="dash-hstat-label">本月提成</text>
        </view>
      </view>
    </view>

    <!-- Quick actions 2x2 grid -->
    <view class="dash-actions">
      <view class="dash-action" @click="goTo('/pages/sales/members/create')">
        <view class="dash-action-icon dash-action-orange">📝</view>
        <text class="dash-action-text">新建会员</text>
      </view>
      <view class="dash-action" @click="goTo('/pages/sales/orders/create')">
        <view class="dash-action-icon dash-action-cyan">💰</view>
        <text class="dash-action-text">购课开单</text>
      </view>
      <view class="dash-action" @click="goTo('/pages/sales/channels/channels')">
        <view class="dash-action-icon dash-action-purple">�</view>
        <text class="dash-action-text">渠道分析</text>
      </view>
      <view class="dash-action" @click="goTo('/pages/sales/performance/performance')">
        <view class="dash-action-icon dash-action-green">📊</view>
        <text class="dash-action-text">业绩统计</text>
      </view>
    </view>

    <!-- Recent orders -->
    <view class="dash-section">
      <view class="dash-section-header">
        <view class="dash-accent-bar"></view>
        <text class="dash-section-title">最近订单</text>
      </view>
      <view v-if="recentOrders.length === 0" class="dash-empty">暂无订单</view>
      <view v-for="order in recentOrders" :key="order.id" class="dash-order-item">
        <view class="dash-order-info">
          <text class="dash-order-member">{{ order.member_name }}</text>
          <text class="dash-order-type">{{ order.business_type }} · {{ order.charge_mode }}</text>
        </view>
        <text class="dash-order-amount">￥{{ order.amount }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';

export default {
  data() {
    return {
      user: {},
      stats: {},
      recentOrders: [],
      isCoach: false,
    };
  },
  computed: {
    backLabel() { return this.isCoach ? '回教练端' : '回会员端'; },
  },
  onShow() {
    this.user = JSON.parse(uni.getStorageSync('user') || '{}');
    this.isCoach = uni.getStorageSync('role') === 'coach';
    this.loadData();
  },
  methods: {
    async loadData() {
      try {
        const [d, members, orders] = await Promise.all([
          api.dashboard(),
          api.memberList({ page: 1, pageSize: 1 }),
          api.orderList({ page: 1, pageSize: 5 }),
        ]);
        // 后端返回 { today: {order_count, total_amount, commission}, month: {...} }
        this.stats = {
          memberCount: members.total || members.list?.length || 0,
          orderCount: d.month?.order_count || 0,
          monthIncome: d.month?.total_amount || 0,
          monthCommission: d.month?.commission || 0,
        };
        this.recentOrders = orders.list || orders || [];
      } catch (e) {}
    },
    goTo(url) {
      uni.navigateTo({ url });
    },
    goBack() {
      if (this.isCoach) {
        uni.reLaunch({ url: '/pages/coach/stats/stats' });
        return;
      }
      this.switchRole();
    },
    async switchRole() {
      const memberToken = uni.getStorageSync('memberToken');
      const memberUser = uni.getStorageSync('memberUser');
      if (memberToken && memberUser) {
        uni.setStorageSync('token', memberToken); uni.setStorageSync('user', memberUser); uni.setStorageSync('role', 'member');
        uni.reLaunch({ url: '/pages/member/assets/assets' });
        return;
      }
      try {
        const d = await api.switchIdentity('member');
        uni.setStorageSync('token', d.token); uni.setStorageSync('user', JSON.stringify(d.user)); uni.setStorageSync('role', 'member');
        uni.reLaunch({ url: '/pages/member/assets/assets' });
      } catch (e) { uni.showToast({ title: e.message || '无法返回会员端', icon: 'none' }); }
    },
  },
};
</script>

<style scoped>
.dash-page {
  min-height: 100vh;
  background: var(--sp-bg, #F0F2F5);
  padding: 32rpx;
  padding-bottom: 160rpx;
  box-sizing: border-box;
}

/* Dark gradient header */
.dash-header {
  background: var(--grad-dark, linear-gradient(135deg, #0F172A 0%, #1E293B 100%));
  border-radius: 28rpx;
  padding: 40rpx 32rpx 36rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  margin-bottom: 24rpx;
}
.dash-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}
.dash-greeting {
  display: flex;
  flex-direction: column;
}
.dash-welcome {
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}
.dash-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8rpx;
}
.dash-header-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dash-hstat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.2s;
}
.dash-hstat:active {
  transform: scale(0.97);
}
.dash-hstat-val {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--sp-orange, #FF4D28);
  letter-spacing: 1rpx;
}
.dash-hstat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 8rpx;
}
.dash-hstat-divider {
  width: 1rpx;
  height: 56rpx;
  background: rgba(255, 255, 255, 0.12);
}

/* Quick actions 2x2 grid */
.dash-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  margin-bottom: 24rpx;
}
.dash-action {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  padding: 36rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  transition: transform 0.2s, box-shadow 0.2s;
}
.dash-action:active {
  transform: scale(0.97);
  box-shadow: var(--sp-shadow-sm, 0 4rpx 12rpx rgba(15, 23, 42, 0.06));
}
.dash-action-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-bottom: 16rpx;
}
.dash-action-orange {
  background: var(--sp-bg-warm, #FFF5F0);
}
.dash-action-cyan {
  background: rgba(6, 182, 212, 0.1);
}
.dash-action-purple {
  background: rgba(114, 46, 209, 0.1);
}
.dash-action-green {
  background: rgba(16, 185, 129, 0.1);
}
.dash-action-text {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text, #0F172A);
}

/* Recent orders section */
.dash-section {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  margin-bottom: 24rpx;
}
.dash-section-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}
.dash-accent-bar {
  width: 8rpx;
  height: 32rpx;
  background: var(--sp-orange, #FF4D28);
  border-radius: 4rpx;
  margin-right: 16rpx;
}
.dash-section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}
.dash-empty {
  text-align: center;
  color: var(--text-sec, #6B7280);
  font-size: 26rpx;
  padding: 48rpx 0;
}
.dash-order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border, #EEF0F3);
}
.dash-order-item:last-child {
  border-bottom: none;
}
.dash-order-info {
  display: flex;
  flex-direction: column;
}
.dash-order-member {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text, #0F172A);
}
.dash-order-type {
  font-size: 22rpx;
  color: var(--text-sec, #6B7280);
  margin-top: 6rpx;
}
.dash-order-amount {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--sp-orange, #FF4D28);
}

/* Back to member button */
.dash-back-member {
  background: rgba(255,255,255,0.2) !important;
  color: #fff !important;
  border: 2rpx solid rgba(255,255,255,0.35) !important;
  border-radius: 100rpx !important;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  font-size: 24rpx;
  margin: 0;
  min-width: 0;
  width: auto;
  flex-shrink: 0;
}
.dash-back-member:active { transform: scale(0.97); }
</style>
