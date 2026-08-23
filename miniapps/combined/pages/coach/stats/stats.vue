<template>
  <view class="stat-page">
    <view class="stat-hero">
      <view class="stat-hero-top">
        <text class="stat-hero-emoji">📊</text>
        <text class="stat-hero-title">数据统计</text>
      </view>
      <view class="stat-range-bar">
        <view class="stat-range-pill" :class="{ active: range === 'month' }" @click="setRange('month')">本月</view>
        <view class="stat-range-pill" :class="{ active: range === 'quarter' }" @click="setRange('quarter')">本季</view>
        <view class="stat-range-pill" :class="{ active: range === 'year' }" @click="setRange('year')">本年</view>
      </view>
    </view>

    <view class="stat-grid">
      <view class="stat-card stat-card-purple">
        <text class="stat-card-value">{{ summary.session_count || 0 }}</text>
        <text class="stat-card-label">上课节数</text>
      </view>
      <view class="stat-card stat-card-cyan">
        <text class="stat-card-value">{{ summary.present_count || 0 }}</text>
        <text class="stat-card-label">出勤人次</text>
      </view>
      <view class="stat-card stat-card-orange">
        <text class="stat-card-value">￥{{ (summary.total_lesson_fee || 0) + (summary.total_share || 0) }}</text>
        <text class="stat-card-label">课时分成合计</text>
      </view>
      <view class="stat-card stat-card-green">
        <text class="stat-card-value">￥{{ payoutInfo.salesCommission || 0 }}</text>
        <text class="stat-card-label">销售提成合计</text>
      </view>
    </view>

    <!-- 课时分成 -->
    <view class="stat-section">
      <view class="stat-section-header">
        <text class="stat-section-emoji">�</text>
        <text class="stat-section-title">课时分成</text>
      </view>
      <view class="stat-payout-summary">
        <view class="stat-payout-item">
          <text class="stat-payout-label">可发放</text>
          <text class="stat-payout-value stat-payout-payable">￥{{ payoutInfo.payable || 0 }}</text>
        </view>
        <view class="stat-payout-item">
          <text class="stat-payout-label">已发放</text>
          <text class="stat-payout-value">￥{{ payoutInfo.paidOut || 0 }}</text>
        </view>
      </view>
      <view v-if="payoutInfo.lessonFee || payoutInfo.shareAmount || payoutInfo.salesCommission" class="stat-payout-detail">
        <view v-if="payoutInfo.lessonFee" class="stat-payout-detail-row"><text>课时费</text><text>￥{{ payoutInfo.lessonFee }}</text></view>
        <view v-if="payoutInfo.shareAmount" class="stat-payout-detail-row"><text>分成收入</text><text>￥{{ payoutInfo.shareAmount }}</text></view>
        <view v-if="payoutInfo.salesCommission" class="stat-payout-detail-row"><text>销售提成</text><text>￥{{ payoutInfo.salesCommission }}</text></view>
      </view>
      <view v-if="!payoutInfo.payouts || payoutInfo.payouts.length === 0" class="stat-empty">暂无发放记录</view>
      <view v-for="p in (payoutInfo.payouts || [])" :key="p.id" class="stat-payout-row">
        <view class="stat-payout-info">
          <text class="stat-payout-amount">￥{{ p.amount }}</text>
          <text class="stat-payout-note">{{ p.note || '课时分成发放' }} · {{ formatDate(p.created_at) }}</text>
        </view>
        <text class="stat-payout-status">已到账</text>
      </view>
    </view>


    <!-- 上课明细 -->
    <view class="stat-section">
      <view class="stat-section-header">
        <text class="stat-section-emoji">�</text>
        <text class="stat-section-title">上课明细</text>
      </view>

      <!-- 筛选区 -->
      <view class="stat-filter">
        <view class="stat-filter-row">
          <text class="stat-filter-label">课程种类</text>
          <view class="stat-filter-pills">
            <view class="stat-filter-pill" :class="{ active: !filterBiz }" @click="setBiz('')">全部</view>
            <view v-for="b in availableBusinessTypes" :key="b.code" class="stat-filter-pill" :class="{ active: filterBiz === b.code }" @click="setBiz(b.code)">{{ b.name }}</view>
          </view>
        </view>
        <view class="stat-filter-row">
          <text class="stat-filter-label">时间</text>
          <view class="stat-filter-pills">
            <view class="stat-filter-pill" :class="{ active: detailRange === 'month' }" @click="setDetailRange('month')">本月</view>
            <view class="stat-filter-pill" :class="{ active: detailRange === 'quarter' }" @click="setDetailRange('quarter')">本季</view>
            <view class="stat-filter-pill" :class="{ active: detailRange === 'year' }" @click="setDetailRange('year')">本年</view>
          </view>
        </view>
      </view>

      <view v-if="detailLoading" class="stat-empty">加载中...</view>
      <view v-else-if="detailList.length === 0" class="stat-empty">暂无上课记录</view>
      <view v-for="d in detailList" :key="d.id" class="stat-detail-card">
        <view class="stat-detail-top">
          <view class="stat-detail-date">
            <text class="stat-detail-day">{{ d.date }}</text>
            <text class="stat-detail-time">{{ d.start_time }}-{{ d.end_time }}</text>
          </view>
          <text class="stat-detail-status" :class="'st-' + d.status.toLowerCase()">{{ statusName(d.status) }}</text>
        </view>
        <view class="stat-detail-body">
          <view class="stat-detail-info">
            <text class="stat-detail-course">{{ d.course_name || businessName(d.business_type) }}</text>
            <text class="stat-detail-meta">{{ d.member_name || '-' }} · {{ businessName(d.business_type) }}</text>
            <text v-if="d.court_name" class="stat-detail-meta">{{ d.court_name }}</text>
          </view>
          <view class="stat-detail-fee" v-if="d.status === 'PRESENT'">
            <text v-if="d.lesson_fee" class="stat-detail-fee-item">课时费 ￥{{ d.lesson_fee }}</text>
            <text v-if="d.share_amount" class="stat-detail-fee-item">分成 ￥{{ d.share_amount }}</text>
          </view>
        </view>
      </view>

      <view v-if="detailList.length > 0 && detailList.length < detailTotal" class="stat-load-more" @click="loadMoreDetail">加载更多</view>
    </view>

    <CoachTabBar active="stats" />
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { businessTypeName, BUSINESS_TYPES } from '../../../utils/constants.js';
import CoachTabBar from '../../../components/CoachTabBar.vue';

