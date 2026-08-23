<template>
  <view class="booking-panel">
    <!-- 课程色块按钮，一排3个，按固定顺序排列 -->
    <view class="course-grid">
      <view
        v-for="c in sortedCourses"
        :key="c.id"
        class="course-block"
        :style="{ background: colorFor(c.business_type) }"
        @click="goCourse(c)"
      >
        <text class="block-icon">{{ iconFor(c.business_type) }}</text>
        <text class="block-name">{{ c.name }}</text>
      </view>
    </view>

    <view v-if="courses.length === 0" class="empty">
      <text class="empty-emoji">🏸</text>
      <text class="empty-text">暂无可约课程</text>
    </view>

    <!-- 非私教/陪练：展示一周内可约课次 -->
    <view v-if="activeCourse && !isPrivateType(activeCourse.business_type)" class="sessions-section">
      <view class="course-banner" :style="{ background: colorFor(activeCourse.business_type) }">
        <text class="banner-name">{{ activeCourse.name }}</text>
        <text class="banner-close" @click="activeCourse = null">✕</text>
      </view>

      <scroll-view scroll-x class="date-scroll" :show-scrollbar="false">
        <view class="date-tabs">
          <view
            v-for="d in weekDays"
            :key="d.dateStr"
            class="date-tab"
            :class="{ active: selectedDate === d.dateStr }"
            @click="selectDate(d.dateStr)"
          >
            <text class="dt-wd">{{ d.wd }}</text>
            <text class="dt-day">{{ d.day }}</text>
          </view>
        </view>
      </scroll-view>

      <view v-if="sessionList.length === 0" class="empty">
        <text class="empty-emoji">📅</text>
        <text class="empty-text">该日期暂无可约课次</text>
      </view>

      <view v-for="s in sessionList" :key="s.id" class="session-card" :class="{ disabled: isBooked(s.id) }">
        <view class="time-col">
          <text class="time-text">{{ s.start_time }}</text>
          <text class="time-end">- {{ s.end_time }}</text>
        </view>
        <view class="info-col">
          <text class="course-name" v-if="s.course_name !== activeCourse?.name">{{ s.course_name }}</text>
          <text class="meta-text">🏸 教练 {{ s.coach_name || '待定' }}</text>
          <text class="capacity">可约 {{ s.available_slots }} 位</text>
        </view>
        <view class="card-action">
          <button class="book-btn" @click="bookSession(s)" v-if="!isBooked(s.id)">立即预约</button>
          <text v-else class="booked-tag">已预约</text>
        </view>
      </view>
    </view>

    <!-- 客服微信开卡弹窗 -->
    <view v-if="serviceVisible" class="service-mask" @click="serviceVisible = false">
      <view class="service-sheet" @click.stop>
        <view class="service-handle"></view>
        <text class="service-title">需要开通课包才能约课</text>
        <text class="service-desc">您当前没有该课程的有效次卡或月卡，请添加客服微信开通课包</text>
        <view v-if="serviceWechatQr" class="service-qr-box">
          <image :src="serviceWechatQr" mode="aspectFit" class="service-qr" />
        </view>
        <view v-if="serviceWechat" class="service-wechat-box">
          <text class="service-wechat-label">客服微信：</text>
          <text class="service-wechat-value">{{ serviceWechat }}</text>
          <text class="service-copy" @click="copyWechat">复制</text>
        </view>
        <button class="service-btn" @click="serviceVisible = false">我知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, BOOKING_STATUS } from '../../../utils/constants.js';

const COLOR_MAP = {
  PRIVATE: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
  PRACTICE: 'linear-gradient(135deg, #f0932b, #e67e22)',
  ADULT_GROUP: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
  KID_GROUP: 'linear-gradient(135deg, #00b894, #55efc4)',
  GYM: 'linear-gradient(135deg, #0984e3, #74b9ff)',
  FITNESS: 'linear-gradient(135deg, #e84393, #fd79a8)',
  COMMUNITY: 'linear-gradient(135deg, #2d3436, #636e72)',
};

const ICON_MAP = {
  PRIVATE: '私', PRACTICE: '陪', ADULT_GROUP: '大', KID_GROUP: '童',
  GYM: '健', FITNESS: '体', COMMUNITY: '群',
};

