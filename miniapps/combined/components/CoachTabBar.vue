<template>
  <view class="coach-tabbar">
    <view class="coach-tabbar-item" :class="{ active: active === 'schedule' }" @click.stop="go('schedule')">
      <text class="coach-tabbar-icon">🏸</text>
      <text class="coach-tabbar-label">课表</text>
    </view>
    <view class="coach-tabbar-item" :class="{ active: active === 'stats' }" @click.stop="go('stats')">
      <text class="coach-tabbar-icon">📊</text>
      <text class="coach-tabbar-label">统计</text>
    </view>
    <view v-if="salesEnabled" class="coach-tabbar-item" :class="{ active: active === 'sales' }" @click.stop="go('sales')">
      <text class="coach-tabbar-icon">💰</text>
      <text class="coach-tabbar-label">销售</text>
    </view>
  </view>
</template>

<script>
import { api } from '../api/index.js';

const PAGE_MAP = {
  schedule: '/pages/coach/schedule/schedule',
  stats: '/pages/coach/stats/stats',
  sales: '/pages/coach/sales/dashboard',
};

export default {
  props: {
    active: { type: String, default: '' },
  },
  computed: {
    salesEnabled() {
      try {
        const user = JSON.parse(uni.getStorageSync('user') || '{}');
        return !!(user.salesEnabled || user.sales_enabled);
      } catch { return false; }
    },
  },
  methods: {
    go(key) {
      if (key === this.active) return;
      const url = PAGE_MAP[key];
      if (!url) return;
      uni.reLaunch({ url });
    },
    async switchRole() {
      const memberToken = uni.getStorageSync('memberToken');
      const memberUser = uni.getStorageSync('memberUser');
      if (memberToken && memberUser) {
        uni.setStorageSync('token', memberToken);
        uni.setStorageSync('user', memberUser);
        uni.setStorageSync('role', 'member');
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = memberToken; app.globalData.user = JSON.parse(memberUser); app.globalData.role = 'member'; }
        uni.reLaunch({ url: '/pages/member/assets/assets' });
        return;
      }
      try {
        const d = await api.switchIdentity('member');
        uni.setStorageSync('token', d.token);
        uni.setStorageSync('user', JSON.stringify(d.user));
        uni.setStorageSync('role', 'member');
        uni.reLaunch({ url: '/pages/member/assets/assets' });
      } catch (e) { uni.showToast({ title: e.message || '无法返回会员端', icon: 'none' }); }
    },
  },
};
</script>

<style scoped>
.coach-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background: #fff;
  display: flex;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 9999;
}
.coach-tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  cursor: pointer;
}
.coach-tabbar-item:active { transform: scale(0.92); }
.coach-tabbar-item.active .coach-tabbar-icon { transform: scale(1.15); }
.coach-tabbar-item.active .coach-tabbar-label { color: #FF4D28; font-weight: 700; }
.coach-tabbar-icon { font-size: 40rpx; line-height: 1; }
.coach-tabbar-label { font-size: 22rpx; color: #999; line-height: 1; }
</style>
