<template>
  <view class="login-container">
    <view class="logo">
      <text class="title">侯瑞羽毛球</text>
      <text class="subtitle">会员端</text>
    </view>

    <!-- 登录 / 注册 切换 -->
    <view class="tab-bar">
      <text class="tab" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</text>
      <text class="tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</text>
    </view>

    <!-- 登录模式 -->
    <view v-if="mode === 'login'" class="form">
      <input class="input" v-model="phone" placeholder="手机号" type="number" maxlength="11" />
      <input class="input" v-model="password" placeholder="密码" type="password" maxlength="32" />
      <button class="btn" @click="handleLogin" :loading="loading">登录</button>
      <text class="switch-hint" @click="mode = 'register'">还没有账号？去注册</text>
    </view>

    <!-- 注册模式 -->
    <view v-else class="form">
      <input class="input" v-model="regPhone" placeholder="手机号" type="number" maxlength="11" />
      <input class="input" v-model="regName" placeholder="姓名（选填）" maxlength="20" />
      <input class="input" v-model="regPassword" placeholder="密码（至少6位）" type="password" maxlength="32" />
      <input class="input" v-model="regPassword2" placeholder="确认密码" type="password" maxlength="32" />
      <view class="agree-row">
        <view class="checkbox" :class="{ checked: agreedPrivacy }" @click="agreedPrivacy = !agreedPrivacy">
          <text v-if="agreedPrivacy" class="check-icon">✓</text>
        </view>
        <text class="agree-text" @click="agreedPrivacy = !agreedPrivacy">我已阅读并同意</text>
        <text class="agree-link" @click="showPrivacy = true">《隐私协议和免责说明》</text>
      </view>
      <button class="btn" @click="handleRegister" :loading="loading">注册</button>
      <text class="switch-hint" @click="mode = 'login'">已有账号？去登录</text>
    </view>

    <!-- 隐私协议弹窗 -->
    <view v-if="showPrivacy" class="privacy-mask" @click="showPrivacy = false">
      <view class="privacy-sheet" @click.stop>
        <view class="privacy-header">
          <text class="privacy-title">隐私协议和免责说明</text>
          <text class="privacy-close" @click="showPrivacy = false">✕</text>
        </view>
        <scroll-view scroll-y class="privacy-body">
          <text class="privacy-section">一、隐私协议</text>
          <text class="privacy-p">本系统仅收集您的手机号、姓名等必要信息，用于场馆课程预约、会员管理等服务。我们承诺不会将您的个人信息泄露给第三方。</text>
          <text class="privacy-section">二、安全免责说明</text>
          <text class="privacy-p">1. 运动存在一定风险，请根据自身身体状况合理安排运动量。</text>
          <text class="privacy-p">2. 如有心脏病、高血压等不适宜运动的疾病，请提前告知教练。</text>
          <text class="privacy-p">3. 运动过程中如感不适，请立即停止并告知工作人员。</text>
          <text class="privacy-p">4. 场馆仅提供运动场地和指导，对因个人身体原因导致的意外不承担责任。</text>
          <text class="privacy-p">5. 请妥善保管个人财物，遗失或损坏场馆不承担责任。</text>
        </scroll-view>
        <button class="privacy-btn" @click="showPrivacy = false">我知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';

