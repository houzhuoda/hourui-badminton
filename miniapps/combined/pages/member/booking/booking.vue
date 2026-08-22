<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">预约课程</text>
    </view>

    <view class="filter-bar">
      <view class="filter-item" :class="{ active: businessType === '' }" @click="setType('')">全部</view>
      <view class="filter-item" :class="{ active: businessType === 'PRIVATE' }" @click="goPrivate('PRIVATE')">私教</view>
      <view class="filter-item" :class="{ active: businessType === 'ADULT_GROUP' }" @click="setType('ADULT_GROUP')">大课</view>
      <view class="filter-item" :class="{ active: businessType === 'PRACTICE' }" @click="goPrivate('PRACTICE')">陪练</view>
      <view class="filter-item" :class="{ active: businessType === 'KID_GROUP' }" @click="setType('KID_GROUP')">儿童</view>
      <view class="filter-item" :class="{ active: businessType === 'FITNESS' }" @click="setType('FITNESS')">体能</view>
      <view class="filter-item" :class="{ active: businessType === 'GYM' }" @click="setType('GYM')">健身</view>
      <view class="filter-item" :class="{ active: businessType === 'COMMUNITY' }" @click="setType('COMMUNITY')">群活动</view>
    </view>

    <view class="calendar">
      <view class="cal-header">
        <text class="cal-nav" @click="prevWeek">‹</text>
        <text class="cal-title">{{ monthLabel }}</text>
        <text class="cal-nav" @click="nextWeek">›</text>
      </view>
      <view class="cal-weekdays">
        <text class="cal-wd">日</text>
        <text class="cal-wd">一</text>
        <text class="cal-wd">二</text>
        <text class="cal-wd">三</text>
        <text class="cal-wd">四</text>
        <text class="cal-wd">五</text>
        <text class="cal-wd">六</text>
      </view>
      <view class="cal-grid">
        <view
          v-for="d in calendarDays"
          :key="d.key"
          class="cal-day"
          :class="{
            'other-month': !d.inMonth,
            'today': d.isToday,
            'selected': d.dateStr === selectedDate,
            'has-sessions': d.count > 0,
          }"
          @click="d.inMonth && selectDate(d.dateStr)"
        >
          <text class="day-num">{{ d.day }}</text>
          <text v-if="d.count > 0" class="day-dot">{{ d.count }}</text>
        </view>
      </view>
    </view>

    <view class="selected-info">
      <text class="selected-date">{{ selectedDateLabel }}</text>
      <text class="selected-count" v-if="list.length > 0">{{ list.length }} 节可约</text>
    </view>

    <view v-if="list.length === 0" class="empty">该日期暂无可约课次</view>

    <view v-for="s in list" :key="s.id" class="session-card">
      <view class="card-main">
        <view class="time-col">
          <text class="time-text">{{ s.start_time }}</text>
          <text class="time-end">- {{ s.end_time }}</text>
        </view>
        <view class="info-col">
          <view class="info-head">
            <text class="course-name">{{ s.course_name }}</text>
            <text class="biz-tag">{{ bizName(s.business_type) }}</text>
          </view>
          <view class="info-meta">
            <text class="meta-text">教练 {{ s.coach_name || '待定' }}</text>
            <text class="meta-text" v-if="s.court_name">· {{ s.court_name }}</text>
          </view>
          <text class="capacity">可约 {{ s.available_slots }} 位</text>
        </view>
      </view>
      <view class="card-action">
        <button class="book-btn" @click="bookSession(s)" v-if="!isBooked(s.id)">立即预约</button>
        <text v-else class="booked-tag">已预约</text>
      </view>
    </view>

    <view class="my-bookings" v-if="bookings.length > 0">
      <text class="section-title">我的约课记录</text>
      <view v-for="b in bookings" :key="b.id" class="booking-row">
        <view class="booking-left">
          <text class="booking-course">{{ b.course_name }}</text>
          <text class="booking-time">{{ b.date }} {{ b.start_time }}</text>
        </view>
        <view class="booking-right">
          <text class="booking-status" :class="b.status">{{ bookingStatusName(b.status) }}</text>
          <button v-if="b.status === 'BOOKED'" class="cancel-btn" @click="cancelBooking(b)">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, BOOKING_STATUS } from '../../../utils/constants.js';

