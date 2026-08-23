<template>
  <view class="perf-page">
    <!-- Summary cards with gradient backgrounds -->
    <view class="perf-summary-grid">
      <view class="perf-summary-card perf-card-orange">
        <text class="perf-summary-label">可发放提成</text>
        <text class="perf-summary-value">￥{{ data.payable || 0 }}</text>
      </view>
      <view class="perf-summary-card perf-card-cyan">
        <text class="perf-summary-label">已计提提成</text>
        <text class="perf-summary-value">￥{{ data.actualCommission || 0 }}</text>
      </view>
      <view class="perf-summary-card perf-card-purple">
        <text class="perf-summary-label">已发放</text>
        <text class="perf-summary-value">￥{{ data.paidOut || 0 }}</text>
      </view>
    </view>

    <!-- By business type section -->
    <view class="perf-section">
      <view class="perf-section-header">
        <view class="perf-accent-bar"></view>
        <text class="perf-section-title">按业务类型</text>
      </view>
      <view v-if="!data.byBusiness || data.byBusiness.length === 0" class="perf-empty">暂无数据</view>
      <view v-for="b in (data.byBusiness || [])" :key="b.business_type" class="perf-biz-row">
        <text class="perf-biz-name">{{ businessName(b.business_type) }}</text>
        <view class="perf-biz-stats">
          <text class="perf-biz-count">{{ b.count }} 单</text>
          <text class="perf-biz-amount">￥{{ b.amount }}</text>
        </view>
      </view>
    </view>

    <!-- Commission records section -->
    <view class="perf-section">
      <view class="perf-section-header">
        <view class="perf-accent-bar"></view>
        <text class="perf-section-title">提成记录</text>
      </view>
      <view v-if="!data.commissions || data.commissions.length === 0" class="perf-empty">暂无提成</view>
      <view v-for="c in (data.commissions || [])" :key="c.id" class="perf-commission-row">
        <view class="perf-commission-info">
          <text class="perf-commission-order">{{ c.order_no }}</text>
          <text class="perf-commission-type">{{ businessName(c.business_type) }} · {{ c.commission_type === 'NEW' ? '新客' : '续费' }}</text>
        </view>
        <text class="perf-commission-amount">￥{{ c.amount }}</text>
      </view>
    </view>

    <!-- 提成发放记录 -->
    <view class="perf-section">
      <view class="perf-section-header">
        <view class="perf-accent-bar"></view>
        <text class="perf-section-title">发放记录</text>
      </view>
      <view v-if="!data.payouts || data.payouts.length === 0" class="perf-empty">暂无发放记录</view>
      <view v-for="p in (data.payouts || [])" :key="p.id" class="perf-commission-row">
        <view class="perf-commission-info">
          <text class="perf-commission-order">￥{{ p.amount }}</text>
          <text class="perf-commission-type">{{ p.note || '提成发放' }} · {{ formatDate(p.created_at) }}</text>
        </view>
        <text class="perf-payout-status">已到账</text>
      </view>
    </view>

    <!-- 开单列表（带查询） -->
    <view class="perf-section">
      <view class="perf-section-header">
        <view class="perf-accent-bar"></view>
        <text class="perf-section-title">开单记录</text>
      </view>

      <!-- 查询栏 -->
      <view class="perf-search-bar">
        <input class="perf-search-input" :value="orderQuery.keyword" placeholder="订单号/会员姓名" @input="onOrderSearch" />
      </view>
      <view class="perf-filter-row">
        <view class="perf-filter-item" :class="{ active: !orderQuery.businessType }" @click="setBizFilter('')">全部</view>
        <view class="perf-filter-item" :class="{ active: orderQuery.businessType === b.code }" v-for="b in businessTypeOptions" :key="b.code" @click="setBizFilter(b.code)">{{ b.name }}</view>
      </view>

      <!-- 订单列表 -->
      <view v-if="orderLoading" class="perf-empty">加载中...</view>
      <view v-else-if="orders.length === 0" class="perf-empty">暂无订单</view>
      <view v-for="o in orders" :key="o.id" class="perf-order-row">
        <view class="perf-order-left">
          <text class="perf-order-no">{{ o.order_no }}</text>
          <text class="perf-order-info">{{ o.member_name }} · {{ businessName(o.business_type) }}</text>
          <text class="perf-order-time">{{ formatDate(o.created_at) }}</text>
        </view>
        <view class="perf-order-right">
          <text class="perf-order-amount">￥{{ o.amount }}</text>
          <text class="perf-order-status" :class="{ paid: o.status === 'PAID', refunded: o.status === 'REFUNDED' }">{{ orderStatusName(o.status) }}</text>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="orders.length < orderTotal" class="perf-load-more" @click="loadMoreOrders">加载更多</view>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { businessTypeName, BUSINESS_TYPES, ORDER_STATUS } from '../../../utils/constants.js';