export default {
  data() {
    const today = new Date();
    const wdNames = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      weekDays.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        wd: i === 0 ? '今天' : '周' + wdNames[d.getDay()],
        day: d.getDate(),
      });
    }
    return {
      courses: [],
      bookings: [],
      activeCourse: null,
      selectedDate: weekDays[0].dateStr,
      sessionList: [],
      weekDays,
      serviceVisible: false,
      serviceWechat: '',
      serviceWechatQr: '',
    };
  },
  computed: {
    sortedCourses() {
      const order = ['PRIVATE', 'PRACTICE', 'COMMUNITY', 'ADULT_GROUP', 'KID_GROUP', 'GYM', 'FITNESS'];
      return [...this.courses].sort((a, b) => {
        const ia = order.indexOf(a.business_type);
        const ib = order.indexOf(b.business_type);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    },
  },
  onShow() {
    this.loadCourses();
    this.loadBookings();
  },
  methods: {
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    bookingStatusName(s) { return BOOKING_STATUS[s] || s; },
    colorFor(code) { return COLOR_MAP[code] || 'linear-gradient(135deg, #2d3436, #636e72)'; },
    iconFor(code) { return ICON_MAP[code] || '课'; },
    isPrivateType(code) { return code === 'PRIVATE' || code === 'PRACTICE'; },
    async loadCourses() {
      try { this.courses = await api.courseList(); } catch (e) { this.courses = []; }
    },
    async loadBookings() {
      try { this.bookings = await api.myBookings(); } catch (e) { this.bookings = []; }
    },
    goCourse(c) {
      if (this.isPrivateType(c.business_type)) {
        // 私教/陪练跳转教练选择
        uni.navigateTo({ url: `/pages/member/booking/private?businessType=${c.business_type}` });
      } else {
        // 其他课程展开一周可约课次
        this.activeCourse = c;
        this.selectedDate = this.weekDays[0].dateStr;
        this.loadSessions();
      }
    },
    selectDate(d) {
      this.selectedDate = d;
      this.loadSessions();
    },
    async loadSessions() {
      if (!this.activeCourse) return;
      try {
        const list = await api.availableSessions({ courseId: this.activeCourse.id, date: this.selectedDate });
        this.sessionList = list;
      } catch (e) { this.sessionList = []; }
    },
    isBooked(id) { return this.bookings.some((b) => b.session_id === id && b.status === 'BOOKED'); },
    async bookSession(s) {
      try {
        await api.bookSession({ sessionId: s.id });
        this.loadBookings(); this.loadSessions();
        uni.showToast({ title: '预约成功', icon: 'success' });
      } catch (e) {
        if (e.message === 'NO_PACK' && e.data) {
          this.showServiceWechat(e.data);
        } else {
          uni.showToast({ title: e.message || '预约失败', icon: 'none' });
        }
      }
    },
    showServiceWechat(data) {
      this.serviceWechat = data.serviceWechat || '';
      this.serviceWechatQr = data.serviceWechatQr || '';
      this.serviceVisible = true;
    },
    copyWechat() {
      if (this.serviceWechat) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(this.serviceWechat);
        }
        uni.showToast({ title: '已复制', icon: 'success' });
      }
    },
  },
};
</script>

<style scoped>
.booking-panel { width: 100%; }

