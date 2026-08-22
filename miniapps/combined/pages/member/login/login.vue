<template>
  <view class="login-page">
    <view class="header">
      <text class="title">会员登录</text>
    </view>
    <view class="form-area">
      <text class="greeting">欢迎回来</text>
      <text class="hint">会员手机号 + 验证码 1234</text>
      <view class="input-group">
        <text class="label">手机号</text>
        <input v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
      </view>
      <view class="input-group">
        <text class="label">验证码</text>
        <view class="code-row">
          <input class="code-input" v-model="code" placeholder="1234" type="number" maxlength="4" />
          <button class="send-btn" @click="sendCode" :disabled="countdown > 0">{{ countdown > 0 ? countdown + 's' : '获取' }}</button>
        </view>
      </view>
      <button class="btn" @click="handleLogin" :loading="loading">登 录</button>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';

export default {
  data() { return { role: 'member', phone: '', code: '', countdown: 0, loading: false, timer: null }; },
  onUnload() { if (this.timer) clearInterval(this.timer); },
  methods: {
    async sendCode() {
      if (!/^\d{11}$/.test(this.phone)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
      try {
        const d = await api.sendCode({ phone: this.phone });
        uni.showToast({ title: `验证码: ${d.demoCode}`, icon: 'none' });
        this.code = d.demoCode || '';
      } catch (e) {}
      this.countdown = 60;
      this.timer = setInterval(() => { this.countdown--; if (this.countdown <= 0) clearInterval(this.timer); }, 1000);
    },
    async handleLogin() {
      if (!this.phone) { uni.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!this.code) { uni.showToast({ title: '请输入验证码', icon: 'none' }); return; }
      this.loading = true;
      try {
        const payload = { phone: String(this.phone), code: String(this.code) };
        const d = await api.login(this.role, payload);
        uni.setStorageSync('token', d.token);
        uni.setStorageSync('user', JSON.stringify(d.user));
        uni.setStorageSync('role', this.role);
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = d.token; app.globalData.user = d.user; app.globalData.role = this.role; }
        uni.reLaunch({ url: '/pages/member/assets/assets' });
      } catch (e) {}
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.login-page { min-height: 100vh; background: var(--bg); padding: 40rpx; }
.header { padding: 40rpx 0 60rpx 0; }
.title { font-size: 40rpx; font-weight: 800; color: var(--text); }
.greeting { display: block; font-size: 52rpx; font-weight: 900; color: var(--text); margin-bottom: 16rpx; }
.hint { display: block; font-size: 26rpx; color: var(--text-sec); margin-bottom: 60rpx; }
.input-group { margin-bottom: 32rpx; }
.label { display: block; font-size: 26rpx; font-weight: 600; color: var(--text); margin-bottom: 12rpx; }
.code-row { display: flex; gap: 16rpx; }
.code-input { flex: 1; margin-bottom: 0; }
</style>