export default {
  data() {
    return {
      data: {},
      orders: [],
      orderTotal: 0,
      orderLoading: false,
      orderQuery: { keyword: '', businessType: '', page: 1, pageSize: 10 },
      businessTypeOptions: BUSINESS_TYPES.map((b) => ({ code: b.code, name: b.name })),
      searchTimer: null,
    };
  },
  onShow() { this.loadData(); this.loadOrders(); },
  methods: {
    async loadData() {
      try {
        const perf = await api.performance();
        const commissions = await api.myCommissions();
        const payouts = await api.myPayouts();
        const byBusiness = {};
        for (const o of (perf.list || [])) {
          const bt = o.business_type;
          if (!byBusiness[bt]) byBusiness[bt] = { business_type: bt, count: 0, amount: 0 };
          byBusiness[bt].count++;
          byBusiness[bt].amount += o.amount;
        }
        this.data = {
          monthIncome: perf.summary?.totalAmount || 0,
          estimatedCommission: perf.summary?.estimatedCommission || 0,
          actualCommission: commissions.total || 0,
          paidOut: commissions.paidOut || 0,
          payable: commissions.payable || 0,
          byBusiness: Object.values(byBusiness),
          commissions: commissions.list || commissions || [],
          payouts: payouts.list || [],
        };
      } catch (e) {}
    },
    async loadOrders(append) {
      this.orderLoading = true;
      try {
        const d = await api.orderList(this.orderQuery);
        this.orders = append ? [...this.orders, ...d.list] : d.list;
        this.orderTotal = d.total;
      } catch (e) {
        if (!append) this.orders = [];
      }
      this.orderLoading = false;
    },
    onOrderSearch(e) {
      const val = (e && e.detail && e.detail.value != null) ? e.detail.value : (e && e.target && e.target.value) || '';
      this.orderQuery.keyword = val;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => { this.orderQuery.page = 1; this.loadOrders(); }, 300);
    },
    setBizFilter(code) {
      this.orderQuery.businessType = code;
      this.orderQuery.page = 1;
      this.loadOrders();
    },
    loadMoreOrders() {
      this.orderQuery.page++;
      this.loadOrders(true);
    },
    businessName(b) { return businessTypeName(b); },
    orderStatusName(s) { return ORDER_STATUS[s] || s; },
    formatDate(d) {
      if (!d) return '';
      return d.replace('T', ' ').substring(0, 16);
    },
  },
};
</script>

