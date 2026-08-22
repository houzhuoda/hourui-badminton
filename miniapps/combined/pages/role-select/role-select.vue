<template>
  <view class="role-select">
    <view class="hero">
      <text class="brand">HOURUI</text>
      <text class="title">侯瑞羽毛球</text>
      <text class="subtitle">智能场馆 · 专业训练 · 运动生活</text>
    </view>
    <view class="role-list">
      <view class="role-card" @click="select('member')">
        <view class="role-number">01</view>
        <view class="role-body">
          <text class="role-name">会员</text>
          <text class="role-desc">约课 · 请假 · 查看资产</text>
        </view>
        <text class="role-arrow">›</text>
      </view>
      <view class="role-card" @click="select('sales')">
        <view class="role-number orange">02</view>
        <view class="role-body">
          <text class="role-name">销售</text>
          <text class="role-desc">建档 · 开单 · 业绩统计</text>
        </view>
        <text class="role-arrow">›</text>
      </view>
      <view class="role-card" @click="select('coach')">
        <view class="role-number cyan">03</view>
        <view class="role-body">
          <text class="role-name">教练</text>
          <text class="role-desc">出勤 · 核销 · 课程管理</text>
        </view>
        <text class="role-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    select(role) {
      uni.setStorageSync('role', role);
      const app = getApp();
      if (app && app.globalData) app.globalData.role = role;
      uni.navigateTo({ url: `/pages/login/login?role=${role}` });
    },
  },
};
</script>

<style scoped>
.role-select { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); padding: calc(var(--rpx) * 80) calc(var(--rpx) * 40) calc(var(--rpx) * 60) calc(var(--rpx) * 40); }
.hero { margin-bottom: calc(var(--rpx) * 80); }
.brand { display: block; font-size: 28rpx; font-weight: 700; color: var(--primary); letter-spacing: 8rpx; margin-bottom: 16rpx; }
.title { display: block; font-size: 56rpx; font-weight: 900; color: var(--text); letter-spacing: 2rpx; }
.subtitle { display: block; font-size: 28rpx; color: var(--text-sec); margin-top: 16rpx; }
.role-card { display: flex; align-items: center; background: var(--card); border-radius: 28rpx; padding: 40rpx; margin-bottom: 28rpx; box-shadow: var(--sp-shadow); }
.role-number { width: 72rpx; height: 72rpx; border-radius: 20rpx; background: var(--text); color: #fff; font-size: 32rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-right: 28rpx; }
.role-number.orange { background: var(--primary); }
.role-number.cyan { background: var(--accent); }
.role-body { flex: 1; }
.role-name { display: block; font-size: 36rpx; font-weight: 800; color: var(--text); margin-bottom: 6rpx; }
.role-desc { display: block; font-size: 24rpx; color: var(--text-sec); }
.role-arrow { font-size: 40rpx; color: var(--text-sec); font-weight: 300; }
</style>
