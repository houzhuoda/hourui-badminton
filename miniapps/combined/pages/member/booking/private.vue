<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">{{ bizTitle }}</text>
    </view>

    <!-- 步骤1：选择教练 -->
    <view class="step-section" v-if="step === 1">
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="step-label">选择教练</text>
      </view>
      <view v-if="coaches.length === 0" class="empty">
        <text class="empty-emoji">🏸</text>
        <text class="empty-text">暂无可约教练</text>
      </view>
      <view v-for="c in coaches" :key="c.id" class="coach-card" @click="selectCoach(c)">
        <view class="coach-accent"></view>
        <view class="coach-body">
          <view class="coach-avatar">{{ c.name ? c.name[0] : '?' }}</view>
          <view class="coach-info">
            <text class="coach-name">{{ c.name }}</text>
            <text class="coach-biz" v-if="c.primary_business_type">{{ bizList(c.primary_business_type) }}</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 步骤2：选择日期+时段 -->
    <view class="step-section" v-if="step === 2">
      <view class="selected-coach">
        <view class="coach-avatar sm">{{ selectedCoach.name ? selectedCoach.name[0] : '?' }}</view>
        <text class="coach-label">教练：{{ selectedCoach.name }}</text>
        <text class="change-btn" @click="step = 1">更换</text>
      </view>

      <view class="section-header">
        <view class="section-bar"></view>
        <text class="step-label">选择日期</text>
      </view>
      <scroll-view scroll-x class="date-scroll" :show-scrollbar="false">
        <view class="cal-grid">
          <view
            v-for="d in dateList"
            :key="d.dateStr"
            class="cal-day"
            :class="{ selected: d.dateStr === selectedDate, disabled: !d.future }"
            @click="d.future && selectDate(d.dateStr)"
          >
            <text class="day-wd">{{ d.wd }}</text>
            <text class="day-num">{{ d.day }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="section-header">
        <view class="section-bar"></view>
        <text class="step-label">可约时段（可多选）</text>
      </view>
      <view v-if="slots.length === 0" class="empty">
        <text class="empty-emoji">⏰</text>
        <text class="empty-text">该日期暂无可约时段</text>
      </view>
      <view class="slot-grid">
        <view
          v-for="s in slots"
          :key="s.start_time"
          class="slot-item"
          :class="{ selected: isSelected(s) }"
          @click="toggleSlot(s)"
        >
          <text class="slot-time">{{ s.start_time }}</text>
          <text class="slot-end">{{ s.end_time }}</text>
          <text v-if="isSelected(s)" class="slot-check">✓</text>
        </view>
      </view>

      <!-- 底部预约栏 -->
      <view class="bottom-bar" v-if="selectedSlots.length > 0">
        <view class="bottom-info">
          <text class="bottom-count">已选 {{ selectedSlots.length }} 个时段</text>
          <text class="bottom-detail">{{ selectedSlotsText }}</text>
        </view>
        <button class="bottom-btn" @click="showConfirm" :loading="submitting">预约</button>
      </view>
    </view>

    <!-- 预约成功确认弹窗 -->
    <view v-if="resultVisible" class="result-mask" @click="closeResult">
      <view class="result-sheet" @click.stop>
        <view class="result-icon">✅</view>
        <text class="result-title">预约成功</text>
        <view class="result-info-card">
          <view class="result-row">
            <text class="result-label">课程类型</text>
            <text class="result-value">{{ bizTitle }}</text>
          </view>
          <view class="result-row">
            <text class="result-label">教练</text>
            <text class="result-value">{{ selectedCoach.name }}</text>
          </view>
          <view class="result-row">
            <text class="result-label">日期</text>
            <text class="result-value">{{ selectedDate }}</text>
          </view>
          <view class="result-row" v-for="s in successBookings" :key="s.id">
            <text class="result-label">时段</text>
            <text class="result-value">{{ s.start_time }} - {{ s.end_time }}</text>
          </view>
          <view class="result-row" v-if="failedSlots.length > 0">
            <text class="result-label">失败时段</text>
            <text class="result-value fail">{{ failedSlotsText }}</text>
          </view>
        </view>
        <view class="result-btns">
          <button class="result-btn-back" @click="closeResult">返回修改</button>
          <button class="result-btn-confirm" @click="goBookings">确认</button>
        </view>
      </view>
    </view>

    <!-- 无权益客服弹窗 -->
    <view v-if="serviceVisible" class="service-mask" @click="serviceVisible = false">
      <view class="service-sheet" @click.stop>
        <view class="service-handle"></view>
        <text class="service-title">需要开通课包才能约课</text>
        <text class="service-desc">您当前没有该课程的有效次卡或月卡，请添加客服微信开通课包</text>
        <view v-if="serviceWechatQr" class="service-qr-box">
          <image :src="serviceWechatQr" class="service-qr" mode="aspectFit" />
        </view>
        <view class="service-wechat-box">
          <text class="service-wechat-label">客服微信：</text>
          <text class="service-wechat-value" selectable>{{ serviceWechat }}</text>
          <text class="service-copy" @click="copyWechat">复制</text>
        </view>
        <button class="service-close" @click="serviceVisible = false">知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';

export default {
  data() {
    return {
      businessType: 'PRIVATE',
      step: 1,
      coaches: [],
      selectedCoach: null,
      selectedDate: '',
      slots: [],
      dateList: [],
      selectedSlots: [],
      submitting: false,
      resultVisible: false,
      successBookings: [],
      failedSlots: [],
      serviceVisible: false, serviceWechat: '', serviceWechatQr: '',
    };
  },
  computed: {
    bizTitle() {
      return this.businessType === 'PRIVATE' ? '私教预约' : '陪练预约';
    },
    selectedSlotsText() {
      return this.selectedSlots.map((s) => s.start_time).join('、');
    },
    failedSlotsText() {
      return this.failedSlots.map((s) => `${s.start_time}-${s.end_time}`).join('、');
    },
  },
  onLoad(query) {
    if (query && query.businessType) this.businessType = query.businessType;
    this.loadCoaches();
    this.genDateList();
    this.loadServiceConfig();
  },
  mounted() {
    if (typeof window !== 'undefined' && window.location) {
      const url = new URL(window.location.href);
      const bt = url.searchParams.get('businessType');
      if (bt) this.businessType = bt;
    }
    if (this.coaches.length === 0) {
      this.loadCoaches();
      this.genDateList();
    }
    if (!this.serviceWechatQr) this.loadServiceConfig();
  },
  methods: {
    back() { uni.navigateBack(); },
    async loadServiceConfig() {
      try {
        const config = await api.get('/member-end/config');
        if (config) {
          this.serviceWechat = config.service_wechat || '';
          this.serviceWechatQr = config.service_wechat_qr || '';
        }
      } catch (e) {}
    },
    bizList(s) {
      const map = { PRIVATE: '私教', PRACTICE: '陪练', ADULT_GROUP: '大课', KID_GROUP: '儿童', GYM: '健身', FITNESS: '体能', COMMUNITY: '群活动' };
      return String(s).split(',').filter(Boolean).map((t) => map[t] || t).join('、');
    },
    async loadCoaches() {
      try {
        const list = await api.coachList();
        this.coaches = list.filter((c) => c.status === 'ACTIVE');
      } catch (e) {}
    },
    selectCoach(c) {
      this.selectedCoach = c;
      this.step = 2;
      this.selectedSlots = [];
      if (this.selectedDate) this.loadSlots();
    },
    genDateList() {
      const today = new Date();
      const wdNames = ['日', '一', '二', '三', '四', '五', '六'];
      const list = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        list.push({ dateStr, day: d.getDate(), wd: '周' + wdNames[d.getDay()], future: i > 0 || d.getHours() < 23 });
      }
      this.dateList = list;
      this.selectedDate = list[1] ? list[1].dateStr : list[0].dateStr;
    },
    selectDate(d) {
      this.selectedDate = d;
      this.selectedSlots = [];
      if (this.selectedCoach) this.loadSlots();
    },
    async loadSlots() {
      try {
        this.slots = await api.coachAvailableSlots(this.selectedCoach.id, { date: this.selectedDate, businessType: this.businessType });
      } catch (e) { this.slots = []; }
    },
    isSelected(s) {
      return this.selectedSlots.some((x) => x.start_time === s.start_time);
    },
    toggleSlot(s) {
      const idx = this.selectedSlots.findIndex((x) => x.start_time === s.start_time);
      if (idx >= 0) {
        this.selectedSlots.splice(idx, 1);
      } else {
        this.selectedSlots.push({ ...s });
        // 按时间排序
        this.selectedSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
      }
    },
    async showConfirm() {
      if (this.selectedSlots.length === 0) return;
      this.submitting = true;
      this.successBookings = [];
      this.failedSlots = [];

      // 提交前刷新可用时段，排除已被抢走的时段
      try {
        const freshSlots = await api.coachAvailableSlots(this.selectedCoach.id, { date: this.selectedDate, businessType: this.businessType });
        const freshTimes = new Set(freshSlots.map((s) => s.start_time));
        const staleSlots = this.selectedSlots.filter((s) => !freshTimes.has(s.start_time));
        if (staleSlots.length > 0) {
          // 移除已被占用的时段
          this.selectedSlots = this.selectedSlots.filter((s) => freshTimes.has(s.start_time));
          this.slots = freshSlots;
          uni.showToast({ title: `${staleSlots.length}个时段已被预约，已自动移除`, icon: 'none' });
          if (this.selectedSlots.length === 0) {
            this.submitting = false;
            return;
          }
        }
      } catch (e) {}

      for (const s of this.selectedSlots) {
        try {
          const booking = await api.bookPrivate({
            coachId: this.selectedCoach.id,
            businessType: this.businessType,
            date: this.selectedDate,
            startTime: s.start_time,
            endTime: s.end_time,
          });
          this.successBookings.push(booking);
        } catch (e) {
          if (e.message === 'NO_PACK') {
            // 无权益，弹客服弹窗（二维码已在页面加载时预取）
            if (e.data && e.data.serviceWechat) this.serviceWechat = e.data.serviceWechat;
            this.serviceVisible = true;
            this.submitting = false;
            return;
          }
          // 友好化错误信息
          let reason = e.message || '预约失败';
          if (reason.includes('已被预约') || e.code === 409) reason = '该时段已被预约';
          else if (reason.includes('有其他课程')) reason = '教练该时段有其他课程';
          else if (reason.includes('不在') && reason.includes('范围')) reason = '该时段不在教练可用时间';
          this.failedSlots.push({ ...s, reason });
        }
      }

      this.submitting = false;
      // 如果有成功的预约，显示结果弹窗
      if (this.successBookings.length > 0) {
        this.resultVisible = true;
      } else if (this.failedSlots.length > 0) {
        uni.showToast({ title: this.failedSlots[0].reason || '预约失败', icon: 'none' });
      }
    },
    closeResult() {
      this.resultVisible = false;
      // 从已选和可用列表中移除已成功的时段
      const successTimes = new Set(this.successBookings.map((b) => b.start_time));
      this.selectedSlots = this.selectedSlots.filter((s) => !successTimes.has(s.start_time));
      // 刷新可用时段
      if (this.selectedCoach) this.loadSlots();
    },
    goBookings() {
      this.resultVisible = false;
      uni.navigateTo({ url: '/pages/member/bookings/bookings' });
    },
    copyWechat() {
      if (this.serviceWechat) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(this.serviceWechat);
          uni.showToast({ title: '已复制', icon: 'success' });
        } else {
          uni.setClipboardData({ data: this.serviceWechat });
        }
      }
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--sp-bg); padding-bottom: 140rpx; }
.header { display: flex; align-items: center; padding: 32rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; transition: transform 0.15s ease; }
.back:active { transform: scale(0.9); }
.title { font-size: 40rpx; font-weight: 800; color: var(--sp-dark); }

