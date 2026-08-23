<template>
  <view class="sr-page">
    <view class="sr-header">
      <text class="sr-back" @click="back">‹ 返回</text>
      <view class="sr-hero">
        <text class="sr-icon">🔄</text>
        <text class="sr-title">切换身份</text>
        <text class="sr-subtitle">当前身份：会员</text>
      </view>
    </view>

    <view v-if="loading" class="sr-loading">加载中...</view>

    <view v-else class="sr-content">
      <view v-if="roles.length === 0" class="sr-empty">
        <text class="sr-empty-icon">🏸</text>
        <text class="sr-empty-text">该手机号未绑定销售或教练账号</text>
        <text class="sr-empty-hint">请使用对应账号密码登录</text>
      </view>

      <view v-for="r in roles" :key="r.role" class="sr-role-card" :class="r.role" @click="select(r)">
        <view class="sr-role-icon" :class="r.role">
          <text>{{ r.role === 'sales' ? '💼' : '🎯' }}</text>
        </view>
        <view class="sr-role-body">
          <text class="sr-role-name">{{ r.role === 'sales' ? '销售端' : '教练端' }}</text>
          <text class="sr-role-desc">{{ r.name }} · 点击直接切换</text>
        </view>
        <view class="sr-role-arrow" :class="r.role">
          <text>›</text>
        </view>
      </view>

      <view class="sr-divider"><text class="sr-divider-text">其他账号登录</text></view>

      <view class="sr-role-card other" @click="goLogin('sales')">
        <view class="sr-role-icon orange"><text>💼</text></view>
        <view class="sr-role-body">
          <text class="sr-role-name">其他销售账号</text>
          <text class="sr-role-desc">使用手机号 + 密码登录</text>
        </view>
        <view class="sr-role-arrow other"><text>›</text></view>
      </view>
      <view class="sr-role-card other" @click="goLogin('coach')">
        <view class="sr-role-icon purple"><text>🎯</text></view>
        <view class="sr-role-body">
          <text class="sr-role-name">其他教练账号</text>
          <text class="sr-role-desc">使用手机号 + 密码登录</text>
        </view>
        <view class="sr-role-arrow other"><text>›</text></view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';

export default {
  data() { return { roles: [], loading: true }; },
  onShow() { this.loadRoles(); },
  methods: {
    back() { uni.reLaunch({ url: '/pages/member/assets/assets' }); },
    async loadRoles() {
      this.loading = true;
      try { const d = await api.switchableRoles(); this.roles = d.roles || []; } catch (e) { this.roles = []; }
      this.loading = false;
    },
    async select(r) {
      try {
        const d = await api.switchIdentity(r.role);
        uni.setStorageSync('token', d.token);
        uni.setStorageSync('user', JSON.stringify(d.user));
        uni.setStorageSync('role', r.role);
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = d.token; app.globalData.user = d.user; app.globalData.role = r.role; }
        const home = { sales: '/pages/sales/dashboard/dashboard', coach: '/pages/coach/schedule/schedule' }[r.role];
        uni.showToast({ title: '已切换为' + (r.role === 'sales' ? '销售' : '教练'), icon: 'success' });
        setTimeout(() => uni.reLaunch({ url: home }), 600);
      } catch (e) {
        uni.showToast({ title: '切换失败，请尝试密码登录', icon: 'none' });
      }
    },
    goLogin(role) {
      uni.removeStorageSync('token'); uni.removeStorageSync('user');
      uni.setStorageSync('role', role);
      const app = getApp();
      if (app && app.globalData) { app.globalData.token = ''; app.globalData.user = null; app.globalData.role = role; }
      uni.reLaunch({ url: `/pages/login/login?role=${role}` });
    },
  },
};
</script>

<style scoped>
.sr-page { min-height: 100vh; background: var(--sp-bg, #F0F2F5); padding: 32rpx; }

.sr-header { margin-bottom: 48rpx; }
.sr-back { font-size: 28rpx; color: var(--text-sec, #6B7280); margin-bottom: 32rpx; display: block; padding: 8rpx 0; }
.sr-hero { text-align: center; padding: 40rpx 0; }
.sr-icon { font-size: 80rpx; display: block; margin-bottom: 20rpx; }
.sr-title { display: block; font-size: 48rpx; font-weight: 900; color: var(--text, #0F172A); }
.sr-subtitle { display: block; font-size: 28rpx; color: var(--text-sec, #6B7280); margin-top: 12rpx; }

.sr-loading { text-align: center; color: var(--text-sec, #6B7280); padding: 120rpx; font-size: 28rpx; }

.sr-content { width: 100%; }

.sr-empty {
  background: var(--card, #fff);
  border-radius: 28rpx;
  padding: 80rpx 40rpx;
  text-align: center;
  box-shadow: var(--sp-shadow-sm, 0 4rpx 12rpx rgba(15,23,42,0.06));
  margin-bottom: 32rpx;
}
.sr-empty-icon { font-size: 80rpx; display: block; margin-bottom: 24rpx; }
.sr-empty-text { display: block; font-size: 30rpx; color: var(--text, #0F172A); font-weight: 600; margin-bottom: 12rpx; }
.sr-empty-hint { display: block; font-size: 26rpx; color: var(--sp-gray, #6B7280); }

.sr-role-card {
  display: flex;
  align-items: center;
  background: var(--card, #fff);
  border-radius: 28rpx;
  padding: 36rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15,23,42,0.10));
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}
.sr-role-card:active { transform: scale(0.97); }
.sr-role-card.sales { border-left: 8rpx solid var(--sp-orange, #FF4D28); }
.sr-role-card.coach { border-left: 8rpx solid var(--sp-purple, #722ED1); }
.sr-role-card.other { border-left: 8rpx solid var(--sp-light-gray, #E5E7EB); }

.sr-role-icon {
  flex: 0 0 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  margin-right: 28rpx;
}
.sr-role-icon.sales { background: rgba(255, 77, 40, 0.12); }
.sr-role-icon.coach { background: rgba(114, 46, 209, 0.12); }
.sr-role-icon.orange { background: rgba(255, 77, 40, 0.10); }
.sr-role-icon.purple { background: rgba(114, 46, 209, 0.10); }

.sr-role-body { flex: 1; }
.sr-role-name { display: block; font-size: 36rpx; font-weight: 800; color: var(--text, #0F172A); margin-bottom: 8rpx; }
.sr-role-desc { display: block; font-size: 26rpx; color: var(--text-sec, #6B7280); }

.sr-role-arrow {
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
}
.sr-role-arrow.sales { background: rgba(255, 77, 40, 0.10); color: var(--sp-orange, #FF4D28); }
.sr-role-arrow.coach { background: rgba(114, 46, 209, 0.10); color: var(--sp-purple, #722ED1); }
.sr-role-arrow.other { background: rgba(107, 114, 128, 0.10); color: var(--sp-gray, #6B7280); }

.sr-divider { display: flex; align-items: center; margin: 40rpx 0 24rpx; }
.sr-divider::before, .sr-divider::after { content: ''; flex: 1; height: 1rpx; background: var(--border, #EEF0F3); }
.sr-divider-text { padding: 0 24rpx; font-size: 24rpx; color: var(--text-sec, #6B7280); }
</style>
