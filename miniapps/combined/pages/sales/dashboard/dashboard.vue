<template>
  <view class="dashboard">
    <view class="header">
      <text class="welcome">你好，{{ user.name || '销售' }}</text>
    </view>

    <view class="stats-grid">
      <view class="stat-card" @click="goTo('/pages/sales/members/members')">
        <text class="stat-value">{{ stats.memberCount || 0 }}</text>
        <text class="stat-label">我的会员</text>
      </view>
      <view class="stat-card" @click="goTo('/pages/sales/orders/list')">
        <text class="stat-value">{{ stats.orderCount || 0 }}</text>
        <text class="stat-label">本月订单</text>
      </view>
      <view class="stat-card" @click="goTo('/pages/sales/performance/performance')">
        <text class="stat-value">￥{{ stats.monthIncome || 0 }}</text>
        <text class="stat-label">本月业绩</text>
      </view>
      <view class="stat-card" @click="goTo('/pages/sales/performance/performance')">
        <text class="stat-value">￥{{ stats.monthCommission || 0 }}</text>
        <text class="stat-label">本月提成</text>
      </view>
    </view>

    <view class="actions">
      <view class="action-item" @click="goTo('/pages/sales/members/create')">
        <text class="action-icon">👤</text>
        <text class="action-text">新建会员</text>
      </view>
      <view class="action-item" @click="goTo('/pages/sales/orders/create')">
        <text class="action-icon">📝</text>
        <text class="action-text">购课开单</text>
      </view>
      <view class="action-item" @click="goTo('/pages/sales/members/members')">
        <text class="action-icon">📋</text>
        <text class="action-text">会员列表</text>
      </view>
      <view class="action-item" @click="goTo('/pages/sales/orders/list')">
        <text class="action-icon">💰</text>
        <text class="action-text">订单记录</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">最近订单</text>
      <view v-if="recentOrders.length === 0" class="empty">暂无订单</view>
      <view v-for="order in recentOrders" :key="order.id" class="order-item">
        <view class="order-info">
          <text class="order-member">{{ order.member_name }}</text>
          <text class="order-type">{{ order.business_type }} · {{ order.charge_mode }}</text>
        </view>
        <text class="order-amount">￥{{ order.amount }}</text>
      </view>
    </view>
    <button class="switch-btn" @click="switchRole">切换身份</button>
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
    };
  },
  onShow() {
    this.user = JSON.parse(uni.getStorageSync('user') || '{}');
    this.loadData();
  },
  methods: {
    async loadData() {
      try {
        const d = await api.dashboard();
        this.stats = d.stats || d;
        this.recentOrders = d.recentOrders || [];
      } catch (e) {}
    },
    goTo(url) {
      uni.navigateTo({ url });
    },
    switchRole() {
      uni.removeStorageSync('token'); uni.removeStorageSync('user'); uni.removeStorageSync('role');
      const app = getApp();
      if (app && app.globalData) { app.globalData.token = ''; app.globalData.user = null; app.globalData.role = ''; }
      uni.reLaunch({ url: '/pages/member/login/login' });
    },
  },
};
</script>

<style scoped>
.dashboard { padding: 20rpx; }
.header { padding: 20rpx 0; }
.welcome { font-size: 36rpx; font-weight: bold; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 30rpx; }
.stat-card { background: #fff; border-radius: 16rpx; padding: 30rpx; text-align: center; }
.stat-value { display: block; font-size: 40rpx; font-weight: bold; color: #1890ff; }
.stat-label { display: block; font-size: 24rpx; color: #999; margin-top: 10rpx; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 30rpx; }
.action-item { background: #fff; border-radius: 16rpx; padding: 30rpx; display: flex; flex-direction: column; align-items: center; }
.action-icon { font-size: 48rpx; margin-bottom: 10rpx; }
.action-text { font-size: 28rpx; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 20rpx; display: block; }
.empty { text-align: center; color: #999; padding: 40rpx; }
.order-item { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.order-info { display: flex; flex-direction: column; }
.order-member { font-size: 28rpx; }
.order-type { font-size: 24rpx; color: #999; }
.order-amount { font-size: 32rpx; color: #1890ff; font-weight: bold; }
.switch-btn { background: #fff; color: #1890ff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; border: 1rpx solid #1890ff; margin: 20rpx; }
</style>
