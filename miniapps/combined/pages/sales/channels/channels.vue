<template>
  <view class="ch-page">
    <!-- 概览卡片 -->
    <view class="ch-overview">
      <view class="ch-over-card ch-over-orange">
        <text class="ch-over-label">总获客数</text>
        <text class="ch-over-value">{{ totalMembers }}</text>
      </view>
      <view class="ch-over-card ch-over-cyan">
        <text class="ch-over-label">总开单金额</text>
        <text class="ch-over-value">￥{{ totalAmount }}</text>
      </view>
      <view class="ch-over-card ch-over-green">
        <text class="ch-over-label">本月新增</text>
        <text class="ch-over-value">{{ totalNewThisMonth }}</text>
      </view>
    </view>

    <!-- 渠道列表 -->
    <view class="ch-section">
      <view class="ch-section-header">
        <view class="ch-accent-bar"></view>
        <text class="ch-section-title">渠道获客明细</text>
      </view>

      <view v-if="loading" class="ch-empty">加载中...</view>
      <view v-else-if="channels.length === 0" class="ch-empty">暂无渠道数据</view>

      <view v-for="ch in channels" :key="ch.id" class="ch-card">
        <view class="ch-card-header" @click="toggle(ch.id)">
          <view class="ch-card-left">
            <text class="ch-card-name">{{ ch.name }}</text>
            <text class="ch-card-type">{{ typeName(ch.type) }}</text>
          </view>
          <view class="ch-card-right">
            <text class="ch-card-count">{{ ch.stats.newMembers || 0 }} 人</text>
            <text class="ch-card-arrow" :class="{ open: expandedId === ch.id }">›</text>
          </view>
        </view>

        <view class="ch-card-stats">
          <view class="ch-stat-item">
            <text class="ch-stat-label">本月新增</text>
            <text class="ch-stat-val">{{ ch.stats.newMembers || 0 }}</text>
          </view>
          <view class="ch-stat-item">
            <text class="ch-stat-label">本月开单</text>
            <text class="ch-stat-val">￥{{ ch.stats.orderAmount || 0 }}</text>
          </view>
          <view class="ch-stat-item">
            <text class="ch-stat-label">本月续费</text>
            <text class="ch-stat-val">￥{{ ch.stats.renewAmount || 0 }}</text>
          </view>
        </view>

        <!-- 二级渠道展开 -->
        <view v-if="expandedId === ch.id && ch.subChannels && ch.subChannels.length > 0" class="ch-sub-list">
          <view v-for="sub in ch.subChannels" :key="sub.id" class="ch-sub-row">
            <view class="ch-sub-left">
              <text class="ch-sub-dot"></text>
              <text class="ch-sub-name">{{ sub.name }}</text>
            </view>
            <view class="ch-sub-right">
              <text class="ch-sub-count">{{ sub.stats.newMembers || 0 }} 人</text>
              <text class="ch-sub-amount">￥{{ sub.stats.orderAmount || 0 }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';

const TYPE_NAMES = {
  OFFLINE: '线下',
  ONLINE: '线上',
  REFERRAL: '转介绍',
  OTHER: '其他',
};

export default {
  data() {
    return {
      loading: true,
      channels: [],
      expandedId: null,
    };
  },
  computed: {
    totalMembers() {
      return this.channels.reduce((s, c) => s + (c.stats.newMembers || 0), 0);
    },
    totalAmount() {
      return this.channels.reduce((s, c) => s + (c.stats.orderAmount || 0), 0);
    },
    totalNewThisMonth() {
      return this.channels.reduce((s, c) => s + (c.stats.newMembers || 0), 0);
    },
  },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      this.loading = true;
      try {
        const d = await api.channelStats();
        this.channels = d.channels || [];
      } catch (e) { this.channels = []; }
      this.loading = false;
    },
    typeName(t) { return TYPE_NAMES[t] || t; },
    toggle(id) { this.expandedId = this.expandedId === id ? null : id; },
  },
};
</script>

