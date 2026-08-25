<template>
  <view class="login-container">
    <view class="logo">
      <text class="title">侯瑞羽毛球</text>
      <text class="subtitle">会员端</text>
    </view>
    <view class="form">
      <input class="input" v-model="phone" placeholder="手机号" type="number" maxlength="11" />
      <view class="code-row">
        <input class="input code-input" v-model="code" placeholder="验证码" type="number" maxlength="4" />
        <button class="send-btn" size="mini" @click="sendCode" :disabled="countdown > 0">{{ countdown > 0 ? countdown + 's' : '获取验证码' }}</button>
      </view>
      <button class="btn" @click="handleLogin" :loading="loading">登录</button>
    </view>
    <view class="hint">模拟登录：任意已建档手机号 + 验证码 1234</view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';

export default {
  data() { return { phone: '', code: '', countdown: 0, loading: false, timer: null }; },
  onUnload() { if (this.timer) clearInterval(this.timer); },
  methods: {
    async sendCode() {
      if (!/^\d{11}$/.test(this.phone)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
      try {
        const d = await api.sendCode({ phone: this.phone });
        // 模拟登录：生产环境不返回 demoCode，使用固定验证码 1234
        const code = d.demoCode || '1234';
        uni.showToast({ title: `模拟验证码: ${code}`, icon: 'none' });
        this.code = code;
      } catch (e) {}
      this.countdown = 60;
      this.timer = setInterval(() => { this.countdown--; if (this.countdown <= 0) clearInterval(this.timer); }, 1000);
    },
    async handleLogin() {
      if (!this.phone || !this.code) { uni.showToast({ title: '请填写完整', icon: 'none' }); return; }
      this.loading = true;
      try {
        const d = await api.login({ phone: this.phone, code: this.code });
        uni.setStorageSync('member_token', d.token);
        uni.setStorageSync('member_user', JSON.stringify(d.user));
        uni.switchTab({ url: '/pages/assets/assets' });
      } catch (e) {}
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.login-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #13c2c2, #08979c); padding: 80rpx 40rpx; }
.logo { text-align: center; margin-bottom: 60rpx; }
.title { display: block; font-size: 48rpx; color: #fff; font-weight: bold; }
.subtitle { display: block; font-size: 28rpx; color: rgba(255,255,255,0.8); margin-top: 10rpx; }
.form { width: 100%; background: #fff; border-radius: 20rpx; padding: 40rpx; }
.input { height: 90rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; margin-bottom: 24rpx; font-size: 28rpx; }
.code-row { display: flex; gap: 16rpx; }
.code-input { flex: 1; margin-bottom: 0; }
.send-btn { height: 90rpx; line-height: 90rpx; background: #13c2c2; color: #fff; font-size: 24rpx; }
.btn { background: #13c2c2; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 24rpx; }
.hint { color: rgba(255,255,255,0.7); font-size: 24rpx; margin-top: 30rpx; }
</style>
