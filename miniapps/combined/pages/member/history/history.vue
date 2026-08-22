<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="back">‹</text>
      <text class="title">消费/出勤记录</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ active: active === 'consumption' }" @click="switchTab('consumption')">课消记录</view>
      <view class="tab-item" :class="{ active: active === 'attendance' }" @click="switchTab('attendance')">出勤记录</view>
    </view>

    <view v-if="active === 'consumption'">
      <view v-if="!consumption || consumption.length === 0" class="empty">暂无课消记录</view>
      <view v-for="c in consumption" :key="c.id" class="record-card">
        <view class="record-top">
          <text class="record-course">{{ c.course_name || '课程' }}</text>
          <text class="record-amount" v-if="c.amount > 0">-￥{{ c.amount }}</text>
          <text class="record-sessions" v-else-if="c.sessions_used">-{{ c.sessions_used }}节</text>
        </view>
        <view class="record-mid">
          <text class="record-info">{{ c.coach_name || '' }} {{ c.date || '' }} {{ c.start_time || '' }}</text>
        </view>
        <view class="record-bottom">
          <text class="record-mode">{{ chargeModeName(c.charge_mode) }}</text>
          <text class="record-date">{{ formatDate(c.created_at) }}</text>
        </view>
      </view>
    </view>

    <view v-if="active === 'attendance'">
      <view v-if="!attendance || attendance.length === 0" class="empty">暂无出勤记录</view>
      <view v-for="a in attendance" :key="a.id" class="record-card">
        <view class="record-top">
          <text class="record-course">{{ a.course_name || '课程' }}</text>
          <text class="record-status" :style="{ color: statusColor(a.status) }">{{ statusName(a.status) }}</text>
        </view>
        <view class="record-mid">
          <text class="record-info">{{ a.coach_name || '' }} {{ a.date || '' }} {{ a.start_time || '' }}</text>
        </view>
        <view class="record-bottom">
          <text class="record-court">{{ a.court_name || '' }}</text>
          <text class="record-date">{{ formatDate(a.created_at) }}</text>
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
.page { min-height: 100vh; background: var(--bg); padding-bottom: 40rpx; }
.header { display: flex; align-items: center; padding: 40rpx; }
.back { font-size: 48rpx; color: var(--text-sec); margin-right: 24rpx; cursor: pointer; }
.title { font-size: 40rpx; font-weight: 800; color: var(--text); }
.tab-bar { display: flex; padding: 0 32rpx; gap: 16rpx; margin-bottom: 24rpx; }
.tab-item { padding: 16rpx 32rpx; border-radius: 12rpx; font-size: 28rpx; color: var(--text-sec); background: var(--card); font-weight: 600; }
.tab-item.active { color: #fff; background: var(--primary); }
.empty { text-align: center; color: var(--text-sec); padding: 80rpx; font-size: 28rpx; }
.record-card { background: var(--card); border-radius: 24rpx; padding: 32rpx; margin: 0 32rpx 24rpx 32rpx; box-shadow: var(--sp-shadow); }
.record-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.record-course { font-size: 30rpx; font-weight: 700; color: var(--text); }
.record-amount { font-size: 32rpx; font-weight: 800; color: var(--primary); }
.record-sessions { font-size: 28rpx; font-weight: 700; color: var(--primary); }
.record-status { font-size: 28rpx; font-weight: 700; }
.record-mid { margin-bottom: 12rpx; }
.record-info { font-size: 24rpx; color: var(--text-sec); }
.record-bottom { display: flex; justify-content: space-between; }
.record-mode { font-size: 24rpx; color: var(--text-sec); }
.record-court { font-size: 24rpx; color: var(--text-sec); }
.record-date { font-size: 24rpx; color: var(--text-sec); }
</style>
