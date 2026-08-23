<template>
  <view class="cmem-page">
    <view class="cmem-card">
      <view class="cmem-section-header">
        <view class="cmem-accent-bar"></view>
        <text class="cmem-section-title">基本信息</text>
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">姓名 *</text>
        <input class="cmem-input" :value="form.name" placeholder="请输入姓名" @input="onNameInput" @focus="showSuggest=true" @blur="hideSuggest" />
        <view v-if="showSuggest && suggestions.length > 0" class="cmem-suggest">
          <view v-for="m in suggestions" :key="m.id" class="cmem-suggest-item" @click.stop="pickExisting(m)">
            <text>{{ m.name }} ({{ m.phone }})</text>
            <text class="cmem-suggest-tag">已建档</text>
          </view>
        </view>
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">手机号 *</text>
        <input class="cmem-input" :value="form.phone" placeholder="请输入11位手机号" type="number" maxlength="11" @input="onPhoneInput" @focus="showSuggest=true" @blur="hideSuggest" />
        <view v-if="showSuggest && suggestions.length > 0" class="cmem-suggest">
          <view v-for="m in suggestions" :key="m.id" class="cmem-suggest-item" @click.stop="pickExisting(m)">
            <text>{{ m.name }} ({{ m.phone }})</text>
            <text class="cmem-suggest-tag">已建档</text>
          </view>
        </view>
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">性别</text>
        <SpPicker v-model="form.gender" :options="genderOptions" title="选择性别" />
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">出生年月</text>
        <SpPicker v-model="form.birthDate" :options="birthDateOptions" label-key="label" value-key="value" title="选择出生年月" />
      </view>
    </view>

    <view class="cmem-card">
      <view class="cmem-section-header">
        <view class="cmem-accent-bar"></view>
        <text class="cmem-section-title">分类与来源</text>
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">会员分类 *</text>
        <SpPicker v-model="form.categoryCode" :options="categoryOptions" title="选择会员分类" />
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">渠道来源</text>
        <SpPicker v-model="form.channelId" :options="channelOptions" title="选择渠道来源" />
      </view>
    </view>

    <view class="cmem-card">
      <view class="cmem-section-header">
        <view class="cmem-accent-bar"></view>
        <text class="cmem-section-title">备注信息</text>
      </view>
      <view class="cmem-form-item">
        <text class="cmem-label">备注</text>
        <textarea class="cmem-textarea" v-model="form.note" placeholder="选填" />
      </view>
    </view>

    <button class="cmem-submit-btn" @click="handleSubmit" :loading="loading">提交建档</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { MEMBER_CATEGORIES, GENDERS, memberCategoryName } from '../../../utils/constants.js';
import SpPicker from '../../../components/SpPicker.vue';

