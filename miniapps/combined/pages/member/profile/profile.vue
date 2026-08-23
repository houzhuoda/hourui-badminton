<template>
  <view class="profile-panel">
    <!-- 菜单列表（保留原有样式，点击展开内容） -->
    <view class="menu-section">
      <view v-if="staffRole === 'coach'" class="identity-item" @click="goStaff('coach')">
        <text class="menu-icon">🏸</text>
        <text class="menu-label">身份切换</text>
        <text class="identity-action coach">去教练端 ›</text>
      </view>
      <view v-else-if="staffRole === 'sales'" class="identity-item" @click="goStaff('sales')">
        <text class="menu-icon">💼</text>
        <text class="menu-label">身份切换</text>
        <text class="identity-action sales">去销售端 ›</text>
      </view>
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="menu-title">会员功能</text>
      </view>

      <!-- 我的课包 -->
      <view class="menu-item" @click="toggleSection('packs')">
        <text class="menu-icon">🏸</text>
        <text class="menu-label">我的课包</text>
        <text class="arrow" :class="{ open: openSection === 'packs' }">›</text>
      </view>
      <view v-if="openSection === 'packs'" class="section-content">
        <view v-if="!assets.packs || assets.packs.length === 0" class="empty">
          <text class="empty-emoji">🏸</text>
          <text class="empty-text">暂无课包</text>
        </view>
        <view v-for="p in (assets.packs || [])" :key="p.id" class="pack-wrap">
          <view class="pack-card" @click="togglePack(p.id)">
            <view class="pack-accent"></view>
            <view class="pack-body">
              <view class="pack-main">
                <view class="pack-left">
                  <text class="pack-name">{{ p.course_name }}</text>
                  <text class="pack-type">{{ p.pack_type === 'SESSION_PACK' ? '次卡' : p.pack_type === 'MONTHLY' ? '月卡' : p.pack_type }}</text>
                </view>
                <view class="pack-remain">
                  <text v-if="p.pack_type === 'SESSION_PACK'" class="remain-num">{{ p.remaining_sessions }}<text class="remain-total">/{{ p.total_sessions }}节</text></text>
                  <text v-else class="remain-num">{{ p.monthly_remaining }}<text class="remain-total">/{{ p.monthly_quota }}次</text></text>
                </view>
              </view>
              <view class="pack-bottom">
                <text class="pack-valid">📅 有效期至 {{ p.valid_until }}</text>
                <text class="pack-expand" :class="{ open: expandedPack === p.id }">消课记录 ›</text>
              </view>
            </view>
          </view>
          <!-- 课包对应的消课记录 -->
          <view v-if="expandedPack === p.id" class="pack-consumptions">
            <view v-if="packConsumptions(p.id).length === 0" class="empty small">
              <text class="empty-text">暂无消课记录</text>
            </view>
            <view v-for="c in packConsumptions(p.id)" :key="c.id" class="consum-card">
              <view class="consum-accent"></view>
              <view class="consum-body">
                <view class="consum-top">
                  <text class="consum-course">{{ c.course_name || '课程' }}</text>
                  <text class="consum-sessions" v-if="c.sessions_used">-{{ c.sessions_used }}节</text>
                </view>
                <view class="consum-mid">
                  <text class="consum-info">🏸 {{ c.coach_name || '' }} {{ c.date || '' }} {{ c.start_time || '' }}</text>
                </view>
                <view class="consum-bottom">
                  <text class="consum-mode">{{ chargeModeName(c.charge_mode) }}</text>
                  <text class="consum-date">{{ formatDate(c.created_at) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 我的消费明细 -->
      <view class="menu-item" @click="toggleSection('consumption')">
        <text class="menu-icon">💸</text>
        <text class="menu-label">我的消费明细</text>
        <text class="arrow" :class="{ open: openSection === 'consumption' }">›</text>
      </view>
      <view v-if="openSection === 'consumption'" class="section-content">
        <view v-if="!orders || orders.length === 0" class="empty">
          <text class="empty-emoji">📋</text>
          <text class="empty-text">暂无购卡记录</text>
        </view>
        <view v-for="o in orders" :key="o.id" class="consum-card">
          <view class="consum-accent" :class="o.status"></view>
          <view class="consum-body">
            <view class="consum-top">
              <text class="consum-course">{{ o.course_name || bizName(o.business_type) }}</text>
              <text class="consum-amount">￥{{ o.amount }}</text>
            </view>
            <view class="consum-mid">
              <text class="consum-info">{{ bizName(o.business_type) }} · {{ chargeModeName(o.charge_mode) }}</text>
            </view>
            <view class="consum-bottom">
              <text class="consum-mode">{{ orderStatusName(o.status) }}</text>
              <text class="consum-date">{{ formatDate(o.created_at) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 我的预约明细 -->
      <view class="menu-item" @click="toggleSection('bookings')">
        <text class="menu-icon">📅</text>
        <text class="menu-label">我的预约明细</text>
        <text class="arrow" :class="{ open: openSection === 'bookings' }">›</text>
      </view>
      <view v-if="openSection === 'bookings'" class="section-content">
        <view v-if="bkFilteredList.length === 0" class="empty">
          <text class="empty-emoji">📅</text>
          <text class="empty-text">暂无预约记录</text>
        </view>
        <view v-for="item in bkFilteredList" :key="item.id" class="bk-card">
          <view class="bk-accent" :class="item.status"></view>
          <view class="bk-body">
            <view class="bk-top">
              <text class="bk-course">{{ item.courseName || item.course_name || bizName(item.business_type) }}</text>
              <text class="bk-status" :class="item.status">{{ bkStatusName(item.status) }}</text>
            </view>
            <view class="bk-mid">
              <text class="bk-info">🏸 {{ item.coachName || item.coach_name || '待定' }}</text>
              <text class="bk-type">{{ bkTypeLabel(item) }}</text>
            </view>
            <view class="bk-bottom">
              <text class="bk-date">📅 {{ item.date }} {{ item.start_time }}-{{ item.end_time }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <button class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, CHARGE_MODES } from '../../../utils/constants.js';

export default {
  data() {
    return {
      user: null,
      staffRole: '',
      openSection: 'packs',
      expandedPack: '',
      assets: {},
      orders: [],
      consumptions: [],
      groupBookings: [],
      privateBookings: [],
    };
  },
  computed: {
    bkFilteredList() {
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
  onShow() {
    this.user = JSON.parse(uni.getStorageSync('user') || '{}');
    this.loadStaffRole();
    this.loadAssets();
    this.loadConsumption();
    this.loadBookings();
  },
  methods: {
    toggleSection(section) {
      this.openSection = this.openSection === section ? '' : section;
    },
    togglePack(packId) {
      this.expandedPack = this.expandedPack === packId ? '' : packId;
    },
    packConsumptions(packId) {
      return (this.consumptions || []).filter((c) => c.pack_id === packId);
    },
    bizName(code) { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; },
    chargeModeName(code) { const m = CHARGE_MODES.find((x) => x.code === code); return m ? m.name : code || ''; },
    orderStatusName(s) { return { PAID: '已支付', PENDING: '待支付', REFUNDED: '已退款', CANCELLED: '已取消', DELETED: '已删除' }[s] || s; },
    bkStatusName(s) { return { BOOKED: '已预约', CANCELLED: '取消预约', ATTENDED: '成功上课', COMPLETED: '已完成', NOSHOW: '违约扣款', PENDING_PAY: '待补费', LEAVE: '请假' }[s] || s; },
    bkTypeLabel(item) { return item._type === 'private' ? (item.business_type === 'PRIVATE' ? '私教' : '陪练') : '大课'; },
    formatDate(d) { if (!d) return ''; return d.slice(0, 10); },
    async loadStaffRole() {
      try {
        const d = await api.switchableRoles();
        const roles = d.roles || [];
        if (roles.some((r) => r.role === 'coach')) this.staffRole = 'coach';
        else if (roles.some((r) => r.role === 'sales')) this.staffRole = 'sales';
        else this.staffRole = '';
      } catch (e) { this.staffRole = ''; }
    },
    async loadAssets() {
      try { this.assets = await api.myAssets(); } catch (e) {}
    },
    async loadConsumption() {
      try {
        const d = await api.myConsumption();
        this.orders = (d && d.orders) || [];
        this.consumptions = (d && d.consumptions) || [];
      } catch (e) {}
    },
    async loadBookings() {
      try {
        const [groupList, privateList] = await Promise.all([
          api.myBookings(),
          api.myPrivateBookings(),
        ]);
        this.groupBookings = groupList || [];
        this.privateBookings = privateList || [];
      } catch (e) {}
    },
    async goStaff(role) {
      try {
        // 保留会员身份，返回会员端时无需重新登录
        uni.setStorageSync('memberToken', uni.getStorageSync('token'));
        uni.setStorageSync('memberUser', uni.getStorageSync('user'));
        const d = await api.switchIdentity(role);
        uni.setStorageSync('token', d.token);
        uni.setStorageSync('user', JSON.stringify(d.user));
        uni.setStorageSync('role', role);
        const app = getApp();
        if (app && app.globalData) { app.globalData.token = d.token; app.globalData.user = d.user; app.globalData.role = role; }
        const home = { sales: '/pages/sales/dashboard/dashboard', coach: '/pages/coach/schedule/schedule' }[role];
        uni.showToast({ title: '已切换为' + (role === 'sales' ? '销售' : '教练'), icon: 'success' });
        setTimeout(() => uni.reLaunch({ url: home }), 600);
      } catch (e) {
        uni.showToast({ title: '切换失败，请重试', icon: 'none' });
      }
    },
    logout() {
      uni.removeStorageSync('token'); uni.removeStorageSync('user'); uni.removeStorageSync('role');
      const app = getApp();
      if (app && app.globalData) { app.globalData.token = ''; app.globalData.user = null; app.globalData.role = ''; }
      uni.reLaunch({ url: '/pages/member/login/login' });
    },
  },
};

// 合并连续时段的私教/陪练预约（同教练、同日期、同业务类型、同状态、时段首尾相连）
function mergeConsecutivePrivate(list) {
  if (!list || list.length === 0) return [];
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
.profile-panel { width: 100%; padding: 0 0 40rpx 0; }

/* 身份切换（保留功能，不再显示重复用户卡片） */
.identity-item { display: flex; align-items: center; padding: 28rpx 32rpx; border-bottom: 1rpx solid var(--border); transition: transform 0.15s ease; }
.identity-item:active { transform: scale(0.97); }
.identity-action { font-size: 26rpx; font-weight: 700; padding: 12rpx 20rpx; border-radius: 100rpx; }
.identity-action.coach { color: #722ed1; background: rgba(114,46,209,0.1); }
.identity-action.sales { color: var(--sp-orange); background: rgba(255,77,40,0.1); }

/* 菜单列表（保留原有样式） */
.menu-section { background: var(--card); border-radius: 28rpx; margin-bottom: 24rpx; overflow: hidden; box-shadow: var(--sp-shadow); padding: 8rpx 0; }
.section-header { display: flex; align-items: center; padding: 24rpx 32rpx 16rpx 32rpx; }
.section-bar { width: 8rpx; height: 32rpx; background: var(--sp-orange); border-radius: 4rpx; margin-right: 16rpx; }
.menu-title { font-size: 28rpx; font-weight: 800; color: var(--sp-dark); }
.menu-item { display: flex; align-items: center; padding: 28rpx 32rpx; border-bottom: 1rpx solid var(--border); transition: transform 0.15s ease; }
.menu-item:active { transform: scale(0.97); }
.menu-item:last-child { border-bottom: none; }
.menu-icon { font-size: 40rpx; margin-right: 24rpx; }
.menu-label { flex: 1; font-size: 30rpx; color: var(--sp-dark); font-weight: 600; }
.arrow { font-size: 36rpx; color: var(--text-sec); transition: transform 0.2s ease; }
.arrow.open { transform: rotate(90deg); }

/* 展开内容区 */
.section-content { padding: 16rpx 24rpx 24rpx 24rpx; background: var(--sp-bg); }

.empty { text-align: center; padding: 60rpx 0; }
.empty.small { padding: 32rpx 0; }
.empty-emoji { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.empty-text { color: var(--text-sec); font-size: 28rpx; }

/* 课包卡片 */
.pack-card { display: flex; border-radius: 24rpx; margin-bottom: 16rpx; background: var(--card); overflow: hidden; box-shadow: var(--sp-shadow-sm); }
.pack-accent { width: 8rpx; background: var(--sp-orange); flex-shrink: 0; }
.pack-body { flex: 1; padding: 24rpx; }
.pack-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.pack-left { flex: 1; min-width: 0; }
.pack-name { font-size: 30rpx; font-weight: 700; color: var(--sp-dark); display: block; }
.pack-type { display: inline-block; font-size: 22rpx; color: var(--sp-orange); background: rgba(255,77,40,0.1); padding: 6rpx 18rpx; border-radius: 100rpx; margin-top: 10rpx; font-weight: 600; }
.pack-remain { font-size: 26rpx; color: var(--sp-dark); font-weight: 700; white-space: nowrap; margin-left: 20rpx; }
.remain-num { font-size: 36rpx; font-weight: 800; color: var(--sp-orange); }
.remain-total { font-size: 22rpx; color: var(--text-sec); font-weight: 600; }
.pack-bottom { margin-top: 8rpx; display: flex; justify-content: space-between; align-items: center; }
.pack-valid { font-size: 24rpx; color: var(--text-sec); }
.pack-expand { font-size: 24rpx; color: var(--sp-orange); font-weight: 600; transition: transform 0.2s ease; }
.pack-expand.open { transform: rotate(90deg); }
.pack-wrap { margin-bottom: 16rpx; }
.pack-consumptions { padding: 8rpx 0 0 0; }

/* 消费明细卡片 */
.consum-card { display: flex; border-radius: 24rpx; margin-bottom: 16rpx; background: var(--card); overflow: hidden; box-shadow: var(--sp-shadow-sm); }
.consum-accent { width: 8rpx; background: var(--sp-cyan); flex-shrink: 0; }
.consum-accent.PAID { background: var(--sp-green); }
.consum-accent.PENDING { background: var(--sp-amber); }
.consum-accent.REFUNDED { background: var(--text-sec); }
.consum-accent.CANCELLED { background: var(--text-sec); }
.consum-body { flex: 1; padding: 24rpx; }
.consum-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.consum-course { font-size: 30rpx; font-weight: 700; color: var(--sp-dark); }
.consum-amount { font-size: 34rpx; font-weight: 800; color: var(--sp-orange); }
.consum-sessions { font-size: 30rpx; font-weight: 700; color: var(--sp-orange); }
.consum-mid { margin-bottom: 8rpx; }
.consum-info { font-size: 24rpx; color: var(--text-sec); }
.consum-bottom { display: flex; justify-content: space-between; }
.consum-mode { font-size: 24rpx; color: var(--text-sec); }
.consum-date { font-size: 24rpx; color: var(--text-sec); }

.bk-card { display: flex; margin-bottom: 16rpx; background: var(--card); border-radius: 24rpx; overflow: hidden; box-shadow: var(--sp-shadow-sm); }
.bk-accent { width: 8rpx; flex-shrink: 0; }
.bk-accent.BOOKED { background: var(--sp-green); }
.bk-accent.CANCELLED { background: var(--text-sec); }
.bk-accent.ATTENDED { background: var(--sp-orange); }
.bk-accent.COMPLETED { background: var(--sp-orange); }
.bk-accent.NOSHOW { background: var(--sp-red); }
.bk-accent.LEAVE { background: var(--sp-amber); }
.bk-accent.PENDING_PAY { background: var(--sp-red); }
.bk-body { flex: 1; padding: 24rpx; }
.bk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.bk-course { font-size: 30rpx; font-weight: 700; color: var(--sp-dark); }
.bk-status { font-size: 24rpx; font-weight: 700; padding: 6rpx 18rpx; border-radius: 100rpx; }
.bk-status.BOOKED { color: var(--sp-green); background: rgba(16,185,129,0.1); }
.bk-status.CANCELLED { color: var(--text-sec); background: rgba(15,23,42,0.05); }
.bk-status.ATTENDED { color: var(--sp-orange); background: rgba(255,77,40,0.1); }
.bk-status.NOSHOW { color: var(--sp-red); background: rgba(239,68,68,0.1); }
.bk-status.LEAVE { color: var(--sp-amber); background: rgba(245,158,11,0.1); }
.bk-status.PENDING_PAY { color: var(--sp-red); background: rgba(239,68,68,0.1); }
.bk-mid { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.bk-info { font-size: 26rpx; color: var(--text-sec); }
.bk-type { font-size: 24rpx; color: var(--sp-orange); font-weight: 600; padding: 4rpx 16rpx; background: var(--sp-bg-warm); border-radius: 100rpx; }
.bk-bottom { display: flex; justify-content: space-between; align-items: center; }
.bk-date { font-size: 24rpx; color: var(--text-sec); }

.logout-btn { margin-top: 16rpx; background: var(--card); color: var(--sp-red); border: 2rpx solid rgba(239,68,68,0.2); border-radius: 28rpx; font-size: 30rpx; font-weight: 700; height: 88rpx; line-height: 88rpx; box-shadow: var(--sp-shadow-sm); }
.logout-btn:active { transform: scale(0.97); }
</style>
