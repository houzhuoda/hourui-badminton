<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="姓名/手机号" @confirm="search" />
    </view>
    <view v-if="list.length === 0" class="empty">暂无会员</view>
    <view v-for="m in list" :key="m.id" class="member-card" @click="goDetail(m.id)">
      <view class="member-info">
        <text class="member-name">{{ m.name }}</text>
        <text class="member-phone">{{ m.phone }}</text>
      </view>
      <view class="member-tags">
        <text v-for="t in (m.tags || [])" :key="t" class="tag">{{ categoryName(t) }}</text>
      </view>
      <text class="member-status" :class="{ active: m.status === 'ACTIVE' }">{{ m.status === 'ACTIVE' ? '正常' : '停用' }}</text>
    </view>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { memberCategoryName } from '../../../utils/constants.js';

export default {
  data() {
    return { list: [], keyword: '', page: 1, total: 0 };
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
    goDetail(id) { uni.navigateTo({ url: `/pages/sales/members/detail?id=${id}` }); },
    categoryName(t) { return memberCategoryName(t); },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.search-bar { margin-bottom: 20rpx; }
.search-input { height: 80rpx; background: #fff; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; }
.empty { text-align: center; color: #999; padding: 80rpx; }
.member-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; display: flex; align-items: center; }
.member-info { flex: 1; }
.member-name { font-size: 30rpx; font-weight: bold; }
.member-phone { display: block; font-size: 24rpx; color: #999; margin-top: 6rpx; }
.member-tags { display: flex; gap: 8rpx; margin: 0 16rpx; }
.tag { font-size: 20rpx; color: #1890ff; background: #e6f7ff; padding: 4rpx 12rpx; border-radius: 6rpx; }
.member-status { font-size: 24rpx; }
.active { color: #52c41a; }
</style>
