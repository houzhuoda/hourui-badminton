<template>
  <view class="page">
    <view class="tabs">
      <view class="tab" :class="{ active: active === 'consumption' }" @click="active = 'consumption'; loadData()">消费记录</view>
      <view class="tab" :class="{ active: active === 'attendance' }" @click="active = 'attendance'; loadData()">出勤记录</view>
      <view class="tab" :class="{ active: active === 'leave' }" @click="active = 'leave'; loadData()">请假</view>
    </view>

    <view v-if="active === 'consumption'">
      <view v-if="consumption.length === 0" class="empty">暂无消费记录</view>
      <view v-for="c in consumption" :key="c.id" class="record-row">
        <view>
          <text class="record-title">{{ c.course_name }}</text>
          <text class="record-time">{{ c.date }} {{ c.start_time }}</text>
        </view>
        <view class="record-right">
          <text class="record-mode">{{ c.charge_mode }}</text>
          <text class="record-amount" v-if="c.amount > 0">￥{{ c.amount }}</text>
          <text class="record-sessions" v-else-if="c.sessions_used">-1节</text>
        </view>
      </view>
    </view>

    <view v-if="active === 'attendance'">
      <view v-if="attendance.length === 0" class="empty">暂无出勤记录</view>
      <view v-for="a in attendance" :key="a.id" class="record-row">
        <view>
          <text class="record-title">{{ a.course_name }}</text>
          <text class="record-time">{{ a.date }} {{ a.start_time }}</text>
        </view>
        <text class="record-status" :style="{ color: statusColor(a.status) }">{{ statusName(a.status) }}</text>
      </view>
    </view>

    <view v-if="active === 'leave'" class="leave-form">
      <view class="form-item"><text class="label">请假时间</text>
        <picker mode="date" @change="onLeaveDate"><view class="picker">{{ leaveForm.date || '选择日期' }}</view></picker>
      </view>
      <view class="form-item"><text class="label">请假原因</text>
        <textarea class="textarea" v-model="leaveForm.reason" placeholder="请输入原因" />
      </view>
      <button class="submit-btn" @click="submitLeave">提交请假</button>
    </view>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { ATTENDANCE_STATUS } from '../../utils/constants.js';

export default {
  data() { return { active: 'consumption', consumption: [], attendance: [], leaveForm: { date: '', reason: '' } }; },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      try {
        if (this.active === 'consumption') this.consumption = await api.myConsumption();
        else if (this.active === 'attendance') this.attendance = await api.myAttendance();
      } catch (e) {}
    },
    onLeaveDate(e) { this.leaveForm.date = e.detail.value; },
    async submitLeave() {
      if (!this.leaveForm.date) { uni.showToast({ title: '请选择日期', icon: 'none' }); return; }
      try {
        await api.requestLeave(this.leaveForm);
        uni.showToast({ title: '请假已提交', icon: 'success' });
        this.leaveForm = { date: '', reason: '' };
      } catch (e) {}
    },
    statusName(s) { return ATTENDANCE_STATUS[s] || s; },
    statusColor(s) { return { PRESENT: '#52c41a', ABSENT: '#ff4d4f', LEAVE: '#faad14', PENDING_PAY: '#ff7875' }[s] || '#999'; },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.tabs { display: flex; background: #fff; border-radius: 10rpx; margin-bottom: 20rpx; overflow: hidden; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; font-size: 28rpx; color: #666; }
.tab.active { color: #13c2c2; font-weight: bold; border-bottom: 4rpx solid #13c2c2; }
.empty { text-align: center; color: #999; padding: 60rpx; }
.record-row { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.record-title { font-size: 30rpx; font-weight: bold; }
.record-time { display: block; font-size: 24rpx; color: #999; margin-top: 6rpx; }
.record-right { text-align: right; }
.record-mode { font-size: 24rpx; color: #666; display: block; }
.record-amount { font-size: 30rpx; color: #ff4d4f; font-weight: bold; }
.record-sessions { font-size: 30rpx; color: #ff4d4f; }
.record-status { font-size: 28rpx; }
.leave-form { background: #fff; border-radius: 16rpx; padding: 20rpx; }
.form-item { margin-bottom: 24rpx; }
.label { font-size: 28rpx; margin-bottom: 10rpx; display: block; }
.picker { height: 80rpx; line-height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; color: #666; }
.textarea { width: 100%; height: 120rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 20rpx; font-size: 28rpx; }
.submit-btn { background: #13c2c2; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; }
</style>
