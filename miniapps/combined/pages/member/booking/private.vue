<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">{{ bizTitle }}</text>
    </view>

    <view class="step-section" v-if="step === 1">
      <text class="step-label">选择教练</text>
      <view v-if="coaches.length === 0" class="empty">暂无可约教练</view>
      <view v-for="c in coaches" :key="c.id" class="coach-card" @click="selectCoach(c)">
        <view class="coach-info">
          <text class="coach-name">{{ c.name }}</text>
          <text class="coach-biz" v-if="c.primary_business_type">{{ bizList(c.primary_business_type) }}</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="step-section" v-if="step === 2">
      <view class="selected-coach">
        <text class="coach-label">教练：{{ selectedCoach.name }}</text>
        <text class="change-btn" @click="step = 1">更换</text>
      </view>

      <text class="step-label">选择日期</text>
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

      <text class="step-label">可约时段</text>
      <view v-if="slots.length === 0" class="empty">该日期暂无可约时段</view>
      <view class="slot-grid">
        <view
          v-for="s in slots"
          :key="s.start_time"
          class="slot-item"
          @click="bookSlot(s)"
        >
          <text class="slot-time">{{ s.start_time }}</text>
          <text class="slot-end">{{ s.end_time }}</text>
        </view>
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
    };
  },
  computed: {
    bizTitle() {
      return this.businessType === 'PRIVATE' ? '私教预约' : '陪练预约';
    },
  },
  onLoad(query) {
    if (query.businessType) this.businessType = query.businessType;
    this.loadCoaches();
    this.genDateList();
  },
  methods: {
    back() { uni.navigateBack(); },
    bizList(s) {
      const map = { PRIVATE: '私教', PRACTICE: '陪练', ADULT_GROUP: '大课', KID_GROUP: '儿童', GYM: '健身', FITNESS: '体能', COMMUNITY: '群活动' };
      return String(s).split(',').filter(Boolean).map((t) => map[t] || t).join('、');
    },
    async loadCoaches() {
      try {
        const list = await api.coachList();
        // 只显示有私教或陪练能力的教练（在职）
        this.coaches = list.filter((c) => c.status === 'ACTIVE');
      } catch (e) {}
    },
    selectCoach(c) {
      this.selectedCoach = c;
      this.step = 2;
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
        list.push({
          dateStr,
          day: d.getDate(),
          wd: '周' + wdNames[d.getDay()],
          future: i > 0 || d.getHours() < 23,
        });
      }
      this.dateList = list;
      this.selectedDate = list[1] ? list[1].dateStr : list[0].dateStr;
    },
    selectDate(d) {
      this.selectedDate = d;
      if (this.selectedCoach) this.loadSlots();
    },
    async loadSlots() {
      try {
        this.slots = await api.coachAvailableSlots(this.selectedCoach.id, { date: this.selectedDate, businessType: this.businessType });
      } catch (e) { this.slots = []; }
    },
    async bookSlot(s) {
      uni.showModal({
        title: '确认预约',
        content: `${this.selectedCoach.name} ${this.selectedDate} ${s.start_time}-${s.end_time}`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.bookPrivate({
                coachId: this.selectedCoach.id,
                businessType: this.businessType,
                date: this.selectedDate,
                startTime: s.start_time,
                endTime: s.end_time,
              });
              this.loadSlots();
              uni.showModal({
                title: '预约成功',
                content: `${this.selectedCoach.name}\n${this.selectedDate} ${s.start_time}-${s.end_time}\n${this.businessType === 'PRIVATE' ? '私教' : '陪练'}`,
                showCancel: true,
                cancelText: '关闭',
                confirmText: '查看订单',
                success: (res2) => {
                  if (res2.confirm) {
                    uni.navigateTo({ url: '/pages/member/orders/orders' });
                  }
                },
              });
            } catch (e) {}
          }
        },
      });
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 40rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; cursor: pointer; }
.title { font-size: 40rpx; font-weight: 800; color: var(--text); }
.step-section { padding: 0 32rpx; }
.step-label { font-size: 30rpx; font-weight: 700; color: var(--text); margin: 24rpx 0 20rpx 0; display: block; }
.empty { text-align: center; color: var(--text-sec); padding: 60rpx; font-size: 28rpx; }
.coach-card { display: flex; justify-content: space-between; align-items: center; background: var(--card); border-radius: 20rpx; padding: 32rpx; margin-bottom: 16rpx; box-shadow: var(--sp-shadow); cursor: pointer; }
.coach-info { flex: 1; }
.coach-name { font-size: 32rpx; font-weight: 700; color: var(--text); }
.coach-biz { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 8rpx; }
.arrow { font-size: 40rpx; color: var(--text-sec); }
.selected-coach { display: flex; justify-content: space-between; align-items: center; background: var(--card); border-radius: 20rpx; padding: 24rpx; margin-bottom: 8rpx; box-shadow: var(--sp-shadow); }
.coach-label { font-size: 28rpx; font-weight: 600; color: var(--text); }
.change-btn { font-size: 26rpx; color: var(--primary); }
.cal-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.cal-day { width: calc(14.28% - 12rpx); text-align: center; padding: 16rpx 0; background: var(--card); border-radius: 16rpx; box-shadow: var(--sp-shadow); }
.cal-day.selected { background: var(--primary); }
.cal-day.selected .day-wd, .cal-day.selected .day-num { color: #fff; }
.cal-day.disabled { opacity: 0.3; }
.day-wd { font-size: 20rpx; color: var(--text-sec); display: block; }
.day-num { font-size: 30rpx; font-weight: 700; color: var(--text); display: block; margin-top: 4rpx; }
.slot-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.slot-item { width: calc(33.33% - 16rpx); text-align: center; padding: 24rpx 0; background: var(--card); border-radius: 16rpx; box-shadow: var(--sp-shadow); cursor: pointer; }
.slot-time { font-size: 30rpx; font-weight: 700; color: var(--primary); display: block; }
.slot-end { font-size: 22rpx; color: var(--text-sec); display: block; margin-top: 4rpx; }
</style>
