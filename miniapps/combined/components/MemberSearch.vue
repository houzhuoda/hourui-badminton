<template>
  <view class="ms-wrap">
    <view class="ms-input-wrap">
      <text class="ms-icon">🔍</text>
      <input class="ms-input" :value="keyword" :placeholder="placeholder" @input="onInput" @focus="onFocus" @blur="onBlur" />
      <text v-if="keyword" class="ms-clear" @click="clear">×</text>
    </view>
    <view v-if="showDropdown && suggestions.length > 0" class="ms-dropdown">
      <view v-for="m in suggestions" :key="m.id" class="ms-item" @click.stop="select(m)">
        <view class="ms-item-left">
          <text class="ms-item-name">{{ m.name }}</text>
          <text class="ms-item-phone">{{ m.phone }}</text>
        </view>
        <text class="ms-item-arrow">›</text>
      </view>
    </view>
    <view v-if="showDropdown && keyword && suggestions.length === 0 && !searching" class="ms-empty">
      <text>未找到匹配会员</text>
    </view>
  </view>
</template>

<script>
import { api } from '../api/index.js';

export default {
  props: {
    placeholder: { type: String, default: '输入姓名或手机号搜索会员' },
  },
  emits: ['select'],
  data() {
    return { keyword: '', suggestions: [], showDropdown: false, searching: false, timer: null };
  },
  methods: {
    onInput(e) {
      // 兼容 uni-app H5 和小程序：优先用 e.detail.value，回退到 e.target.value
      const val = (e && e.detail && e.detail.value != null) ? e.detail.value : (e && e.target && e.target.value) || '';
      this.keyword = val;
      if (this.timer) clearTimeout(this.timer);
      const kw = (val || '').trim();
      if (kw.length < 1) { this.suggestions = []; this.showDropdown = false; return; }
      this.searching = true;
      this.timer = setTimeout(() => this.search(kw), 300);
    },
    async search(kw) {
      try {
        const list = await api.memberSearch(kw);
        this.suggestions = list || [];
        this.showDropdown = true;
      } catch (e) { this.suggestions = []; }
      this.searching = false;
    },
    onFocus() { if (this.suggestions.length > 0) this.showDropdown = true; },
    onBlur() { setTimeout(() => { this.showDropdown = false; }, 250); },
    select(m) {
      this.keyword = `${m.name} (${m.phone})`;
      this.showDropdown = false;
      this.$emit('select', m);
    },
    clear() {
      this.keyword = '';
      this.suggestions = [];
      this.showDropdown = false;
      this.$emit('select', null);
    },
  },
};
</script>

<style scoped>
.ms-wrap { position: relative; width: 100%; }
.ms-input-wrap { display: flex; align-items: center; background: var(--sp-bg, #F0F2F5); border: 2rpx solid var(--border, #EEF0F3); border-radius: 16rpx; padding: 0 20rpx; height: 88rpx; }
.ms-icon { font-size: 28rpx; margin-right: 12rpx; }
.ms-input { flex: 1; height: 88rpx; font-size: 28rpx; color: var(--text, #0F172A); }
.ms-clear { font-size: 36rpx; color: var(--text-sec, #6B7280); padding: 0 8rpx; }
.ms-dropdown { position: absolute; top: 92rpx; left: 0; right: 0; background: var(--card, #fff); border-radius: 16rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,0.15); z-index: 100; max-height: 480rpx; overflow-y: auto; }
.ms-item { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 20rpx; border-bottom: 1rpx solid var(--border, #EEF0F3); }
.ms-item:last-child { border-bottom: none; }
.ms-item:active { background: var(--sp-bg, #F0F2F5); }
.ms-item-left { display: flex; flex-direction: column; }
.ms-item-name { font-size: 28rpx; font-weight: 600; color: var(--text, #0F172A); }
.ms-item-phone { font-size: 24rpx; color: var(--text-sec, #6B7280); margin-top: 4rpx; }
.ms-item-arrow { font-size: 32rpx; color: var(--text-sec, #6B7280); }
.ms-empty { position: absolute; top: 92rpx; left: 0; right: 0; background: var(--card, #fff); border-radius: 16rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,0.15); z-index: 100; padding: 30rpx; text-align: center; color: var(--text-sec, #6B7280); font-size: 26rpx; }
</style>
