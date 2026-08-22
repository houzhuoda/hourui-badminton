<template>
  <view class="page">
    <view class="user-card" v-if="user">
      <view class="avatar">{{ user.name?.[0] || '?' }}</view>
      <view class="info">
        <text class="name">{{ user.name }}</text>
        <text class="phone">{{ user.phone }}</text>
      </view>
    </view>
    <view class="menu-list">
      <view class="menu-item" @click="goTo('/pages/assets/assets')"><text>我的资产</text><text class="arrow">></text></view>
      <view class="menu-item" @click="goTo('/pages/booking/booking')"><text>约课</text><text class="arrow">></text></view>
      <view class="menu-item" @click="goTo('/pages/history/history')"><text>消费/出勤记录</text><text class="arrow">></text></view>
    </view>
    <button class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script>
export default {
  data() { return { user: null }; },
  onShow() { this.user = JSON.parse(uni.getStorageSync('member_user') || '{}'); },
  methods: {
    goTo(url) { uni.navigateTo({ url }); },
    logout() {
      uni.removeStorageSync('member_token'); uni.removeStorageSync('member_user');
      uni.reLaunch({ url: '/pages/login/login' });
    },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.user-card { background: #fff; border-radius: 16rpx; padding: 30rpx; display: flex; align-items: center; margin-bottom: 20rpx; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: #13c2c2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 48rpx; }
.info { margin-left: 24rpx; }
.name { font-size: 36rpx; font-weight: bold; }
.phone { display: block; font-size: 28rpx; color: #999; margin-top: 8rpx; }
.menu-list { background: #fff; border-radius: 16rpx; margin-bottom: 20rpx; }
.menu-item { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0; font-size: 30rpx; }
.arrow { color: #999; }
.logout-btn { background: #fff; color: #ff4d4f; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; border: 1rpx solid #ff4d4f; }
</style>
