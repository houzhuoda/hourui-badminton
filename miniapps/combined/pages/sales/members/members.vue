<template>
  <view class="mlist-page">
    <view class="mlist-search-bar">
      <text class="mlist-search-icon">🔍</text>
      <input class="mlist-search-input" :value="keyword" placeholder="姓名/手机号" @input="onSearchInput" @confirm="search" />
    </view>
    <view v-if="list.length === 0" class="mlist-empty">暂无会员</view>
    <view v-for="m in list" :key="m.id" class="mlist-member-card" @click="goDetail(m.id)">
      <view class="mlist-avatar">{{ m.name?.[0] || '?' }}</view>
      <view class="mlist-member-info">
        <text class="mlist-member-name">{{ m.name }}</text>
        <text class="mlist-member-phone">{{ m.phone }}</text>
        <view class="mlist-member-tags" v-if="m.tags && m.tags.length">
          <text v-for="t in (m.tags || [])" :key="t" class="mlist-tag">{{ categoryName(t) }}</text>
        </view>
      </view>
      <text class="mlist-member-status" :class="{ 'mlist-status-active': m.status === 'ACTIVE' }">{{ m.status === 'ACTIVE' ? '正常' : '停用' }}</text>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { memberCategoryName } from '../../../utils/constants.js';

export default {
  data() {
    return { list: [], keyword: '', page: 1, total: 0, searchTimer: null };
  },
  onShow() { this.loadList(); },
  onReachBottom() {
    if (this.list.length < this.total) { this.page++; this.loadList(true); }
  },
  methods: {
    async loadList(append) {
      try {
        const d = await api.memberList({ keyword: this.keyword, page: this.page, pageSize: 20 });
        this.list = append ? [...this.list, ...d.list] : d.list;
        this.total = d.total;
      } catch (e) {}
    },
    search() { this.page = 1; this.loadList(); },
    onSearchInput(e) {
      const val = (e && e.detail && e.detail.value != null) ? e.detail.value : (e && e.target && e.target.value) || '';
      this.keyword = val;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => { this.page = 1; this.loadList(); }, 300);
    },
    goDetail(id) { uni.navigateTo({ url: `/pages/sales/members/detail?id=${id}` }); },
    categoryName(t) { return memberCategoryName(t); },
  },
};
</script>

<style scoped>
.mlist-page {
  min-height: 100vh;
  background: var(--sp-bg, #F0F2F5);
  padding: 32rpx;
  box-sizing: border-box;
}

/* Search bar */
.mlist-search-bar {
  display: flex;
  align-items: center;
  background: var(--card, #FFFFFF);
  border-radius: 24rpx;
  padding: 0 24rpx;
  height: 88rpx;
  box-shadow: var(--sp-shadow-sm, 0 4rpx 12rpx rgba(15, 23, 42, 0.06));
  margin-bottom: 24rpx;
}
.mlist-search-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}
.mlist-search-input {
  flex: 1;
  height: 88rpx;
  font-size: 28rpx;
  color: var(--text, #0F172A);
}

/* Empty state */
.mlist-empty {
  text-align: center;
  color: var(--text-sec, #6B7280);
  font-size: 28rpx;
  padding: 80rpx 0;
}

/* Member cards */
.mlist-member-card {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  transition: transform 0.2s;
}
.mlist-member-card:active {
  transform: scale(0.97);
}

/* Avatar circle with orange gradient */
.mlist-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--grad-orange, linear-gradient(135deg, #FF4D28 0%, #FF7A5C 100%));
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: var(--sp-shadow-orange, 0 8rpx 28rpx rgba(255, 77, 40, 0.25));
}

/* Member info */
.mlist-member-info {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}
.mlist-member-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}
.mlist-member-phone {
  font-size: 24rpx;
  color: var(--text-sec, #6B7280);
  margin-top: 6rpx;
}

/* Tags as pill badges */
.mlist-member-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
}
.mlist-tag {
  font-size: 20rpx;
  color: var(--sp-orange, #FF4D28);
  background: var(--sp-bg-warm, #FFF5F0);
  padding: 4rpx 16rpx;
  border-radius: 100rpx;
}

/* Status badge */
.mlist-member-status {
  font-size: 24rpx;
  color: var(--text-sec, #6B7280);
  padding: 6rpx 18rpx;
  border-radius: 100rpx;
  background: var(--sp-bg, #F0F2F5);
  flex-shrink: 0;
}
.mlist-status-active {
  color: var(--sp-green, #10B981);
  background: rgba(16, 185, 129, 0.1);
}
</style>
