<template>
  <view class="page">
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: range === 'month' }" @click="setRange('month')">本月</view>
      <view class="filter-item" :class="{ active: range === 'quarter' }" @click="setRange('quarter')">本季</view>
      <view class="filter-item" :class="{ active: range === 'year' }" @click="setRange('year')">本年</view>
    </view>

    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-value">{{ summary.session_count || 0 }}</text>
        <text class="stat-label">上课节数</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ summary.present_count || 0 }}</text>
        <text class="stat-label">出勤人次</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">￥{{ summary.total_lesson_fee || 0 }}</text>
        <text class="stat-label">课时费合计</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">￥{{ summary.total_share || 0 }}</text>
        <text class="stat-label">分成金额</text>
      </view>
    </view>

    <view class="section" v-if="coach && coach.sales_enabled">
      <text class="section-title">销售提成</text>
      <view class="sales-row">
        <text class="sales-label">本月销售提成</text>
        <text class="sales-amount">￥{{ salesCommission || 0 }}</text>
      </view>
      <button class="action-btn" @click="goCreateMember">新建会员</button>
      <button class="action-btn" @click="goCreateOrder">购课开单</button>
    </view>

    <view class="section">
      <text class="section-title">按业务类型</text>
      <view v-for="b in byBusiness" :key="b.business_type" class="biz-row">
        <text class="biz-name">{{ businessName(b.business_type) }}</text>
        <view class="biz-stats">
          <text>{{ b.session_count }} 节</text>
          <text class="biz-fee">￥{{ b.total_lesson_fee }}</text>
        </view>
      </view>
    </view>
    <button class="switch-btn" @click="switchRole">切换身份</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { businessTypeName } from '../../../utils/constants.js';

export default {
  data() { return { range: 'month', summary: {}, byBusiness: [], coach: null, salesCommission: 0 }; },
  onShow() { this.loadStats(); this.loadCoach(); },
  methods: {
    setRange(r) { this.range = r; this.loadStats(); },
    getRange() {
      const now = new Date();
      let startDate, endDate;
      if (this.range === 'month') {
        startDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        endDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-31`;
      } else if (this.range === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        startDate = `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`;
        endDate = `${now.getFullYear()}-${String(q*3+3).padStart(2,'0')}-31`;
      } else {
        startDate = `${now.getFullYear()}-01-01`;
        endDate = `${now.getFullYear()}-12-31`;
      }
      return { startDate, endDate };
    },
    async loadStats() {
      try {
        const r = this.getRange();
        const d = await api.myStats(r);
        this.summary = d.summary || {};
        this.byBusiness = d.byBusiness || [];
      } catch (e) {}
    },
    async loadCoach() {
      try {
        const user = JSON.parse(uni.getStorageSync('user') || '{}');
        this.coach = await api.coachDetail(user.id);
        if (this.coach.sales_enabled) {
          try { const c = await api.myCommissions(); this.salesCommission = c.total || 0; } catch {}
        }
      } catch (e) {}
    },
    businessName(b) { return businessTypeName(b); },
    goCreateMember() { uni.navigateTo({ url: '/pages/coach/sales/create-member' }); },
    goCreateOrder() { uni.navigateTo({ url: '/pages/coach/sales/create-order' }); },
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
.page { padding: 20rpx; }
.filter-bar { display: flex; background: #fff; border-radius: 10rpx; margin-bottom: 20rpx; overflow: hidden; }
.filter-item { flex: 1; text-align: center; padding: 20rpx 0; font-size: 28rpx; color: #666; }
.filter-item.active { color: #722ed1; font-weight: bold; border-bottom: 4rpx solid #722ed1; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 20rpx; }
.stat-card { background: #fff; border-radius: 16rpx; padding: 30rpx; text-align: center; }
.stat-value { display: block; font-size: 40rpx; font-weight: bold; color: #722ed1; }
.stat-label { display: block; font-size: 24rpx; color: #999; margin-top: 10rpx; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.sales-row { display: flex; justify-content: space-between; padding: 16rpx 0; margin-bottom: 16rpx; }
.sales-label { font-size: 28rpx; }
.sales-amount { font-size: 32rpx; color: #52c41a; font-weight: bold; }
.action-btn { background: #722ed1; color: #fff; border-radius: 10rpx; height: 70rpx; line-height: 70rpx; font-size: 28rpx; margin-bottom: 12rpx; }
.biz-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.biz-name { font-size: 28rpx; }
.biz-stats { display: flex; gap: 20rpx; font-size: 24rpx; color: #999; }
.biz-fee { color: #722ed1; font-weight: bold; }
.switch-btn { background: #fff; color: #722ed1; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; border: 1rpx solid #722ed1; margin-top: 20rpx; }
</style>
