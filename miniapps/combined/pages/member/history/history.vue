<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">消费/出勤记录</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ active: active === 'consumption' }" @click="switchTab('consumption')">💸 课消记录</view>
      <view class="tab-item" :class="{ active: active === 'attendance' }" @click="switchTab('attendance')">✅ 出勤记录</view>
    </view>

    <view v-if="active === 'consumption'">
      <view v-if="!consumption || consumption.length === 0" class="empty">
        <text class="empty-emoji">💸</text>
        <text class="empty-text">暂无课消记录</text>
      </view>
      <view v-for="c in consumption" :key="c.id" class="timeline-item">
        <view class="timeline-dot"></view>
        <view class="timeline-line"></view>
        <view class="record-card">
          <view class="record-top">
            <text class="record-course">{{ c.course_name || '课程' }}</text>
            <text class="record-amount" v-if="c.amount > 0">-￥{{ c.amount }}</text>
            <text class="record-sessions" v-else-if="c.sessions_used">-{{ c.sessions_used }}节</text>
          </view>
          <view class="record-mid">
            <text class="record-info">🏸 {{ c.coach_name || '' }} {{ c.date || '' }} {{ c.start_time || '' }}</text>
          </view>
          <view class="record-bottom">
            <text class="record-mode">{{ chargeModeName(c.charge_mode) }}</text>
            <text class="record-date">{{ formatDate(c.created_at) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="active === 'attendance'">
      <view v-if="!attendance || attendance.length === 0" class="empty">
        <text class="empty-emoji">✅</text>
        <text class="empty-text">暂无出勤记录</text>
      </view>
      <view v-for="a in attendance" :key="a.id" class="timeline-item">
        <view class="timeline-dot" :class="a.status"></view>
        <view class="timeline-line"></view>
        <view class="record-card">
          <view class="record-top">
            <text class="record-course">{{ a.course_name || '课程' }}</text>
            <text class="record-status" :style="{ color: statusColor(a.status) }">{{ statusName(a.status) }}</text>
          </view>
          <view class="record-mid">
            <text class="record-info">🏸 {{ a.coach_name || '' }} {{ a.date || '' }} {{ a.start_time || '' }}</text>
          </view>
          <view class="record-bottom">
            <text class="record-court">📍 {{ a.court_name || '' }}</text>
            <text class="record-date">{{ formatDate(a.created_at) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { ATTENDANCE_STATUS_MAP, CHARGE_MODES } from '../../../utils/constants.js';

export default {
  data() { return { active: 'consumption', consumption: [], attendance: [] }; },
  onShow() { this.loadData(); },
  methods: {
    back() { uni.navigateBack(); },
    switchTab(t) { this.active = t; this.loadData(); },
    chargeModeName(code) { const m = CHARGE_MODES.find((x) => x.code === code); return m ? m.name : code || ''; },
    statusName(s) { return ATTENDANCE_STATUS_MAP[s] || s; },
    statusColor(s) { return { PRESENT: '#2E7D5A', ABSENT: '#ff4d4f', LEAVE: '#FF7A2F', PENDING_PAY: '#ff7875' }[s] || '#999'; },
    formatDate(d) { if (!d) return ''; return d.slice(0, 10); },
    async loadData() {
      try {
        if (this.active === 'consumption') {
          const d = await api.myConsumption();
          this.consumption = (d && d.consumptions) || [];
        } else if (this.active === 'attendance') {
          this.attendance = await api.myAttendance();
        }
      } catch (e) {}
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--sp-bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 32rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; transition: transform 0.15s ease; }
.back:active { transform: scale(0.9); }
.title { font-size: 40rpx; font-weight: 800; color: var(--sp-dark); }
.tab-bar { display: flex; padding: 0 32rpx; gap: 16rpx; margin-bottom: 24rpx; }
.tab-item { padding: 18rpx 36rpx; border-radius: 100rpx; font-size: 28rpx; color: var(--text-sec); background: var(--card); font-weight: 600; box-shadow: var(--sp-shadow-sm); transition: transform 0.15s ease; }
.tab-item:active { transform: scale(0.97); }
.tab-item.active { color: #fff; background: var(--grad-orange); box-shadow: var(--sp-shadow-orange); }
.empty { text-align: center; padding: 80rpx 0; }
.empty-emoji { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }
.timeline-item { display: flex; padding: 0 32rpx 24rpx 32rpx; position: relative; }
.timeline-dot { width: 24rpx; height: 24rpx; border-radius: 50%; background: var(--sp-orange); flex-shrink: 0; margin-top: 28rpx; margin-right: 24rpx; box-shadow: 0 0 0 8rpx rgba(255,77,40,0.15); z-index: 1; }
.timeline-dot.PRESENT { background: var(--sp-green); box-shadow: 0 0 0 8rpx rgba(16,185,129,0.15); }
.timeline-dot.ABSENT { background: var(--sp-red); box-shadow: 0 0 0 8rpx rgba(239,68,68,0.15); }
.timeline-dot.LEAVE { background: var(--sp-amber); box-shadow: 0 0 0 8rpx rgba(245,158,11,0.15); }
.timeline-dot.PENDING_PAY { background: var(--sp-red); box-shadow: 0 0 0 8rpx rgba(239,68,68,0.15); }
.timeline-line { position: absolute; left: 43rpx; top: 52rpx; bottom: 0; width: 4rpx; background: var(--border); }
.timeline-item:last-child .timeline-line { display: none; }
.record-card { flex: 1; background: var(--card); border-radius: 24rpx; padding: 28rpx; box-shadow: var(--sp-shadow); }
.record-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.record-course { font-size: 30rpx; font-weight: 700; color: var(--sp-dark); }
.record-amount { font-size: 34rpx; font-weight: 800; color: var(--sp-orange); }
.record-sessions { font-size: 30rpx; font-weight: 700; color: var(--sp-orange); }
.record-status { font-size: 26rpx; font-weight: 700; padding: 8rpx 20rpx; border-radius: 100rpx; background: rgba(15,23,42,0.05); }
.record-mid { margin-bottom: 12rpx; }
.record-info { font-size: 24rpx; color: var(--text-sec); }
.record-bottom { display: flex; justify-content: space-between; }
.record-mode { font-size: 24rpx; color: var(--text-sec); }
.record-court { font-size: 24rpx; color: var(--text-sec); }
.record-date { font-size: 24rpx; color: var(--text-sec); }
</style>