<style scoped>
.perf-page {
  min-height: 100vh;
  background: var(--sp-bg, #F0F2F5);
  padding: 32rpx;
  box-sizing: border-box;
}

/* Summary cards grid with gradient backgrounds */
.perf-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  margin-bottom: 24rpx;
}
.perf-summary-card {
  border-radius: 28rpx;
  padding: 32rpx 28rpx;
  display: flex;
  flex-direction: column;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
}
.perf-card-orange {
  background: var(--grad-orange, linear-gradient(135deg, #FF4D28 0%, #FF7A5C 100%));
  box-shadow: var(--sp-shadow-orange, 0 8rpx 28rpx rgba(255, 77, 40, 0.25));
}
.perf-card-cyan {
  background: var(--grad-cyan, linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%));
  box-shadow: 0 8rpx 28rpx rgba(6, 182, 212, 0.25);
}
.perf-card-purple {
  background: linear-gradient(135deg, #722ED1 0%, #9D5CFF 100%);
  box-shadow: 0 8rpx 28rpx rgba(114, 46, 209, 0.25);
}
.perf-summary-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 12rpx;
}
.perf-summary-value {
  font-size: 44rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}

/* Detail sections in white cards */
.perf-section {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  margin-bottom: 24rpx;
}
.perf-section-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}
.perf-accent-bar {
  width: 8rpx;
  height: 32rpx;
  background: var(--sp-orange, #FF4D28);
  border-radius: 4rpx;
  margin-right: 16rpx;
}
.perf-section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}
.perf-empty {
  text-align: center;
  color: var(--text-sec, #6B7280);
  font-size: 26rpx;
  padding: 40rpx 0;
}

/* Business type rows */
.perf-biz-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border, #EEF0F3);
}
.perf-biz-row:last-child {
  border-bottom: none;
}
.perf-biz-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text, #0F172A);
}
.perf-biz-stats {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.perf-biz-count {
  font-size: 24rpx;
  color: var(--text-sec, #6B7280);
}
.perf-biz-amount {
  font-size: 30rpx;
  color: var(--sp-orange, #FF4D28);
  font-weight: 700;
}

/* Commission rows */
.perf-commission-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border, #EEF0F3);
}
.perf-commission-row:last-child {
  border-bottom: none;
}
.perf-commission-info {
  display: flex;
  flex-direction: column;
}
.perf-commission-order {
  font-size: 26rpx;
  color: var(--text, #0F172A);
  font-weight: 500;
}
.perf-commission-type {
  font-size: 22rpx;
  color: var(--text-sec, #6B7280);
  margin-top: 6rpx;
}
.perf-commission-amount {
  font-size: 32rpx;
  color: var(--sp-green, #10B981);
  font-weight: 700;
}
.perf-payout-status {
  font-size: 22rpx;
  color: var(--sp-green, #10B981);
  padding: 4rpx 14rpx;
  border-radius: 100rpx;
  background: rgba(16,185,129,0.1);
}

/* 搜索栏 */
.perf-search-bar { display: flex; align-items: center; background: var(--sp-bg, #F0F2F5); border-radius: 16rpx; padding: 0 20rpx; height: 72rpx; margin-bottom: 16rpx; }
.perf-search-input { flex: 1; height: 72rpx; font-size: 26rpx; color: var(--text, #0F172A); }

/* 业务类型筛选 */
.perf-filter-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 20rpx; }
.perf-filter-item { font-size: 22rpx; color: var(--text-sec, #6B7280); background: var(--sp-bg, #F0F2F5); padding: 8rpx 20rpx; border-radius: 100rpx; }
.perf-filter-item.active { color: #fff; background: var(--sp-orange, #FF4D28); font-weight: 600; }

/* 订单列表行 */
.perf-order-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 24rpx 0; border-bottom: 1rpx solid var(--border, #EEF0F3); }
.perf-order-row:last-child { border-bottom: none; }
.perf-order-left { display: flex; flex-direction: column; gap: 6rpx; }
.perf-order-no { font-size: 26rpx; font-weight: 600; color: var(--text, #0F172A); }
.perf-order-info { font-size: 24rpx; color: var(--text-sec, #6B7280); }
.perf-order-time { font-size: 22rpx; color: var(--text-sec, #9CA3AF); }
.perf-order-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6rpx; }
.perf-order-amount { font-size: 30rpx; font-weight: 700; color: var(--sp-orange, #FF4D28); }
.perf-order-status { font-size: 22rpx; color: var(--text-sec, #6B7280); padding: 4rpx 14rpx; border-radius: 100rpx; background: var(--sp-bg, #F0F2F5); }
.perf-order-status.paid { color: var(--sp-green, #10B981); background: rgba(16,185,129,0.1); }
.perf-order-status.refunded { color: #EF4444; background: rgba(239,68,68,0.1); }

/* 加载更多 */
.perf-load-more { text-align: center; color: var(--sp-orange, #FF4D28); font-size: 26rpx; padding: 24rpx 0; }

</style>
