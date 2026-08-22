<template>
  <view class="page">
    <view class="session-info" v-if="session">
      <text class="course-name">{{ session.course_name }}</text>
      <text class="time">{{ session.date }} {{ session.start_time }} - {{ session.end_time }}</text>
      <text class="capacity">已约 {{ session.booked_count }}/{{ session.capacity }} 人</text>
    </view>

    <view class="section">
      <text class="section-title">出勤登记</text>
      <view v-if="participants.length === 0" class="empty">暂无学员</view>
      <view v-for="p in participants" :key="p.member_id" class="participant-row">
        <view class="participant-info">
          <text class="participant-name">{{ p.member_name }}</text>
          <text class="participant-status" :style="{ color: statusColor(p.status) }">{{ statusName(p.status) || '未登记' }}</text>
        </view>
        <view class="action-btns" v-if="!p.status || p.status === 'PENDING_PAY'">
          <button size="mini" class="btn-present" @click="markAttendance(p.member_id, 'PRESENT')">出勤</button>
          <button size="mini" class="btn-leave" @click="markAttendance(p.member_id, 'LEAVE')">请假</button>
          <button size="mini" class="btn-absent" @click="markAttendance(p.member_id, 'ABSENT')">缺勤</button>
        </view>
        <view class="action-btns" v-else>
          <button size="mini" @click="changeStatus(p)">修改</button>
        </view>
      </view>
    </view>

    <button class="submit-btn" v-if="hasUnregistered" @click="submitAll" :loading="loading">批量提交出勤</button>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { ATTENDANCE_STATUS } from '../../utils/constants.js';

export default {
  data() { return { sessionId: '', session: null, participants: [], loading: false }; },
  computed: {
    hasUnregistered() { return this.participants.some((p) => !p.status); },
  },
  onLoad(options) { this.sessionId = options.id; },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      try {
        this.session = await api.sessionDetail(this.sessionId);
        const att = await api.sessionAttendance(this.sessionId);
        // 合并参与者与出勤记录
        const attMap = {};
        (att || []).forEach((a) => { attMap[a.member_id] = a; });
        this.participants = (this.session.participants || []).map((p) => ({
          member_id: p.member_id || p.id,
          member_name: p.member_name || p.name,
          status: attMap[p.member_id || p.id]?.status,
        }));
      } catch (e) {}
    },
    async markAttendance(memberId, status) {
      this.loading = true;
      try {
        await api.submitAttendance(this.sessionId, { attendance: [{ memberId, status }] });
        uni.showToast({ title: '已登记', icon: 'success' });
        this.loadData();
      } catch (e) {}
      this.loading = false;
    },
    async submitAll() {
      const unregistered = this.participants.filter((p) => !p.status);
      if (unregistered.length === 0) return;
      this.loading = true;
      try {
        await api.submitAttendance(this.sessionId, {
          attendance: unregistered.map((p) => ({ memberId: p.member_id, status: 'PRESENT' })),
        });
        uni.showToast({ title: '批量出勤成功', icon: 'success' });
        this.loadData();
      } catch (e) {}
      this.loading = false;
    },
    changeStatus(p) {
      uni.showActionSheet({
        itemList: ['出勤', '请假', '缺勤'],
        success: (res) => {
          const statuses = ['PRESENT', 'LEAVE', 'ABSENT'];
          api.updateAttendance(this.sessionId, p.member_id, { status: statuses[res.tapIndex], reason: '教练修改' })
            .then(() => { uni.showToast({ title: '已修改', icon: 'success' }); this.loadData(); })
            .catch(() => {});
        },
      });
    },
    statusName(s) { return ATTENDANCE_STATUS.find((a) => a.code === s)?.name; },
    statusColor(s) { return ATTENDANCE_STATUS.find((a) => a.code === s)?.color || '#999'; },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.session-info { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 20rpx; }
.course-name { font-size: 34rpx; font-weight: bold; }
.time { display: block; font-size: 26rpx; color: #666; margin-top: 10rpx; }
.capacity { display: block; font-size: 24rpx; color: #999; margin-top: 6rpx; }
.section { background: #fff; border-radius: 16rpx; padding: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.empty { text-align: center; color: #999; padding: 30rpx; }
.participant-row { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.participant-info { flex: 1; }
.participant-name { font-size: 30rpx; }
.participant-status { display: block; font-size: 24rpx; margin-top: 6rpx; }
.action-btns { display: flex; gap: 10rpx; }
.btn-present { background: #52c41a !important; color: #fff !important; }
.btn-leave { background: #faad14 !important; color: #fff !important; }
.btn-absent { background: #ff4d4f !important; color: #fff !important; }
.submit-btn { background: #722ed1; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 20rpx; }
</style>
