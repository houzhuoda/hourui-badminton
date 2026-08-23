<template>
  <view class="page">
    <!-- 顶部用户区 -->
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="user" v-if="user">
        <view class="avatar">{{ user.name ? user.name[0] : '?' }}</view>
        <view class="user-info">
          <text class="name">{{ user.name || '' }}</text>
          <text class="phone">{{ user.phone || '' }}</text>
        </view>
      </view>
    </view>

    <!-- 金刚区：4个按钮 -->
    <view class="king-grid">
      <view class="king-item" :class="{ active: activeTab === 'booking' }" @click="switchTab('booking')">
        <view class="king-icon-box" :class="{ active: activeTab === 'booking' }">
          <text class="king-icon">🏸</text>
        </view>
        <text class="king-label">约课</text>
      </view>
      <view class="king-item" :class="{ active: activeTab === 'bookings' }" @click="switchTab('bookings')">
        <view class="king-icon-box" :class="{ active: activeTab === 'bookings' }">
          <text class="king-icon">📋</text>
        </view>
        <text class="king-label">我的预约</text>
      </view>
      <view class="king-item" @click="showService">
        <view class="king-icon-box">
          <text class="king-icon">🎧</text>
        </view>
        <text class="king-label">客服</text>
      </view>
      <view class="king-item" :class="{ active: activeTab === 'mine' }" @click="switchTab('mine')">
        <view class="king-icon-box" :class="{ active: activeTab === 'mine' }">
          <text class="king-icon">👤</text>
        </view>
        <text class="king-label">我的</text>
      </view>
    </view>

    <!-- 动态内容区 -->
    <view class="content-area">
      <MemberBooking v-if="activeTab === 'booking'" />
      <MemberBookings v-else-if="activeTab === 'bookings'" />
      <MemberProfile v-else-if="activeTab === 'mine'" />
    </view>

    <!-- 客服弹窗 -->
    <view v-if="serviceVisible" class="service-mask" @click="serviceVisible = false">
      <view class="service-sheet" @click.stop>
        <view class="service-title">联系客服</view>
        <view v-if="serviceWechatQr" class="service-qr-box">
          <image :src="serviceWechatQr" class="service-qr" mode="aspectFit" />
          <text class="service-qr-tip">扫码添加客服微信</text>
        </view>
        <view v-if="serviceWechat" class="service-row" @click="copyWechat">
          <text class="service-row-label">客服微信</text>
          <view class="service-row-value-wrap">
            <text class="service-row-value" selectable>{{ serviceWechat }}</text>
            <text class="service-copy">复制</text>
          </view>
        </view>
        <view v-if="servicePhone" class="service-row" @click="callPhone">
          <text class="service-row-label">客服电话</text>
          <view class="service-row-value-wrap">
            <text class="service-row-value" selectable>{{ servicePhone }}</text>
            <text class="service-copy">拨打</text>
          </view>
        </view>
        <view v-if="!serviceWechat && !servicePhone && !serviceWechatQr" class="service-empty">
          <text class="service-empty-text">暂无客服信息，请稍后再试</text>
        </view>
        <button class="service-close" @click="serviceVisible = false">知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import MemberBooking from '../booking/booking.vue';
import MemberBookings from '../bookings/bookings.vue';
import MemberProfile from '../profile/profile.vue';
import { api } from '../../../api/index.js';

export default {
  components: { MemberBooking, MemberBookings, MemberProfile },
  data() {
    return {
      user: null,
      activeTab: 'booking',
      serviceVisible: false,
      serviceWechat: '',
      serviceWechatQr: '',
      servicePhone: '',
    };
  },
  onShow() {
    this.user = JSON.parse(uni.getStorageSync('user') || '{}');
  },
  mounted() {
    if (!this.user || !this.user.name) {
      this.user = JSON.parse(uni.getStorageSync('user') || '{}');
    }
    this.loadServiceConfig();
  },
  methods: {
    switchTab(tab) {
      this.activeTab = tab;
    },
    async loadServiceConfig() {
      try {
        const config = await api.get('/member-end/config');
        if (config) {
          this.serviceWechat = config.service_wechat || '';
          this.serviceWechatQr = config.service_wechat_qr || '';
          this.servicePhone = config.service_phone || '';
        }
      } catch (e) {}
    },
    showService() {
      this.serviceVisible = true;
    },
    copyWechat() {
      if (!this.serviceWechat) return;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(this.serviceWechat);
      }
      uni.setClipboardData({ data: this.serviceWechat });
      uni.showToast({ title: '已复制', icon: 'success' });
    },
    callPhone() {
      if (!this.servicePhone) return;
      uni.makePhoneCall({ phoneNumber: this.servicePhone });
    },
  },
};
</script>

