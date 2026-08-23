<template>
  <view class="cm-page">
    <view class="cm-header">
      <text class="cm-header-emoji">👥</text>
      <text class="cm-header-title">新建会员</text>
    </view>
    <view class="cm-form">
      <view class="cm-form-item"><text class="cm-label">姓名 <text class="cm-required">*</text></text>
        <input class="cm-input" :value="form.name" placeholder="请输入姓名" @input="onNameInput" @focus="showSuggest=true" @blur="hideSuggest" />
        <view v-if="showSuggest && suggestions.length > 0" class="cm-suggest">
          <view v-for="m in suggestions" :key="m.id" class="cm-suggest-item" @click.stop="pickExisting(m)">
            <text>{{ m.name }} ({{ m.phone }})</text>
            <text class="cm-suggest-tag">已建档</text>
          </view>
        </view>
      </view>
      <view class="cm-form-item"><text class="cm-label">手机号 <text class="cm-required">*</text></text>
        <input class="cm-input" :value="form.phone" placeholder="11位手机号" type="number" maxlength="11" @input="onPhoneInput" @focus="showSuggest=true" @blur="hideSuggest" />
        <view v-if="showSuggest && suggestions.length > 0" class="cm-suggest">
          <view v-for="m in suggestions" :key="m.id" class="cm-suggest-item" @click.stop="pickExisting(m)">
            <text>{{ m.name }} ({{ m.phone }})</text>
            <text class="cm-suggest-tag">已建档</text>
          </view>
        </view>
      </view>
      <view class="cm-form-item"><text class="cm-label">性别</text>
        <SpPicker v-model="form.gender" :options="GENDERS" title="选择性别" />
      </view>
      <view class="cm-form-item"><text class="cm-label">会员分类 <text class="cm-required">*</text></text>
        <SpPicker v-model="form.categoryCode" :options="MEMBER_CATEGORIES" title="选择会员分类" />
      </view>
    </view>
    <button class="cm-submit-btn" @click="submit" :loading="loading">建档</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { MEMBER_CATEGORIES, GENDERS } from '../../../utils/constants.js';
import SpPicker from '../../../components/SpPicker.vue';

export default {
  components: { SpPicker },
  data() { return { form: { name: '', phone: '', gender: '', categoryCode: '' }, GENDERS, MEMBER_CATEGORIES, loading: false, suggestions: [], showSuggest: false, searchTimer: null }; },
  methods: {
    onNameInput(e) {
      const val = (e && e.detail && e.detail.value != null) ? e.detail.value : (e && e.target && e.target.value) || '';
      this.form.name = val;
      this.debounceSearch(val);
    },
    onPhoneInput(e) {
      const val = (e && e.detail && e.detail.value != null) ? e.detail.value : (e && e.target && e.target.value) || '';
      this.form.phone = val;
      this.debounceSearch(val);
    },
    debounceSearch(kw) {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      if (!kw || kw.trim().length < 1) { this.suggestions = []; return; }
      this.searchTimer = setTimeout(() => this.doSearch(kw), 300);
    },
    async doSearch(kw) {
      try { this.suggestions = await api.memberSearch(kw.trim()); this.showSuggest = true; } catch (e) { this.suggestions = []; }
    },
    hideSuggest() { setTimeout(() => { this.showSuggest = false; }, 200); },
    pickExisting(m) {
      uni.showModal({
        title: '会员已存在',
        content: `${m.name} (${m.phone}) 已建档，是否直接开单？`,
        success: (r) => { if (r.confirm) uni.redirectTo({ url: `/pages/coach/sales/create-order?memberId=${m.id}` }); },
      });
    },
    async submit() {
      if (!this.form.name || !this.form.phone || !this.form.categoryCode) { uni.showToast({ title: '请填写必填项', icon: 'none' }); return; }
      if (!/^\d{11}$/.test(this.form.phone)) { uni.showToast({ title: '手机号格式错误', icon: 'none' }); return; }
      this.loading = true;
      try {
        const m = await api.createMember(this.form);
        uni.showToast({ title: '建档成功', icon: 'success' });
        setTimeout(() => uni.navigateTo({ url: `/pages/coach/sales/create-order?memberId=${m.id}` }), 1500);
      } catch (e) {
        uni.showToast({ title: e.message || '建档失败', icon: 'none' });
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.cm-page { padding: 32rpx; background: var(--sp-bg); min-height: 100vh; }

/* Header */
.cm-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 24rpx; }
.cm-header-emoji { font-size: 40rpx; }
.cm-header-title { font-size: 36rpx; font-weight: 800; color: var(--sp-orange); }

/* Form */
.cm-form { background: var(--card); border-radius: 28rpx; padding: 28rpx; box-shadow: var(--sp-shadow); }
.cm-form-item { margin-bottom: 28rpx; }
.cm-form-item:last-child { margin-bottom: 0; }
.cm-label { font-size: 28rpx; font-weight: 600; color: var(--text); margin-bottom: 12rpx; display: block; }
.cm-required { color: var(--sp-red); font-weight: 700; }
.cm-input { height: 88rpx; border: 2rpx solid var(--border); border-radius: 16rpx; padding: 0 24rpx; font-size: 28rpx; background: var(--sp-bg); transition: border-color 0.2s; }
.cm-input:focus { border-color: var(--sp-orange); }
.cm-suggest { background: var(--card, #fff); border-radius: 16rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,0.15); margin-top: 8rpx; max-height: 400rpx; overflow-y: auto; position: relative; z-index: 10; }
.cm-suggest-item { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 24rpx; border-bottom: 1rpx solid var(--border, #EEF0F3); font-size: 26rpx; }
.cm-suggest-item:last-child { border-bottom: none; }
.cm-suggest-item:active { background: var(--sp-bg, #F0F2F5); }
.cm-suggest-tag { font-size: 20rpx; color: var(--sp-orange, #FF4D28); background: var(--sp-bg-warm, #FFF5F0); padding: 4rpx 12rpx; border-radius: 100rpx; }

/* Submit button */
.cm-submit-btn { background: var(--grad-orange) !important; color: #fff !important; border-radius: 100rpx !important; height: 96rpx; line-height: 96rpx; font-size: 32rpx; font-weight: 700; margin-top: 24rpx; box-shadow: var(--sp-shadow-orange); }
.cm-submit-btn:active { transform: scale(0.97); }
</style>
