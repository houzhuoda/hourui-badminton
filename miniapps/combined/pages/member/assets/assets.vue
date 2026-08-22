<template>
  <view class="page">
    <view class="hero">
      <view class="user" v-if="user">
        <view class="avatar">{{ user.name ? user.name[0] : '?' }}</view>
        <view class="user-info">
          <text class="name">{{ user.name || '' }}</text>
          <text class="phone">{{ user.phone || '' }}</text>
        </view>
      </view>
    </view>

    <view class="quick-grid">
      <view class="quick-item" @click="goTo('/pages/member/booking/booking')">
        <text class="quick-icon">约</text>
        <text class="quick-label">约课</text>
      </view>
      <view class="quick-item" @click="goTo('/pages/member/orders/orders')">
        <text class="quick-icon">订</text>
        <text class="quick-label">订单</text>
      </view>
      <view class="quick-item" @click="goTo('/pages/member/history/history')">
        <text class="quick-icon">记</text>
        <text class="quick-label">记录</text>
      </view>
      <view class="quick-item" @click="goTo('/pages/member/profile/profile')">
        <text class="quick-icon">我</text>
        <text class="quick-label">我的</text>
      </view>
    </view>

    <view class="content">
      <view class="section">
        <text class="section-title">预存账户</text>
        <view class="balance-row">
          <view class="balance-item"><text class="balance-label">本金</text><text class="balance-value">￥{{ assets.prepaid ? assets.prepaid.principal_balance : 0 }}</text></view>
          <view class="balance-item"><text class="balance-label">赠送</text><text class="balance-value">￥{{ assets.prepaid ? assets.prepaid.gift_balance : 0 }}</text></view>
          <view class="balance-item"><text class="balance-label">合计</text><text class="balance-value total">￥{{ assets.prepaid ? assets.prepaid.total_balance : 0 }}</text></view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">我的课包</text>
        <view v-if="!assets.packs || assets.packs.length === 0" class="empty">暂无课包</view>
        <view v-for="p in (assets.packs || [])" :key="p.id" class="pack-card">
          <view class="pack-main">
            <view class="pack-left">
              <text class="pack-name">{{ p.course_name }}</text>
              <text class="pack-type">{{ p.pack_type === 'SESSION_PACK' ? '次卡' : p.pack_type === 'MONTHLY' ? '月卡' : p.pack_type }}</text>
            </view>
            <view class="pack-remain">
              <text v-if="p.pack_type === 'SESSION_PACK'">剩余 {{ p.remaining_sessions }}/{{ p.total_sessions }} 节</text>
              <text v-else>剩余 {{ p.monthly_remaining }}/{{ p.monthly_quota }} 次</text>
            </view>
          </view>
          <view class="pack-bottom">
            <text class="pack-valid">有效期至 {{ p.valid_until }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';

export default {
  data() { return { user: null, assets: {} }; },
  onShow() {
    this.user = JSON.parse(uni.getStorageSync('user') || '{}');
    this.loadAssets();
  },
  methods: {
    async loadAssets() {
      try { this.assets = await api.myAssets(); } catch (e) {}
    },
    goTo(url) { uni.navigateTo({ url }); },
  },
};
</script>

<style scoped>
.page { width: 100%; min-height: 100vh; background: var(--bg); display: block; }
.hero { width: 100%; display: block; background: var(--text); padding: 60rpx 40rpx; border-bottom-left-radius: 40rpx; border-bottom-right-radius: 40rpx; }
.user { width: 100%; display: flex; align-items: center; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 800; }
.user-info { margin-left: 24rpx; }
.name { display: block; font-size: 38rpx; color: #fff; font-weight: 800; }
.phone { display: block; font-size: 26rpx; color: rgba(255,255,255,0.7); margin-top: 8rpx; }
.quick-grid { width: calc(100% - 64rpx); display: flex; flex-direction: row; margin: -40rpx 32rpx 0 32rpx; padding: 20rpx 0; background: var(--card); border-radius: 24rpx; box-shadow: var(--sp-shadow); position: relative; z-index: 10; }
.quick-item { flex: 1; text-align: center; }
.quick-icon { display: block; width: 64rpx; height: 64rpx; line-height: 64rpx; border-radius: 50%; background: var(--bg); color: var(--primary); font-size: 28rpx; font-weight: 700; margin: 0 auto 10rpx auto; }
.quick-label { display: block; font-size: 24rpx; color: var(--text); font-weight: 600; }
.content { width: 100%; display: block; padding: 32rpx; }
.section { width: 100%; display: block; background: var(--card); border-radius: 28rpx; padding: 32rpx; margin-bottom: 28rpx; box-shadow: var(--sp-shadow); }
.section-title { font-size: 34rpx; font-weight: 800; color: var(--text); margin-bottom: 24rpx; display: block; }
.empty { text-align: center; color: var(--text-sec); padding: 40rpx; font-size: 26rpx; }
.balance-row { width: 100%; display: flex; justify-content: space-around; }
.balance-item { text-align: center; }
.balance-label { font-size: 24rpx; color: var(--text-sec); display: block; margin-bottom: 12rpx; }
.balance-value { font-size: 36rpx; font-weight: 700; color: var(--text); }
.balance-value.total { color: var(--primary); }
.pack-card { width: 100%; display: block; border-radius: 20rpx; padding: 28rpx; margin-bottom: 20rpx; background: var(--bg); }
.pack-main { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.pack-left { flex: 1; min-width: 0; }
.pack-name { font-size: 30rpx; font-weight: 700; color: var(--text); display: block; }
.pack-type { display: inline-block; font-size: 22rpx; color: var(--primary); background: rgba(255,77,40,0.08); padding: 6rpx 18rpx; border-radius: 8rpx; margin-top: 8rpx; }
.pack-remain { font-size: 26rpx; color: var(--text); font-weight: 700; white-space: nowrap; margin-left: 20rpx; }
.pack-bottom { width: 100%; display: block; margin-top: 12rpx; }
.pack-valid { font-size: 24rpx; color: var(--text-sec); display: block; }
</style>
