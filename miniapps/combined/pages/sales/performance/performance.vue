<template>
  <view class="page">
    <view class="summary-card">
      <view class="summary-row">
        <text class="label">本月业绩</text>
        <text class="value">￥{{ data.monthIncome || 0 }}</text>
      </view>
      <view class="summary-row">
        <text class="label">本月提成</text>
        <text class="value">￥{{ data.monthCommission || 0 }}</text>
      </view>
      <view class="summary-row">
        <text class="label">累计业绩</text>
        <text class="value">￥{{ data.totalIncome || 0 }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">按业务类型</text>
      <view v-if="!data.byBusiness || data.byBusiness.length === 0" class="empty">暂无数据</view>
      <view v-for="b in (data.byBusiness || [])" :key="b.business_type" class="biz-row">
        <text class="biz-name">{{ businessName(b.business_type) }}</text>
        <view class="biz-stats">
          <text class="biz-count">{{ b.count }} 单</text>
          <text class="biz-amount">￥{{ b.amount }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">提成记录</text>
      <view v-if="!data.commissions || data.commissions.length === 0" class="empty">暂无提成</view>
      <view v-for="c in (data.commissions || [])" :key="c.id" class="commission-row">
        <view>
          <text class="commission-order">{{ c.order_no }}</text>
          <text class="commission-type">{{ businessName(c.business_type) }} · {{ c.commission_type === 'NEW' ? '新客' : '续费' }}</text>
        </view>
        <text class="commission-amount">￥{{ c.amount }}</text>
      </view>
    </view>
    <button class="switch-btn" @click="switchRole">切换身份</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { businessTypeName } from '../../../utils/constants.js';

export default {
  data() { return { data: {} }; },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      try {
        const perf = await api.performance();
        const commissions = await api.myCommissions();
        this.data = { ...perf, commissions: commissions.list || commissions || [] };
      } catch (e) {}
    },
    businessName(b) { return businessTypeName(b); },
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
.summary-card { background: linear-gradient(135deg, #1890ff, #096dd9); border-radius: 16rpx; padding: 30rpx; margin-bottom: 20rpx; }
.summary-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; }
.label { color: rgba(255,255,255,0.8); font-size: 28rpx; }
.value { color: #fff; font-size: 36rpx; font-weight: bold; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.empty { text-align: center; color: #999; padding: 30rpx; }
.biz-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.biz-name { font-size: 28rpx; }
.biz-stats { display: flex; gap: 20rpx; }
.biz-count { font-size: 24rpx; color: #999; }
.biz-amount { font-size: 28rpx; color: #1890ff; font-weight: bold; }
.commission-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.commission-order { font-size: 24rpx; }
.commission-type { display: block; font-size: 22rpx; color: #999; }
.commission-amount { font-size: 30rpx; color: #52c41a; font-weight: bold; }
.switch-btn { background: #fff; color: #1890ff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; border: 1rpx solid #1890ff; margin-top: 20rpx; }
</style>
