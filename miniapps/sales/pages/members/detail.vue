<template>
  <view class="page">
    <view class="profile">
      <view class="avatar">{{ member.name?.[0] || '?' }}</view>
      <view class="info">
        <text class="name">{{ member.name }}</text>
        <text class="phone">{{ member.phone }}</text>
      </view>
      <view class="tags">
        <text v-for="t in (member.tags || [])" :key="t" class="tag">{{ categoryName(t) }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">预存账户</text>
      <view class="balance-row">
        <view class="balance-item">
          <text class="balance-label">本金</text>
          <text class="balance-value">￥{{ member.prepaid?.principal_balance || 0 }}</text>
        </view>
        <view class="balance-item">
          <text class="balance-label">赠送</text>
          <text class="balance-value">￥{{ member.prepaid?.gift_balance || 0 }}</text>
        </view>
        <view class="balance-item">
          <text class="balance-label">合计</text>
          <text class="balance-value total">￥{{ member.prepaid?.total_balance || 0 }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">课包列表</text>
      <view v-if="!member.packs || member.packs.length === 0" class="empty">暂无课包</view>
      <view v-for="p in (member.packs || [])" :key="p.id" class="pack-card">
        <view class="pack-header">
          <text class="pack-name">{{ p.course_name }}</text>
          <text class="pack-type">{{ p.pack_type === 'SESSION_PACK' ? '次卡' : p.pack_type === 'MONTHLY' ? '月卡' : p.pack_type }}</text>
        </view>
        <view class="pack-detail">
          <text v-if="p.pack_type === 'SESSION_PACK'">剩余 {{ p.remaining_sessions }}/{{ p.total_sessions }} 节</text>
          <text v-else>剩余 {{ p.monthly_remaining }}/{{ p.monthly_quota }} 次</text>
          <text class="pack-valid">有效期至 {{ p.valid_until }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">购课历史</text>
      <view v-if="!member.orders || member.orders.length === 0" class="empty">暂无订单</view>
      <view v-for="o in (member.orders || [])" :key="o.id" class="order-row">
        <view>
          <text class="order-no">{{ o.order_no }}</text>
          <text class="order-type">{{ o.business_type }} · {{ o.charge_mode }}</text>
        </view>
        <text class="order-amount">￥{{ o.amount }}</text>
      </view>
    </view>

    <button class="action-btn" @click="goCreateOrder">购课开单</button>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { memberCategoryName } from '../../utils/constants.js';

export default {
  data() { return { member: {} }; },
  onLoad(options) { this.memberId = options.id; },
  onShow() { this.loadMember(); },
  methods: {
    async loadMember() {
      try { this.member = await api.memberDetail(this.memberId); } catch (e) {}
    },
    categoryName(t) { return memberCategoryName(t); },
    goCreateOrder() { uni.navigateTo({ url: `/pages/orders/create?memberId=${this.memberId}` }); },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.profile { background: #fff; border-radius: 16rpx; padding: 30rpx; display: flex; align-items: center; margin-bottom: 20rpx; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; background: #1890ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: bold; }
.info { flex: 1; margin-left: 20rpx; }
.name { font-size: 32rpx; font-weight: bold; }
.phone { display: block; font-size: 24rpx; color: #999; margin-top: 6rpx; }
.tags { display: flex; flex-wrap: wrap; gap: 8rpx; }
.tag { font-size: 20rpx; color: #1890ff; background: #e6f7ff; padding: 4rpx 12rpx; border-radius: 6rpx; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.empty { text-align: center; color: #999; padding: 30rpx; }
.balance-row { display: flex; justify-content: space-around; }
.balance-item { text-align: center; }
.balance-label { font-size: 24rpx; color: #999; display: block; }
.balance-value { font-size: 32rpx; font-weight: bold; }
.balance-value.total { color: #1890ff; }
.pack-card { border: 1rpx solid #f0f0f0; border-radius: 10rpx; padding: 20rpx; margin-bottom: 16rpx; }
.pack-header { display: flex; justify-content: space-between; margin-bottom: 10rpx; }
.pack-name { font-size: 28rpx; font-weight: bold; }
.pack-type { font-size: 24rpx; color: #1890ff; }
.pack-detail { display: flex; justify-content: space-between; font-size: 24rpx; color: #666; }
.pack-valid { color: #999; }
.order-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.order-no { font-size: 24rpx; }
.order-type { display: block; font-size: 22rpx; color: #999; }
.order-amount { font-size: 30rpx; color: #1890ff; font-weight: bold; }
.action-btn { background: #1890ff; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 20rpx; }
</style>