.step-section { padding: 0 32rpx; }
.section-header { display: flex; align-items: center; margin: 32rpx 0 24rpx; }
.section-bar { width: 8rpx; height: 32rpx; background: var(--grad-orange); border-radius: 4rpx; margin-right: 16rpx; }
.step-label { font-size: 32rpx; font-weight: 800; color: var(--sp-dark); }
.empty { text-align: center; padding: 80rpx 0; }
.empty-emoji { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }

/* 教练卡片 */
.coach-card { display: flex; background: var(--card); border-radius: 24rpx; margin-bottom: 20rpx; overflow: hidden; box-shadow: var(--sp-shadow); }
.coach-card:active { transform: scale(0.98); }
.coach-accent { width: 8rpx; background: var(--grad-orange); flex-shrink: 0; }
.coach-body { flex: 1; display: flex; align-items: center; padding: 28rpx; }
.coach-avatar { width: 72rpx; height: 72rpx; border-radius: 50%; background: var(--grad-orange); display: flex; align-items: center; justify-content: center; font-size: 32rpx; font-weight: 800; color: #fff; flex-shrink: 0; }
.coach-avatar.sm { width: 56rpx; height: 56rpx; font-size: 26rpx; }
.coach-info { flex: 1; margin-left: 20rpx; min-width: 0; }
.coach-name { display: block; font-size: 32rpx; font-weight: 700; color: var(--text); }
.coach-biz { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 6rpx; }
.arrow { font-size: 36rpx; color: var(--text-sec); flex-shrink: 0; }

/* 选中教练栏 */
.selected-coach { display: flex; align-items: center; background: var(--card); border-radius: 20rpx; padding: 20rpx 24rpx; margin-bottom: 8rpx; box-shadow: var(--sp-shadow-sm); }
.coach-label { flex: 1; font-size: 28rpx; font-weight: 600; color: var(--text); margin-left: 16rpx; }
.change-btn { font-size: 26rpx; color: var(--sp-orange); font-weight: 600; }

/* 日期选择 */
.date-scroll { white-space: nowrap; margin-bottom: 8rpx; }
.cal-grid { display: flex; gap: 16rpx; padding: 8rpx 0; }
.cal-day { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 96rpx; height: 96rpx; border-radius: 20rpx; background: var(--card); flex-shrink: 0; box-shadow: var(--sp-shadow-sm); transition: all 0.2s; }
.cal-day.disabled { opacity: 0.4; }
.cal-day.selected { background: var(--grad-orange); box-shadow: var(--sp-shadow-orange); }
.cal-day:active { transform: scale(0.95); }
.day-wd { font-size: 22rpx; color: var(--text-sec); }
.cal-day.selected .day-wd { color: rgba(255,255,255,0.9); }
.day-num { font-size: 32rpx; font-weight: 800; color: var(--sp-dark); margin-top: 4rpx; }
.cal-day.selected .day-num { color: #fff; }

/* 时段网格 */
.slot-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.slot-item { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: calc((100% - 32rpx) / 3); padding: 24rpx 0; border-radius: 20rpx; background: var(--card); box-shadow: var(--sp-shadow-sm); transition: all 0.2s; border: 4rpx solid transparent; }
.slot-item:active { transform: scale(0.95); }
.slot-item.selected { border-color: var(--sp-orange); background: rgba(255,77,40,0.06); }
.slot-time { font-size: 30rpx; font-weight: 800; color: var(--sp-dark); }
.slot-item.selected .slot-time { color: var(--sp-orange); }
.slot-end { font-size: 22rpx; color: var(--text-sec); margin-top: 4rpx; }
.slot-check { position: absolute; top: 8rpx; right: 12rpx; font-size: 28rpx; color: var(--sp-orange); font-weight: 800; }

/* 底部预约栏 */
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; background: var(--card); padding: 20rpx 32rpx; box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08); z-index: 100; }
.bottom-info { flex: 1; min-width: 0; }
.bottom-count { display: block; font-size: 28rpx; font-weight: 700; color: var(--sp-dark); }
.bottom-detail { display: block; font-size: 22rpx; color: var(--text-sec); margin-top: 4rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bottom-btn { background: var(--grad-orange) !important; color: #fff !important; border-radius: 100rpx !important; height: 80rpx; line-height: 80rpx; font-size: 30rpx; font-weight: 700; padding: 0 48rpx; margin: 0; min-width: 0; flex-shrink: 0; box-shadow: var(--sp-shadow-orange); }
.bottom-btn:active { transform: scale(0.97); }

/* 预约成功弹窗 */
.result-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
.result-sheet { background: var(--card); border-radius: 32rpx; width: 86%; max-width: 600rpx; padding: 40rpx 32rpx 32rpx; box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.2); }
.result-icon { font-size: 80rpx; text-align: center; }
.result-title { display: block; text-align: center; font-size: 36rpx; font-weight: 800; color: var(--sp-dark); margin: 16rpx 0 24rpx; }
.result-info-card { background: var(--sp-bg); border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; }
.result-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 12rpx 0; border-bottom: 2rpx solid var(--border); }
.result-row:last-child { border-bottom: none; }
.result-label { font-size: 26rpx; color: var(--text-sec); flex-shrink: 0; }
.result-value { font-size: 26rpx; font-weight: 600; color: var(--sp-dark); text-align: right; }
.result-value.fail { color: var(--sp-red); font-size: 24rpx; }
.result-btns { display: flex; gap: 20rpx; }
.result-btn-back { flex: 1; background: var(--card) !important; color: var(--text-sec) !important; border: 2rpx solid var(--border) !important; border-radius: 100rpx !important; height: 80rpx; line-height: 76rpx; font-size: 28rpx; font-weight: 600; margin: 0; }
.result-btn-back:active { transform: scale(0.97); }
.result-btn-confirm { flex: 1; background: var(--grad-orange) !important; color: #fff !important; border-radius: 100rpx !important; height: 80rpx; line-height: 80rpx; font-size: 28rpx; font-weight: 700; margin: 0; box-shadow: var(--sp-shadow-orange); }
.result-btn-confirm:active { transform: scale(0.97); }

/* 客服弹窗 */
.service-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 200; }
.service-sheet { background: var(--card); border-radius: 32rpx 32rpx 0 0; width: 100%; padding: 40rpx 32rpx 60rpx; }
.service-handle { width: 60rpx; height: 8rpx; background: var(--border); border-radius: 4rpx; margin: 0 auto 24rpx; }
.service-title { display: block; text-align: center; font-size: 32rpx; font-weight: 800; color: var(--sp-dark); margin-bottom: 16rpx; }
.service-desc { display: block; text-align: center; font-size: 26rpx; color: var(--text-sec); margin-bottom: 24rpx; }
.service-qr-box { text-align: center; margin-bottom: 24rpx; }
.service-qr { width: 240rpx; height: 240rpx; }
.service-wechat-box { display: flex; align-items: center; justify-content: center; background: var(--sp-bg); border-radius: 16rpx; padding: 20rpx; margin-bottom: 24rpx; }
.service-wechat-label { font-size: 26rpx; color: var(--text-sec); }
.service-wechat-value { font-size: 28rpx; font-weight: 700; color: var(--sp-dark); margin: 0 12rpx; }
.service-copy { font-size: 24rpx; color: var(--sp-orange); font-weight: 600; padding: 6rpx 20rpx; background: rgba(255,77,40,0.1); border-radius: 100rpx; }
.service-close { background: var(--grad-orange) !important; color: #fff !important; border-radius: 100rpx !important; height: 80rpx; line-height: 80rpx; font-size: 28rpx; font-weight: 700; }
.service-close:active { transform: scale(0.97); }
</style>
