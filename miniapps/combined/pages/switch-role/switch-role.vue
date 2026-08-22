<template>
  <view class="page">
    <text class="back" @click="back">‹ 返回</text>
    <view class="hero">
      <text class="title">切换身份</text>
      <text class="subtitle">当前：会员</text>
    </view>
    <view class="role-list">
      <view class="role-card" @click="select('sales')">
        <view class="role-icon orange">💼</view>
        <view class="role-body">
          <text class="role-name">销售端</text>
          <text class="role-desc">建档开单 / 业绩统计</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="role-card" @click="select('coach')">
        <view class="role-icon purple">🎯</view>
        <view class="role-body">
          <text class="role-name">教练端</text>
          <text class="role-desc">出勤核销 / 课表统计</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    back() { uni.reLaunch({ url: '/pages/member/assets/assets' }); },
    select(role) {
      uni.removeStorageSync('token');
      uni.removeStorageSync('user');
      uni.setStorageSync('role', role);
      const app = getApp();
      if (app && app.globalData) { app.globalData.token = ''; app.globalData.user = null; app.globalData.role = role; }
      uni.reLaunch({ url: `/pages/login/login?role=${role}` });
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg); padding: 40rpx; }
.back { font-size: 28rpx; color: var(--text-sec); margin-bottom: 40rpx; display: block; }
.hero { margin-bottom: 60rpx; }
.title { display: block; font-size: 48rpx; font-weight: 800; color: var(--text); }
.subtitle { display: block; font-size: 28rpx; color: var(--text-sec); margin-top: 12rpx; }
.role-list { width: 100%; }
.role-card { display: flex; align-items: center; background: var(--card); border-radius: 24rpx; padding: 40rpx; margin-bottom: 28rpx; border-left: 10rpx solid var(--primary); box-shadow: var(--sp-shadow); }
.role-icon { flex: 0 0 80rpx; height: 80rpx; border-radius: 20rpx; background: rgba(255,77,40,0.1); display: flex; align-items: center; justify-content: center; font-size: 40rpx; margin-right: 24rpx; }
.role-icon.orange { background: rgba(255,77,40,0.1); }
.role-icon.purple { background: rgba(114,46,209,0.1); }
.role-body { flex: 1; }
.role-name { display: block; font-size: 36rpx; font-weight: 700; color: var(--text); margin-bottom: 8rpx; }
.role-desc { display: block; font-size: 26rpx; color: var(--text-sec); }
.arrow { font-size: 40rpx; color: var(--text-sec); }
</style>