export default {
  data() {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayStr = fmt(today);
    // 当月1号
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      businessType: '',
      list: [],
      bookings: [],
      allSessions: [],
      selectedDate: todayStr,
      viewYear: today.getFullYear(),
      viewMonth: today.getMonth(),
      todayStr,
      fmt,
    };
  },
  computed: {
    monthLabel() {
      return `${this.viewYear}年${this.viewMonth + 1}月`;
    },
    selectedDateLabel() {
      if (!this.selectedDate) return '请选择日期';
      const [y, m, d] = this.selectedDate.split('-');
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      return `${m}月${d}日 ${wd}`;
    },
    calendarDays() {
      const days = [];
      const year = this.viewYear;
      const month = this.viewMonth;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstWeekday = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      // 上月填充
      const prevLastDay = new Date(year, month, 0).getDate();
      for (let i = firstWeekday - 1; i >= 0; i--) {
        const d = prevLastDay - i;
        const date = new Date(year, month - 1, d);
        days.push({ key: `prev-${d}`, day: d, dateStr: this.fmt(date), inMonth: false, isToday: this.fmt(date) === this.todayStr, count: this.countForDate(this.fmt(date)) });
      }
      // 当月
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const ds = this.fmt(date);
        days.push({ key: `cur-${d}`, day: d, dateStr: ds, inMonth: true, isToday: ds === this.todayStr, count: this.countForDate(ds) });
      }
      // 下月填充到42格
      const remaining = 42 - days.length;
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d);
        days.push({ key: `next-${d}`, day: d, dateStr: this.fmt(date), inMonth: false, isToday: this.fmt(date) === this.todayStr, count: this.countForDate(this.fmt(date)) });
      }
      return days;
    },
  },
  onShow() {
    this.loadAllSessions();
    this.loadBookings();
  },
  methods: {
    back() { uni.navigateBack(); },
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    bookingStatusName(s) { return BOOKING_STATUS[s] || s; },
    setType(t) { this.businessType = t; this.loadAllSessions(); },
    goPrivate(bt) { uni.navigateTo({ url: `/pages/member/booking/private?businessType=${bt}` }); },
    selectDate(d) { this.selectedDate = d; this.filterList(); },
    prevWeek() {
      this.viewMonth--;
      if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
    },
    nextWeek() {
      this.viewMonth++;
      if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
    },
    countForDate(dateStr) {
      if (!this.allSessions) return 0;
      return this.allSessions.filter((s) => s.date === dateStr).length;
    },
    filterList() {
      if (!this.allSessions) { this.list = []; return; }
      this.list = this.allSessions.filter((s) => s.date === this.selectedDate);
    },
    async loadAllSessions() {
      try {
        // 加载未来30天的可约课次
        const params = {};
        if (this.businessType) params.businessType = this.businessType;
        this.allSessions = await api.availableSessions(params);
        this.filterList();
      } catch (e) { this.allSessions = []; this.list = []; }
    },
    async loadBookings() {
      try { this.bookings = await api.myBookings(); } catch (e) {}
    },
    isBooked(id) { return this.bookings.some((b) => b.session_id === id && b.status === 'BOOKED'); },
    async bookSession(s) {
      try {
        await api.bookSession({ sessionId: s.id });
        this.loadBookings(); this.loadAllSessions();
        uni.showModal({
          title: '预约成功',
          content: `${s.course_name}\n${s.date} ${s.start_time}-${s.end_time}\n教练：${s.coach_name || '待定'}`,
          showCancel: true,
          cancelText: '关闭',
          confirmText: '查看订单',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/member/orders/orders' });
            }
          },
        });
      } catch (e) {}
    },
    async cancelBooking(b) {
      uni.showModal({
        title: '确认取消',
        content: `确定取消 ${b.course_name} 的预约吗？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.cancelBooking(b.id);
              uni.showToast({ title: '已取消', icon: 'success' });
              this.loadBookings(); this.loadAllSessions();
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
.filter-bar { display: flex; flex-wrap: wrap; padding: 0 32rpx; gap: 16rpx; margin-bottom: 20rpx; }
.filter-item { padding: 12rpx 28rpx; border-radius: 12rpx; font-size: 26rpx; color: var(--text-sec); background: var(--card); }
.filter-item.active { color: #fff; background: var(--primary); font-weight: 600; }

.calendar { background: var(--card); border-radius: 24rpx; margin: 0 32rpx 24rpx 32rpx; padding: 24rpx; box-shadow: var(--sp-shadow); }
.cal-header { display: flex; align-items: center; justify-content: center; margin-bottom: 20rpx; }
.cal-nav { font-size: 40rpx; color: var(--text-sec); padding: 0 32rpx; cursor: pointer; }
.cal-title { font-size: 32rpx; font-weight: 800; color: var(--text); }
.cal-weekdays { display: flex; margin-bottom: 12rpx; }
.cal-wd { width: 14.28%; text-align: center; font-size: 24rpx; color: var(--text-sec); font-weight: 600; }
.cal-grid { display: flex; flex-wrap: wrap; }
.cal-day { width: 14.28%; text-align: center; padding: 16rpx 0; cursor: pointer; box-sizing: border-box; }
.day-num { font-size: 28rpx; color: var(--text); display: block; }
.cal-day.other-month .day-num { color: #ccc; }
.cal-day.today .day-num { color: var(--primary); font-weight: 800; }
.cal-day.selected { background: rgba(255,77,40,0.1); border-radius: 12rpx; }
.cal-day.selected .day-num { color: var(--primary); font-weight: 800; }
.day-dot { font-size: 18rpx; color: #fff; background: var(--primary); border-radius: 20rpx; padding: 2rpx 10rpx; display: inline-block; margin-top: 4rpx; }
.cal-day.other-month .day-dot { background: #ddd; }

.selected-info { display: flex; justify-content: space-between; align-items: center; padding: 0 32rpx; margin-bottom: 20rpx; }
.selected-date { font-size: 30rpx; font-weight: 700; color: var(--text); }
.selected-count { font-size: 24rpx; color: var(--primary); font-weight: 600; }

.empty { text-align: center; color: var(--text-sec); padding: 80rpx; font-size: 28rpx; }
.session-card { background: var(--card); border-radius: 24rpx; padding: 32rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); }
.card-main { display: flex; align-items: flex-start; }
.time-col { width: 150rpx; }
.time-text { font-size: 32rpx; font-weight: 800; color: var(--text); display: block; }
.time-end { font-size: 22rpx; color: var(--text-sec); display: block; margin-top: 8rpx; }
.info-col { flex: 1; margin-left: 24rpx; }
.info-head { margin-bottom: 12rpx; }
.course-name { font-size: 32rpx; font-weight: 800; color: var(--text); }
.biz-tag { font-size: 22rpx; color: var(--primary); background: rgba(255,77,40,0.08); padding: 4rpx 16rpx; border-radius: 8rpx; margin-left: 12rpx; }
.info-meta { margin-bottom: 12rpx; }
.meta-text { font-size: 24rpx; color: var(--text-sec); }
.capacity { font-size: 26rpx; color: var(--text); font-weight: 700; }
.card-action { margin-top: 24rpx; }
.book-btn { width: 100%; height: 80rpx; line-height: 80rpx; font-size: 28rpx; border-radius: 16rpx; }
.booked-tag { display: block; text-align: center; font-size: 28rpx; color: #2E7D5A; font-weight: 700; padding: 20rpx 0; }
.my-bookings { margin: 40rpx 32rpx 0 32rpx; }
.section-title { font-size: 32rpx; font-weight: 800; color: var(--text); margin-bottom: 24rpx; display: block; }
.booking-row { display: flex; justify-content: space-between; align-items: center; background: var(--card); border-radius: 20rpx; padding: 28rpx; margin-bottom: 16rpx; box-shadow: var(--sp-shadow); }
.booking-left { flex: 1; }
.booking-course { font-size: 28rpx; font-weight: 700; color: var(--text); }
.booking-time { display: block; font-size: 24rpx; color: var(--text-sec); margin-top: 8rpx; }
.booking-right { display: flex; align-items: center; gap: 16rpx; }
.booking-status { font-size: 24rpx; font-weight: 600; }
.booking-status.BOOKED { color: #2E7D5A; }
.booking-status.CANCELLED { color: #999; }
.booking-status.ATTENDED { color: var(--primary); }
.cancel-btn { width: auto; min-width: 80rpx; height: 56rpx; line-height: 56rpx; font-size: 24rpx; border-radius: 10rpx; background: #ff4d4f; color: #fff; }
</style>