/* 课程色块网格 */
.course-grid { display: flex; flex-wrap: wrap; padding: 0 24rpx; gap: 20rpx; }
.course-block {
  width: calc(33.33% - 14rpx);
  height: 180rpx;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: var(--sp-shadow);
  transition: transform 0.15s ease;
}
.course-block:active { transform: scale(0.97); }
.block-icon { font-size: 48rpx; color: #fff; font-weight: 800; }
.block-name { font-size: 24rpx; color: #fff; margin-top: 12rpx; font-weight: 600; }

.empty { text-align: center; padding: 80rpx 0; }
.empty-emoji { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }

/* 课次区域 */
.sessions-section { margin-top: 32rpx; }
.course-banner { display: flex; justify-content: space-between; align-items: center; padding: 28rpx 32rpx; margin: 0 24rpx 24rpx 24rpx; border-radius: 20rpx; box-shadow: var(--sp-shadow); }
.banner-name { font-size: 32rpx; font-weight: 800; color: #fff; }
.banner-close { font-size: 32rpx; color: #fff; transition: transform 0.15s ease; }
.banner-close:active { transform: scale(0.9); }

/* 日期选择 */
.date-scroll { width: 100%; white-space: nowrap; margin-bottom: 24rpx; }
.date-tabs { display: inline-flex; padding: 0 24rpx; gap: 16rpx; }
.date-tab { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 120rpx; padding: 20rpx 0; background: var(--card); border-radius: 20rpx; box-shadow: var(--sp-shadow-sm); transition: transform 0.15s ease; }
.date-tab:active { transform: scale(0.97); }
.date-tab.active { background: var(--grad-orange); box-shadow: var(--sp-shadow-orange); }
.date-tab.active .dt-wd, .date-tab.active .dt-day { color: #fff; }
.dt-wd { font-size: 22rpx; color: var(--text-sec); display: block; }
.dt-day { font-size: 36rpx; font-weight: 800; color: var(--sp-dark); display: block; margin-top: 4rpx; }

/* 课次卡片 */
.session-card { background: var(--card); border-radius: 24rpx; padding: 28rpx; margin: 0 24rpx 20rpx 24rpx; box-shadow: var(--sp-shadow); display: flex; align-items: center; border-left: 8rpx solid var(--sp-orange); transition: transform 0.15s ease; }
.session-card:active { transform: scale(0.97); }
.session-card.disabled { opacity: 0.6; border-left-color: var(--text-sec); }
.time-col { width: 120rpx; flex-shrink: 0; }
.time-text { font-size: 32rpx; font-weight: 800; color: var(--sp-dark); display: block; }
.time-end { font-size: 22rpx; color: var(--text-sec); display: block; margin-top: 6rpx; }
.info-col { flex: 1; margin-left: 20rpx; min-width: 0; }
.course-name { font-size: 28rpx; font-weight: 700; color: var(--sp-dark); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta-text { font-size: 24rpx; color: var(--text-sec); display: block; margin-top: 8rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.capacity { font-size: 24rpx; color: var(--sp-green); font-weight: 600; display: block; margin-top: 8rpx; white-space: nowrap; }
.card-action { margin-left: 16rpx; flex-shrink: 0; }
.book-btn { width: auto; height: 68rpx; line-height: 68rpx; font-size: 26rpx; border-radius: 100rpx; padding: 0 28rpx; white-space: nowrap; background: var(--grad-orange); color: #fff; font-weight: 700; box-shadow: var(--sp-shadow-orange); }
.book-btn:active { transform: scale(0.97); }
.booked-tag { font-size: 24rpx; color: var(--sp-green); font-weight: 700; white-space: nowrap; background: rgba(16,185,129,0.1); padding: 10rpx 20rpx; border-radius: 100rpx; }

/* 客服微信开卡弹窗 */
.service-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.5); z-index: 999; display: flex; align-items: flex-end; }
.service-sheet { width: 100%; background: #fff; border-radius: 32rpx 32rpx 0 0; padding: 24rpx 40rpx 48rpx; display: flex; flex-direction: column; align-items: center; animation: serviceUp 0.25s ease; }
@keyframes serviceUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.service-handle { width: 64rpx; height: 8rpx; background: #E5E7EB; border-radius: 100rpx; margin-bottom: 28rpx; }
.service-title { font-size: 36rpx; font-weight: 800; color: var(--sp-dark); margin-bottom: 16rpx; }
.service-desc { font-size: 28rpx; color: var(--text-sec); text-align: center; line-height: 1.6; margin-bottom: 32rpx; }
.service-qr-box { margin-bottom: 24rpx; }
.service-qr { width: 360rpx; height: 360rpx; border-radius: 16rpx; }
.service-wechat-box { display: flex; align-items: center; background: var(--sp-bg); border-radius: 16rpx; padding: 20rpx 28rpx; margin-bottom: 32rpx; }
.service-wechat-label { font-size: 28rpx; color: var(--text-sec); }
.service-wechat-value { font-size: 32rpx; font-weight: 700; color: var(--sp-dark); margin: 0 16rpx; }
.service-copy { font-size: 26rpx; color: var(--sp-orange); font-weight: 600; padding: 8rpx 20rpx; background: var(--sp-bg-warm); border-radius: 100rpx; }
.service-btn { width: 100%; height: 88rpx; line-height: 88rpx; border-radius: 24rpx; background: var(--grad-orange); color: #fff; font-size: 32rpx; font-weight: 700; box-shadow: var(--sp-shadow-orange); }
.service-btn:active { transform: scale(0.97); }
</style>
