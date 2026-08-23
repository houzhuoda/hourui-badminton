<template>
  <view class="bookings-panel">
    <view v-if="filteredList.length === 0" class="empty">
      <text class="empty-emoji">📅</text>
      <text class="empty-text">暂无预约记录</text>
    </view>

    <view v-for="item in filteredList" :key="item.id" class="booking-card">
      <view class="card-accent" :class="item.status"></view>
      <view class="card-body">
        <view class="card-top">
          <text class="card-course">{{ item.courseName || item.course_name || bizName(item.business_type) }}</text>
          <text class="card-status" :class="item.status">{{ statusName(item.status) }}</text>
        </view>
        <view class="card-mid">
          <text class="card-info">🏸 {{ item.coachName || item.coach_name || '待定' }}</text>
          <text class="card-type">{{ typeLabel(item) }}</text>
        </view>
        <view class="card-bottom">
          <text class="card-date">📅 {{ item.date }} {{ item.start_time }}-{{ item.end_time }}</text>
          <view v-if="item.status === 'BOOKED' && canCancel(item)" class="cancel-btn" @click="cancelBooking(item)">取消</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES } from '../../../utils/constants.js';

export default {
  data() { return { groupBookings: [], privateBookings: [] }; },
  onShow() { this.loadData(); },
  computed: {
    filteredList() {
      // 合并连续时段的私教/陪练预约
      const mergedPrivate = mergeConsecutivePrivate(this.privateBookings);
      const all = [
        ...this.groupBookings.map((b) => ({ ...b, _type: 'group' })),
        ...mergedPrivate.map((b) => ({ ...b, _type: 'private', date: b.date, start_time: b.start_time, end_time: b.end_time, courseName: b.business_type === 'PRIVATE' ? '私教课' : '陪练课', coachName: b.coach_name })),
      ];
      all.sort((a, b) => {
        const da = (a.date || '') + (a.start_time || '');
        const db = (b.date || '') + (b.start_time || '');
        return db.localeCompare(da);
      });
      return all;
    },
  },
  methods: {
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    statusName(s) { return { BOOKED: '已预约', CANCELLED: '取消预约', ATTENDED: '成功上课', COMPLETED: '已完成', NOSHOW: '违约扣款', PENDING_PAY: '待补费', LEAVE: '请假' }[s] || s; },
    typeLabel(item) { return item._type === 'private' ? (item.business_type === 'PRIVATE' ? '私教' : '陪练') : '大课'; },
    canCancel(item) {
      if (!item.date || !item.start_time) return false;
      const sessionTime = new Date(item.date + 'T' + item.start_time + ':00');
      const hoursLeft = (sessionTime - new Date()) / 3600000;
      return hoursLeft > 2;
    },
    async loadData() {
      try {
        const [groupList, privateList] = await Promise.all([
          api.myBookings(),
          api.myPrivateBookings(),
        ]);
        this.groupBookings = groupList || [];
        this.privateBookings = privateList || [];
      } catch (e) {}
    },
    async cancelBooking(item) {
      uni.showModal({
        title: '确认取消',
        content: `确定取消 ${item.courseName || item.course_name} 的预约吗？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              // 合并卡片的取消：逐个取消所有子预约
              const ids = item._ids || [item.id];
              for (const id of ids) {
                if (item._type === 'private') {
                  await api.cancelPrivateBooking(id);
                } else {
                  await api.cancelBooking(id);
                }
              }
              uni.showToast({ title: '已取消', icon: 'success' });
              this.loadData();
            } catch (e) { uni.showToast({ title: e.message || '取消失败', icon: 'none' }); }
          }
        },
      });
    },
  },
};

// 合并连续时段的私教/陪练预约（同教练、同日期、同业务类型、同状态、时段首尾相连）
function mergeConsecutivePrivate(list) {
  if (!list || list.length === 0) return [];
  // 按 coach_id + date + business_type + status 分组，再按 start_time 排序
  const groups = {};
  for (const b of list) {
    const key = `${b.coach_id}|${b.date}|${b.business_type}|${b.status}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  }
  const result = [];
  for (const key in groups) {
    const arr = groups[key].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    let current = null;
    for (const b of arr) {
      if (current && current.end_time === b.start_time) {
        // 连续，合并
        current.end_time = b.end_time;
        current._ids.push(b.id);
      } else {
        if (current) result.push(current);
        current = { ...b, _ids: [b.id] };
      }
    }
    if (current) result.push(current);
  }
  return result;
}
</script>

<style scoped>
.bookings-panel { width: 100%; }

.empty { text-align: center; padding: 80rpx 0; }
.empty-emoji { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }

.booking-card { display: flex; margin: 0 24rpx 20rpx; background: var(--card); border-radius: 24rpx; overflow: hidden; box-shadow: var(--sp-shadow); }
.card-accent { width: 8rpx; flex-shrink: 0; }
.card-accent.BOOKED { background: var(--sp-green); }
.card-accent.CANCELLED { background: var(--text-sec); }
.card-accent.ATTENDED { background: var(--sp-orange); }
.card-accent.COMPLETED { background: var(--sp-orange); }
.card-accent.NOSHOW { background: var(--sp-red); }
.card-accent.LEAVE { background: var(--sp-amber); }
.card-accent.PENDING_PAY { background: var(--sp-red); }
.card-body { flex: 1; padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.card-course { font-size: 30rpx; font-weight: 700; color: var(--sp-dark); }
.card-status { font-size: 24rpx; font-weight: 700; padding: 6rpx 18rpx; border-radius: 100rpx; }
.card-status.BOOKED { color: var(--sp-green); background: rgba(16,185,129,0.1); }
.card-status.CANCELLED { color: var(--text-sec); background: rgba(15,23,42,0.05); }
.card-status.ATTENDED { color: var(--sp-orange); background: rgba(255,77,40,0.1); }
.card-status.NOSHOW { color: var(--sp-red); background: rgba(239,68,68,0.1); }
.card-status.LEAVE { color: var(--sp-amber); background: rgba(245,158,11,0.1); }
.card-status.PENDING_PAY { color: var(--sp-red); background: rgba(239,68,68,0.1); }
.card-mid { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.card-info { font-size: 26rpx; color: var(--text-sec); }
.card-type { font-size: 24rpx; color: var(--sp-orange); font-weight: 600; padding: 4rpx 16rpx; background: var(--sp-bg-warm); border-radius: 100rpx; }
.card-bottom { display: flex; justify-content: space-between; align-items: center; }
.card-date { font-size: 24rpx; color: var(--text-sec); }
.cancel-btn { font-size: 24rpx; color: var(--sp-red); font-weight: 600; padding: 8rpx 24rpx; background: rgba(239,68,68,0.1); border-radius: 100rpx; }
.cancel-btn:active { transform: scale(0.97); }
</style>