export default {
  components: { SpPicker },
  data() {
    return {
      form: { name: '', phone: '', gender: '', birthDate: '', categoryCode: '', channelId: '', note: '' },
      categoryOptions: MEMBER_CATEGORIES,
      genderOptions: GENDERS,
      channelOptions: [],
      loading: false,
      suggestions: [],
      showSuggest: false,
      searchTimer: null,
    };
  },
  computed: {
    birthDateOptions() {
      // 生成1950-2010年的出生年月选项
      const opts = [];
      for (let y = 2010; y >= 1950; y--) {
        opts.push({ label: `${y}年`, value: `${y}-01-01` });
      }
      return opts;
    },
  },
  onLoad() { this.loadChannels(); },
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
      try {
        this.suggestions = await api.memberSearch(kw.trim());
        this.showSuggest = true;
      } catch (e) { this.suggestions = []; }
    },
    hideSuggest() { setTimeout(() => { this.showSuggest = false; }, 200); },
    pickExisting(m) {
      uni.showModal({
        title: '会员已存在',
        content: `${m.name} (${m.phone}) 已建档，是否查看详情？`,
        success: (r) => { if (r.confirm) uni.navigateTo({ url: `/pages/sales/members/detail?id=${m.id}` }); },
      });
    },
    async loadChannels() {
      try {
        const d = await api.channels();
        this.channelOptions = (d.tree || []).map((c) => ({ code: c.id, name: c.name }));
      } catch (e) {
        uni.showToast({ title: '渠道加载失败: ' + (e.message || ''), icon: 'none' });
      }
    },
    async handleSubmit() {
      if (!this.form.name || !this.form.phone || !this.form.categoryCode) {
        uni.showToast({ title: '请填写必填项', icon: 'none' });
        return;
      }
      if (!/^\d{11}$/.test(this.form.phone)) {
        uni.showToast({ title: '手机号格式错误', icon: 'none' });
        return;
      }
      this.loading = true;
      try {
        await api.createMember(this.form);
        uni.showToast({ title: '建档成功', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 1500);
      } catch (e) {
        uni.showToast({ title: e.message || '建档失败', icon: 'none' });
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.cmem-page {
  min-height: 100vh;
  background: var(--sp-bg, #F0F2F5);
  padding: 32rpx;
  box-sizing: border-box;
}

/* Form cards */
.cmem-card {
  background: var(--card, #FFFFFF);
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: var(--sp-shadow, 0 8rpx 28rpx rgba(15, 23, 42, 0.10));
  margin-bottom: 24rpx;
}

/* Section headers with orange accent bar */
.cmem-section-header {
  display: flex;
  align-items: center;
  margin-bottom: 28rpx;
}
.cmem-accent-bar {
  width: 8rpx;
  height: 32rpx;
  background: var(--sp-orange, #FF4D28);
  border-radius: 4rpx;
  margin-right: 16rpx;
}
.cmem-section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text, #0F172A);
}

/* Form items */
.cmem-form-item {
  margin-bottom: 28rpx;
}
.cmem-form-item:last-child {
  margin-bottom: 0;
}
.cmem-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text, #0F172A);
  margin-bottom: 12rpx;
  display: block;
}
.cmem-input {
  height: 88rpx;
  background: var(--sp-bg, #F0F2F5);
  border: 2rpx solid var(--border, #EEF0F3);
  border-radius: 20rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--text, #0F172A);
  transition: border-color 0.2s;
}
.cmem-input:focus {
  border-color: var(--sp-orange, #FF4D28);
}
.cmem-suggest { background: var(--card, #fff); border-radius: 16rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,0.15); margin-top: 8rpx; max-height: 400rpx; overflow-y: auto; position: relative; z-index: 10; }
.cmem-suggest-item { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 24rpx; border-bottom: 1rpx solid var(--border, #EEF0F3); font-size: 26rpx; }
.cmem-suggest-item:last-child { border-bottom: none; }
.cmem-suggest-item:active { background: var(--sp-bg, #F0F2F5); }
.cmem-suggest-tag { font-size: 20rpx; color: var(--sp-orange, #FF4D28); background: var(--sp-bg-warm, #FFF5F0); padding: 4rpx 12rpx; border-radius: 100rpx; }
.cmem-textarea {
  width: 100%;
  height: 140rpx;
  background: var(--sp-bg, #F0F2F5);
  border: 2rpx solid var(--border, #EEF0F3);
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: var(--text, #0F172A);
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.cmem-textarea:focus {
  border-color: var(--sp-orange, #FF4D28);
}

/* Submit button - orange gradient */
.cmem-submit-btn {
  background: var(--grad-orange, linear-gradient(135deg, #FF4D28 0%, #FF7A5C 100%));
  color: #FFFFFF;
  border-radius: 24rpx;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  box-shadow: var(--sp-shadow-orange, 0 8rpx 28rpx rgba(255, 77, 40, 0.25));
  border: none;
  margin-top: 16rpx;
  transition: transform 0.2s;
}
.cmem-submit-btn:active {
  transform: scale(0.97);
}
</style>
