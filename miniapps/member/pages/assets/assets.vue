<template>
  <view class="page">
    <view class="user-card" v-if="user">
      <view class="avatar">{{ user.name?.[0] || '?' }}</view>
      <view class="user-info">
        <text class="name">{{ user.name }}</text>
        <text class="phone">{{ user.phone }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">预存账户</text>
      <view class="balance-row">
        <view class="balance-item"><text class="balance-label">本金</text><text class="balance-value">￥{{ assets.prepaid?.principal_balance || 0 }}</text></view>
        <view class="balance-item"><text class="balance-label">赠送</text><text class="balance-value">￥{{ assets.prepaid?.gift_balance || 0 }}</text></view>
        <view class="balance-item"><text class="balance-label">合计</text><text class="balance-value total">￥{{ assets.prepaid?.total_balance || 0 }}</text></view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">我的课包</text>
      <view v-if="!assets.packs || assets.packs.length === 0" class="empty">暂无课包</view>
      <view v-for="p in (assets.packs || [])" :key="p.id" class="pack-card">
        <view class="pack-header"><text class="pack-name">{{ p.course_name }}</text><text class="pack-type">{{ p.pack_type === 'SESSION_PACK' ? '次卡' : p.pack_type === 'MONTHLY' ? '月卡' : p.pack_type }}</text></view>
        <view class="pack-detail">
          <text v-if="p.pack_type === 'SESSION_PACK'">剩余 {{ p.remaining_sessions }}/{{ p.total_sessions }} 节</text>
          <text v-else>剩余 {{ p.monthly_remaining }}/{{ p.monthly_quota }} 次</text>
          <text class="pack-valid">至 {{ p.valid_until }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">到期提醒</text>
      <view v-if="!assets.alerts || assets.alerts.length === 0" class="empty">暂无到期提醒</view>
      <view v-for="(a, i) in (assets.alerts || [])" :key="i" class="alert-row">
        <text class="alert-name">{{ a.course_name }}</text>
        <text class="alert-info">{{ a.message }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';

export default {
  data() { return { user: null, assets: {} }; },
  onShow() { this.user = JSON.parse(uni.getStorageSync('member_user') || '{}'); this.loadAssets(); },
  methods: {
    async loadAssets() {
      try { this.assets = await api.myAssets(); } catch (e) {}
    },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.user-card { background: linear-gradient(135deg, #13c2c2, #08979c); border-radius: 16rpx; padding: 30rpx; display: flex; align-items: center; margin-bottom: 20rpx; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; background: #fff; color: #13c2c2; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: bold; }
.user-info { margin-left: 20rpx; }
.name { font-size: 34rpx; color: #fff; font-weight: bold; }
.phone { display: block; font-size: 26rpx; color: rgba(255,255,255,0.8); }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.empty { text-align: center; color: #999; padding: 30rpx; }
.balance-row { display: flex; justify-content: space-around; }
.balance-item { text-align: center; }
.balance-label { font-size: 24rpx; color: #999; display: block; }
.balance-value { font-size: 32rpx; font-weight: bold; }
.balance-value.total { color: #13c2c2; }
.pack-card { border: 1rpx solid #f0f0f0; border-radius: 10rpx; padding: 20rpx; margin-bottom: 16rpx; }
.pack-header { display: flex; justify-content: space-between; margin-bottom: 10rpx; }
.pack-name { font-size: 28rpx; font-weight: bold; }
.pack-type { font-size: 24rpx; color: #13c2c2; }
.pack-detail { display: flex; justify-content: space-between; font-size: 24rpx; color: #666; }
.pack-valid { color: #999; }
.alert-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.alert-name { font-size: 26rpx; }
.alert-info { font-size: 24rpx; color: #faad14; }
</style>