<style scoped>
.page { width: 100%; min-height: 100vh; background: var(--sp-bg); display: flex; flex-direction: column; }

/* 顶部用户区 */
.hero { width: 100%; display: block; padding: 60rpx 40rpx 80rpx 40rpx; border-bottom-left-radius: 40rpx; border-bottom-right-radius: 40rpx; position: relative; overflow: hidden; }
.hero-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--grad-dark); }
.user { width: 100%; display: flex; align-items: center; position: relative; z-index: 1; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: var(--grad-orange); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 800; box-shadow: var(--sp-shadow-orange); flex-shrink: 0; }
.user-info { margin-left: 24rpx; min-width: 0; }
.name { display: block; font-size: 38rpx; color: #fff; font-weight: 800; }
.phone { display: block; font-size: 26rpx; color: rgba(255,255,255,0.7); margin-top: 8rpx; }

/* 金刚区 */
.king-grid { width: calc(100% - 64rpx); display: flex; flex-direction: row; justify-content: space-around; margin: -50rpx 32rpx 0 32rpx; padding: 32rpx 0 28rpx 0; background: var(--card); border-radius: 28rpx; box-shadow: var(--sp-shadow); position: relative; z-index: 10; }
.king-item { flex: 1; text-align: center; transition: transform 0.15s ease; }
.king-item:active { transform: scale(0.95); }
.king-icon-box { width: 88rpx; height: 88rpx; line-height: 88rpx; border-radius: 50%; background: var(--sp-bg-warm); margin: 0 auto 12rpx auto; transition: all 0.2s ease; }
.king-icon-box.active { background: var(--grad-orange); box-shadow: var(--sp-shadow-orange); }
.king-icon { font-size: 40rpx; }
.king-label { display: block; font-size: 26rpx; color: var(--sp-dark); font-weight: 600; }
.king-item.active .king-label { color: var(--sp-orange); font-weight: 700; }

/* 动态内容区 */
.content-area { width: 100%; flex: 1; padding-top: 32rpx; }

/* 客服弹窗 */
.service-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; }
.service-sheet { width: 560rpx; background: #fff; border-radius: 28rpx; padding: 40rpx 32rpx 32rpx 32rpx; display: flex; flex-direction: column; align-items: center; }
.service-title { font-size: 36rpx; font-weight: 800; color: var(--sp-dark, #0F172A); margin-bottom: 32rpx; }
.service-qr-box { text-align: center; margin-bottom: 24rpx; }
.service-qr { width: 280rpx; height: 280rpx; }
.service-qr-tip { display: block; font-size: 24rpx; color: var(--sp-gray, #6B7280); margin-top: 12rpx; }
.service-row { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 24rpx 0; border-top: 1rpx solid var(--border, #EEF0F3); }
.service-row-label { font-size: 28rpx; color: var(--sp-gray, #6B7280); flex-shrink: 0; }
.service-row-value-wrap { display: flex; align-items: center; }
.service-row-value { font-size: 30rpx; font-weight: 600; color: var(--sp-dark, #0F172A); }
.service-copy { font-size: 24rpx; color: var(--sp-orange, #FF4D28); margin-left: 16rpx; }
.service-empty { padding: 60rpx 0; text-align: center; }
.service-empty-text { font-size: 28rpx; color: var(--sp-gray, #6B7280); }
.service-close { width: 100%; height: 88rpx; line-height: 88rpx; background: var(--grad-orange, linear-gradient(135deg, #FF6B35, #FF4D28)); color: #fff; border-radius: 100rpx; border: none; font-size: 30rpx; font-weight: 700; margin-top: 24rpx; }
.service-close:active { transform: scale(0.97); }
</style>