export default {
  data() {
    return {
      mode: 'login',
      phone: '', password: '',
      regPhone: '', regName: '', regPassword: '', regPassword2: '',
      agreedPrivacy: false,
      showPrivacy: false,
      loading: false,
    };
  },
  methods: {
    async handleLogin() {
      if (!this.phone) { uni.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!/^\d{11}$/.test(this.phone)) { uni.showToast({ title: '手机号格式错误', icon: 'none' }); return; }
      if (!this.password) { uni.showToast({ title: '请输入密码', icon: 'none' }); return; }
      this.loading = true;
      try {
        const d = await api.memberPasswordLogin({ phone: String(this.phone), password: String(this.password) });
        uni.setStorageSync('member_token', d.token);
        uni.setStorageSync('member_user', JSON.stringify(d.user));
        uni.switchTab({ url: '/pages/assets/assets' });
      } catch (e) {
        uni.showToast({ title: e.message || '登录失败', icon: 'none', duration: 3000 });
      }
      this.loading = false;
    },
    async handleRegister() {
      if (!this.regPhone) { uni.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!/^\d{11}$/.test(this.regPhone)) { uni.showToast({ title: '手机号格式错误', icon: 'none' }); return; }
      if (!this.regPassword || this.regPassword.length < 6) { uni.showToast({ title: '密码至少6位', icon: 'none' }); return; }
      if (this.regPassword !== this.regPassword2) { uni.showToast({ title: '两次密码不一致', icon: 'none' }); return; }
      if (!this.agreedPrivacy) { uni.showToast({ title: '请先同意隐私协议', icon: 'none' }); return; }
      this.loading = true;
      try {
        const d = await api.memberRegister({
          phone: String(this.regPhone),
          password: String(this.regPassword),
          name: this.regName || undefined,
          agreedPrivacy: true,
        });
        uni.setStorageSync('member_token', d.token);
        uni.setStorageSync('member_user', JSON.stringify(d.user));
        uni.switchTab({ url: '/pages/assets/assets' });
      } catch (e) {
        uni.showToast({ title: e.message || '注册失败', icon: 'none', duration: 3000 });
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.login-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #13c2c2, #08979c); padding: 80rpx 40rpx; }
.logo { text-align: center; margin-bottom: 40rpx; }
.title { display: block; font-size: 48rpx; color: #fff; font-weight: bold; }
.subtitle { display: block; font-size: 28rpx; color: rgba(255,255,255,0.8); margin-top: 10rpx; }

.tab-bar { display: flex; width: 100%; margin-bottom: 32rpx; background: rgba(255,255,255,0.2); border-radius: 16rpx; padding: 6rpx; }
.tab { flex: 1; text-align: center; font-size: 30rpx; font-weight: 700; color: rgba(255,255,255,0.7); padding: 18rpx 0; border-radius: 12rpx; }
.tab.active { background: #fff; color: #08979c; }

.form { width: 100%; background: #fff; border-radius: 20rpx; padding: 40rpx; }
.input { height: 90rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; margin-bottom: 24rpx; font-size: 28rpx; }
.btn { background: #13c2c2; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 16rpx; }
.btn:active { transform: scale(0.97); }
.switch-hint { display: block; text-align: center; font-size: 26rpx; color: #999; margin-top: 28rpx; }

.agree-row { display: flex; align-items: flex-start; margin: 16rpx 0 8rpx; }
.checkbox { width: 36rpx; height: 36rpx; border: 2rpx solid #ddd; border-radius: 8rpx; flex-shrink: 0; margin-right: 12rpx; display: flex; align-items: center; justify-content: center; margin-top: 4rpx; }
.checkbox.checked { background: #13c2c2; border-color: #13c2c2; }
.check-icon { font-size: 24rpx; color: #fff; font-weight: 800; }
.agree-text { font-size: 24rpx; color: #999; }
.agree-link { font-size: 24rpx; color: #13c2c2; }

.privacy-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
.privacy-sheet { background: #fff; border-radius: 24rpx; width: 88%; max-width: 640rpx; max-height: 80vh; display: flex; flex-direction: column; }
.privacy-header { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx; border-bottom: 1rpx solid #eee; }
.privacy-title { font-size: 30rpx; font-weight: 700; color: #333; flex: 1; }
.privacy-close { font-size: 36rpx; color: #999; }
.privacy-body { padding: 24rpx 32rpx; flex: 1; overflow-y: auto; }
.privacy-section { display: block; font-size: 28rpx; font-weight: 700; color: #333; margin: 20rpx 0 12rpx; }
.privacy-p { display: block; font-size: 26rpx; color: #666; line-height: 1.7; margin-bottom: 12rpx; }
.privacy-btn { margin: 16rpx 32rpx 32rpx; background: #13c2c2; color: #fff; border-radius: 100rpx; height: 80rpx; line-height: 80rpx; font-size: 30rpx; font-weight: 700; }
</style>
