<template>
  <view class="login-page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="role-tag">{{ roleText }}</text>
    </view>
    <view class="form-area">
      <text class="greeting">欢迎回来</text>
      <text class="hint">{{ hintText }}</text>
      <view class="input-group">
        <text class="label">手机号</text>
        <input v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
      </view>
      <view class="input-group">
        <text class="label">密码</text>
        <input v-model="password" placeholder="请输入密码" password />
      </view>
      <button class="btn" @click="handleLogin" :loading="loading">登 录</button>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';

export default {
  data() { return { role: '', phone: '', code: '', password: '', countdown: 0, loading: false, timer: null }; },
  onLoad(options) {
    this.role = options.role || uni.getStorageSync('role') || '';
    if (!this.role) uni.reLaunch({ url: '/pages/member/login/login' });
  },
  onUnload() { if (this.timer) clearInterval(this.timer); },
  computed: {
    roleText() { return { sales: 'SALES 销售端', coach: 'COACH 教练端' }[this.role] || ''; },
    hintText() {
      if (this.role === 'sales') return '13800000001 / 123456';
      if (this.role === 'coach') return '13800000002 / 123456';
      return '';
    },
  },
  methods: {
    back() { uni.reLaunch({ url: '/pages/member/login/login' }); },
    async handleLogin() {
      if (!this.phone) { uni.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!this.password) { uni.showToast({ title: '请输入密码', icon: 'none' }); return; }
      this.loading = true;
      try {
        const payload = { phone: String(this.phone), password: this.password };
        const d = await api.login(this.role, payload);
        uni.setStorageSync('token', d.token);
        uni.setStorageSync('user', JSON.stringify(d.user));
        uni.setStorageSync('role', this.role);
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = d.token; app.globalData.user = d.user; app.globalData.role = this.role; }
        const home = { sales: 'dashboard/dashboard', coach: 'schedule/schedule' }[this.role];
        uni.reLaunch({ url: `/pages/${this.role}/${home}` });
      } catch (e) {}
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.login-page { min-height: 100vh; background: var(--bg); padding: 40rpx; }
.header { display: flex; align-items: center; margin-bottom: 60rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; cursor: pointer; }
.role-tag { font-size: 24rpx; font-weight: 700; color: var(--primary); background: rgba(255,77,40,0.1); padding: 8rpx 20rpx; border-radius: 8rpx; }
.greeting { display: block; font-size: 52rpx; font-weight: 900; color: var(--text); margin-bottom: 16rpx; }
.hint { display: block; font-size: 26rpx; color: var(--text-sec); margin-bottom: 60rpx; }
.input-group { margin-bottom: 32rpx; }
.label { display: block; font-size: 26rpx; font-weight: 600; color: var(--text); margin-bottom: 12rpx; }
.code-row { display: flex; gap: 16rpx; }
.code-input { flex: 1; margin-bottom: 0; }
</style>
