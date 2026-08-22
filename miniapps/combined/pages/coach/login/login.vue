<template>
  <view class="login-container">
    <view class="logo">
      <text class="title">侯瑞羽毛球</text>
      <text class="subtitle">教练端</text>
    </view>
    <view class="form">
      <input class="input" v-model="phone" placeholder="手机号" type="number" maxlength="11" />
      <input class="input" v-model="password" placeholder="密码" password />
      <button class="btn" @click="handleLogin" :loading="loading">登录</button>
    </view>
    <view class="hint">默认账号: 13800000002 / 123456</view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
export default {
  data() { return { phone: '', password: '', loading: false }; },
  methods: {
    async handleLogin() {
      if (!this.phone || !this.password) { uni.showToast({ title: '请填写完整', icon: 'none' }); return; }
      this.loading = true;
      try {
        const data = await api.login('coach', { phone: this.phone, password: this.password });
        uni.setStorageSync('token', data.token);
        uni.setStorageSync('user', JSON.stringify(data.user));
        uni.setStorageSync('role', 'coach');
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = data.token; app.globalData.user = data.user; app.globalData.role = 'coach'; }
        uni.reLaunch({ url: '/pages/coach/schedule/schedule' });
      } catch (e) {}
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.login-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #722ed1, #531dab); padding: 80rpx 40rpx; }
.logo { text-align: center; margin-bottom: 60rpx; }
.title { display: block; font-size: 48rpx; color: #fff; font-weight: bold; }
.subtitle { display: block; font-size: 28rpx; color: rgba(255,255,255,0.8); margin-top: 10rpx; }
.form { width: 100%; background: #fff; border-radius: 20rpx; padding: 40rpx; }
.input { height: 90rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; margin-bottom: 24rpx; font-size: 28rpx; }
.btn { background: #722ed1; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; }
.hint { color: rgba(255,255,255,0.7); font-size: 24rpx; margin-top: 30rpx; }
</style>