export default {
  components: { CoachTabBar },
  data() {
    return {
      range: 'month', summary: {}, byBusiness: [],
      payoutInfo: { payable: 0, paidOut: 0, payouts: [] },
      filterBiz: '', detailRange: 'month',
      detailList: [], detailTotal: 0, detailPage: 1, detailLoading: false,
      primaryBusinessTypes: [],
      businessTypes: BUSINESS_TYPES || [],
    };
  },
  computed: {
    availableBusinessTypes() {
      if (this.primaryBusinessTypes.length === 0) return this.businessTypes;
      return this.businessTypes.filter((b) => this.primaryBusinessTypes.includes(b.code));
    },
  },
  onShow() { this.loadStats(); this.loadPayouts(); this.loadDetail(true); },
  methods: {
    setRange(r) { this.range = r; this.loadStats(); },
    setBiz(b) { this.filterBiz = b; this.loadDetail(true); },
    setDetailRange(r) { this.detailRange = r; this.loadDetail(true); },
    getRange(rangeKey) {
      const now = new Date();
      let startDate, endDate;
      const k = rangeKey || this.range;
      if (k === 'month') {
        startDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        endDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-31`;
      } else if (k === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        startDate = `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`;
        endDate = `${now.getFullYear()}-${String(q*3+3).padStart(2,'0')}-31`;
      } else {
        startDate = `${now.getFullYear()}-01-01`;
        endDate = `${now.getFullYear()}-12-31`;
      }
      return { startDate, endDate };
    },
    async loadStats() {
      try {
        const r = this.getRange();
        const d = await api.myStats(r);
        const s = d.summary || {};
        this.summary = {
          session_count: s.total_sessions || 0,
          present_count: s.present_count || 0,
          total_lesson_fee: s.total_lesson_fee || 0,
          total_share: s.total_share || 0,
        };
        this.byBusiness = (d.byBusinessType || []).map((b) => ({
          business_type: b.business_type,
          session_count: b.sessions || 0,
          total_lesson_fee: b.lesson_fee || 0,
        }));
      } catch (e) {}
    },
    async loadPayouts() {
      try {
        const c = await api.myCommissions();
        const p = await api.myPayouts();
        this.payoutInfo = {
          payable: Math.max(0, c.payable || 0),
          paidOut: c.paidOut || 0,
          lessonFee: c.lessonFee || 0,
          shareAmount: c.shareAmount || 0,
          salesCommission: c.salesCommission || 0,
          payouts: p.list || [],
        };
      } catch (e) {}
    },
    async loadDetail(reset) {
      if (reset) { this.detailPage = 1; this.detailList = []; }
      this.detailLoading = true;
      try {
        const r = this.getRange(this.detailRange);
        const d = await api.myAttendanceDetail({
          startDate: r.startDate, endDate: r.endDate,
          businessType: this.filterBiz || undefined,
          page: this.detailPage, pageSize: 20,
        });
        this.detailList = reset ? (d.list || []) : [...this.detailList, ...(d.list || [])];
        this.detailTotal = d.total || 0;
        if (d.primaryBusinessTypes) this.primaryBusinessTypes = d.primaryBusinessTypes;
      } catch (e) {}
      this.detailLoading = false;
    },
    loadMoreDetail() { this.detailPage++; this.loadDetail(false); },
    businessName(b) { return businessTypeName(b); },
    statusName(s) { return { PRESENT: '已出勤', ABSENT: '缺勤', LEAVE: '请假', PENDING_PAY: '待补费', NOSHOW: '违约' }[s] || s; },
    formatDate(d) { if (!d) return ''; return d.replace('T', ' ').substring(0, 16); },
    async switchRole() {
      const memberToken = uni.getStorageSync('memberToken');
      const memberUser = uni.getStorageSync('memberUser');
      if (memberToken && memberUser) {
        uni.setStorageSync('token', memberToken); uni.setStorageSync('user', memberUser); uni.setStorageSync('role', 'member');
        uni.reLaunch({ url: '/pages/member/assets/assets' });
        return;
      }
      try {
        const d = await api.switchIdentity('member');
        uni.setStorageSync('token', d.token); uni.setStorageSync('user', JSON.stringify(d.user)); uni.setStorageSync('role', 'member');
        uni.reLaunch({ url: '/pages/member/assets/assets' });
      } catch (e) { uni.showToast({ title: e.message || '无法返回会员端', icon: 'none' }); }
    },
  },
};
</script>

<style scoped>
.stat-page { padding: 32rpx; padding-bottom: 160rpx; background: var(--sp-bg); min-height: 100vh; }

/* Hero header */
.stat-hero { background: var(--grad-purple); border-radius: 28rpx; padding: 32rpx 28rpx 24rpx; margin-bottom: 24rpx; box-shadow: 0 8rpx 28rpx rgba(114,46,209,0.25); }
.stat-hero-top { display: flex; align-items: center; gap: 12rpx; margin-bottom: 24rpx; }
.stat-hero-emoji { font-size: 40rpx; }
.stat-hero-title { font-size: 36rpx; font-weight: 800; color: #fff; }
.stat-range-bar { display: flex; gap: 12rpx; }
.stat-range-pill { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 100rpx; font-size: 26rpx; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.15); transition: all 0.2s; }
.stat-range-pill.active { color: var(--sp-purple); background: #fff; font-weight: 700; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1); }
.stat-range-pill:active { transform: scale(0.97); }

/* Stats grid */
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 24rpx; }
.stat-card { border-radius: 28rpx; padding: 32rpx 24rpx; text-align: center; box-shadow: var(--sp-shadow); }
.stat-card-purple { background: var(--grad-purple); }
.stat-card-cyan { background: var(--grad-cyan); }
.stat-card-orange { background: var(--grad-orange); }
.stat-card-green { background: linear-gradient(135deg, #10B981 0%, #34D399 100%); }
.stat-card-value { display: block; font-size: 44rpx; font-weight: 800; color: #fff; line-height: 1.2; }
.stat-card-label { display: block; font-size: 24rpx; color: rgba(255,255,255,0.9); margin-top: 10rpx; }

/* Section */
.stat-section { background: var(--card); border-radius: 28rpx; padding: 28rpx; margin-bottom: 24rpx; box-shadow: var(--sp-shadow); }
.stat-section-header { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; }
.stat-section-emoji { font-size: 32rpx; }
.stat-section-title { font-size: 30rpx; font-weight: 800; color: var(--text); }

/* Business type rows */
.stat-biz-row { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 2rpx solid var(--border); }
.stat-biz-row:last-child { border-bottom: none; }
.stat-biz-name { font-size: 28rpx; font-weight: 600; color: var(--text); }
.stat-biz-stats { display: flex; align-items: center; gap: 20rpx; }
.stat-biz-count { font-size: 24rpx; color: var(--text-sec); }
.stat-biz-fee { font-size: 28rpx; color: var(--sp-orange); font-weight: 800; }

/* Payout section */
.stat-payout-summary { display: flex; gap: 20rpx; margin-bottom: 20rpx; }
.stat-payout-item { flex: 1; background: var(--sp-bg); border-radius: 16rpx; padding: 24rpx; text-align: center; }
.stat-payout-label { display: block; font-size: 24rpx; color: var(--text-sec); margin-bottom: 8rpx; }
.stat-payout-value { display: block; font-size: 36rpx; font-weight: 800; color: var(--text); }
.stat-payout-payable { color: var(--sp-orange); }
.stat-payout-detail { background: var(--sp-bg); border-radius: 16rpx; padding: 16rpx 24rpx; margin-bottom: 20rpx; }
.stat-payout-detail-row { display: flex; justify-content: space-between; padding: 8rpx 0; font-size: 24rpx; color: var(--text-sec); }
.stat-payout-row { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 2rpx solid var(--border); }
.stat-payout-row:last-child { border-bottom: none; }
.stat-payout-info { display: flex; flex-direction: column; gap: 4rpx; }
.stat-payout-amount { font-size: 28rpx; font-weight: 700; color: var(--text); }
.stat-payout-note { font-size: 22rpx; color: var(--text-sec); }
.stat-payout-status { font-size: 22rpx; color: var(--sp-green); padding: 4rpx 14rpx; border-radius: 100rpx; background: rgba(16,185,129,0.1); }
.stat-empty { text-align: center; color: var(--text-sec); font-size: 26rpx; padding: 40rpx 0; }

/* Filter */
.stat-filter { margin-bottom: 20rpx; }
.stat-filter-row { display: flex; align-items: flex-start; margin-bottom: 16rpx; }
.stat-filter-label { font-size: 24rpx; color: var(--text-sec); width: 120rpx; flex-shrink: 0; padding-top: 10rpx; }
.stat-filter-pills { display: flex; flex-wrap: wrap; gap: 12rpx; flex: 1; }
.stat-filter-pill { padding: 8rpx 20rpx; border-radius: 100rpx; font-size: 24rpx; color: var(--text-sec); background: var(--sp-bg); transition: all 0.2s; }
.stat-filter-pill.active { color: #fff; background: var(--sp-purple); font-weight: 600; }
.stat-filter-pill:active { transform: scale(0.95); }

/* Detail card */
.stat-detail-card { background: var(--sp-bg); border-radius: 20rpx; padding: 24rpx; margin-bottom: 16rpx; }
.stat-detail-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.stat-detail-date { display: flex; align-items: center; gap: 12rpx; }
.stat-detail-day { font-size: 28rpx; font-weight: 700; color: var(--text); }
.stat-detail-time { font-size: 24rpx; color: var(--text-sec); }
.stat-detail-status { font-size: 22rpx; font-weight: 600; padding: 4rpx 16rpx; border-radius: 100rpx; }
.stat-detail-status.st-present { color: var(--sp-green); background: rgba(16,185,129,0.1); }
.stat-detail-status.st-absent { color: var(--sp-red, #EF4444); background: rgba(239,68,68,0.1); }
.stat-detail-status.st-leave { color: var(--sp-amber, #F59E0B); background: rgba(245,158,11,0.1); }
.stat-detail-status.st-pending_pay { color: var(--sp-orange); background: rgba(255,77,40,0.1); }
.stat-detail-body { display: flex; justify-content: space-between; align-items: flex-start; }
.stat-detail-info { display: flex; flex-direction: column; gap: 6rpx; }
.stat-detail-course { font-size: 28rpx; font-weight: 600; color: var(--text); }
.stat-detail-meta { font-size: 22rpx; color: var(--text-sec); }
.stat-detail-fee { display: flex; flex-direction: column; align-items: flex-end; gap: 4rpx; }
.stat-detail-fee-item { font-size: 24rpx; color: var(--sp-orange); font-weight: 600; }

/* Load more */
.stat-load-more { text-align: center; padding: 24rpx; color: var(--sp-purple); font-size: 26rpx; font-weight: 600; }
.stat-load-more:active { transform: scale(0.97); }
</style>