<style scoped>
.ch-page { min-height: 100vh; background: var(--sp-bg, #F0F2F5); padding: 32rpx; box-sizing: border-box; }

/* 概览卡片 */
.ch-overview { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16rpx; margin-bottom: 24rpx; }
.ch-over-card { border-radius: 24rpx; padding: 28rpx 20rpx; display: flex; flex-direction: column; align-items: center; box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15,23,42,0.10)); }
.ch-over-orange { background: var(--grad-orange, linear-gradient(135deg, #FF4D28, #FF7A5C)); box-shadow: 0 8rpx 24rpx rgba(255,77,40,0.25); }
.ch-over-cyan { background: var(--grad-cyan, linear-gradient(135deg, #06B6D4, #22D3EE)); box-shadow: 0 8rpx 24rpx rgba(6,182,212,0.25); }
.ch-over-green { background: linear-gradient(135deg, #10B981, #34D399); box-shadow: 0 8rpx 24rpx rgba(16,185,129,0.25); }
.ch-over-label { font-size: 22rpx; color: rgba(255,255,255,0.85); margin-bottom: 10rpx; }
.ch-over-value { font-size: 40rpx; font-weight: 800; color: #fff; }

/* 区块 */
.ch-section { background: var(--card, #fff); border-radius: 28rpx; padding: 32rpx; box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15,23,42,0.10)); margin-bottom: 24rpx; }
.ch-section-header { display: flex; align-items: center; margin-bottom: 24rpx; }
.ch-accent-bar { width: 8rpx; height: 32rpx; background: var(--sp-orange, #FF4D28); border-radius: 4rpx; margin-right: 16rpx; }
.ch-section-title { font-size: 28rpx; font-weight: 700; color: var(--text, #0F172A); }
.ch-empty { text-align: center; color: var(--text-sec, #6B7280); font-size: 26rpx; padding: 40rpx 0; }

/* 渠道卡片 */
.ch-card { background: var(--sp-bg, #F8FAFC); border-radius: 20rpx; padding: 24rpx; margin-bottom: 16rpx; }
.ch-card:last-child { margin-bottom: 0; }
.ch-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.ch-card-left { display: flex; align-items: center; gap: 12rpx; }
.ch-card-name { font-size: 30rpx; font-weight: 700; color: var(--text, #0F172A); }
.ch-card-type { font-size: 20rpx; color: var(--text-sec, #6B7280); background: #fff; padding: 4rpx 14rpx; border-radius: 100rpx; }
.ch-card-right { display: flex; align-items: center; gap: 12rpx; }
.ch-card-count { font-size: 26rpx; font-weight: 600; color: var(--sp-orange, #FF4D28); }
.ch-card-arrow { font-size: 32rpx; color: var(--text-sec, #6B7280); transition: transform 0.2s; }
.ch-card-arrow.open { transform: rotate(90deg); }

.ch-card-stats { display: flex; gap: 16rpx; }
.ch-stat-item { flex: 1; text-align: center; }
.ch-stat-label { font-size: 22rpx; color: var(--text-sec, #6B7280); display: block; margin-bottom: 8rpx; }
.ch-stat-val { font-size: 28rpx; font-weight: 700; color: var(--text, #0F172A); }

/* 二级渠道 */
.ch-sub-list { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid var(--border, #EEF0F3); }
.ch-sub-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; }
.ch-sub-left { display: flex; align-items: center; gap: 12rpx; }
.ch-sub-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: var(--sp-orange, #FF4D28); opacity: 0.5; }
.ch-sub-name { font-size: 26rpx; color: var(--text, #0F172A); }
.ch-sub-right { display: flex; align-items: center; gap: 20rpx; }
.ch-sub-count { font-size: 24rpx; color: var(--text-sec, #6B7280); }
.ch-sub-amount { font-size: 26rpx; font-weight: 600; color: var(--sp-orange, #FF4D28); }
</style>
