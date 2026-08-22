<template>
  <view class="page">
    <view class="user-card" v-if="user">
      <view class="avatar">{{ user.name ? user.name[0] : '?' }}</view>
      <view class="info">
        <text class="name">{{ user.name || '' }}</text>
        <text class="phone">{{ user.phone || '' }}</text>
      </view>
      <view class="switch-box" @click="goTo('/pages/switch-role/switch-role')">
        <text class="switch-text">切换身份</text>
        <text class="switch-arrow">›</text>
      </view>
    </view>

    <view class="menu-section">
      <text class="menu-title">会员功能</text>
      <view class="menu-item" @click="goTo('/pages/member/assets/assets')"><text class="menu-icon">💰</text><text class="menu-label">我的资产</text><text class="arrow">›</text></view>
      <view class="menu-item" @click="goTo('/pages/member/booking/booking')"><text class="menu-icon">🏸</text><text class="menu-label">预约课程</text><text class="arrow">›</text></view>
      <view class="menu-item" @click="goTo('/pages/member/orders/orders')"><text class="menu-icon">📋</text><text class="menu-label">我的订单</text><text class="arrow">›</text></view>
      <view class="menu-item" @click="goTo('/pages/member/history/history')"><text class="menu-icon">📊</text><text class="menu-label">消费/出勤记录</text><text class="arrow">›</text></view>
    </view>

    <button class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script>
export default {
  data() { return { user: null }; },
  onShow() { this.user = JSON.parse(uni.getStorageSync('user') || '{}'); },
  methods: {
    goTo(url) { uni.navigateTo({ url }); },
    logout() {
      uni.removeStorageSync('token'); uni.removeStorageSync('user'); uni.removeStorageSync('role');
      const app = getApp();
      if (app && app.globalData) { app.globalData.token = ''; app.globalData.user = null; app.globalData.role = ''; }
      uni.reLaunch({ url: '/pages/member/login/login' });
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg); padding: 40rpx; }
.user-card { display: flex; align-items: center; background: var(--text); border-radius: 28rpx; padding: 40rpx; margin-bottom: 32rpx; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 800; }
.info { flex: 1; margin-left: 24rpx; }
.name { display: block; font-size: 36rpx; color: #fff; font-weight: 800; }
.phone { display: block; font-size: 26rpx; color: rgba(255,255,255,0.7); margin-top: 8rpx; }
.switch-box { padding: 14rpx 24rpx; background: rgba(255,77,40,0.15); border-radius: 12rpx; display: flex; align-items: center; }
.switch-text { font-size: 24rpx; color: var(--primary); font-weight: 700; }
.switch-arrow { font-size: 28rpx; color: var(--primary); margin-left: 8rpx; }
.menu-section { background: var(--card); border-radius: 24rpx; margin-bottom: 28rpx; overflow: hidden; box-shadow: var(--sp-shadow); }
.menu-title { display: block; font-size: 24rpx; font-weight: 700; color: var(--text-sec); padding: 24rpx 32rpx 12rpx 32rpx; text-transform: uppercase; letter-spacing: 2rpx; }
.menu-item { display: flex; align-items: center; padding: 28rpx 32rpx; border-bottom: 1rpx solid var(--border); }
.menu-item:last-child { border-bottom: none; }
.menu-icon { font-size: 36rpx; margin-right: 20rpx; }
.menu-label { flex: 1; font-size: 30rpx; color: var(--text); font-weight: 600; }
.arrow { font-size: 36rpx; color: var(--text-sec); }
.logout-btn { margin-top: 16rpx; }
</style>
