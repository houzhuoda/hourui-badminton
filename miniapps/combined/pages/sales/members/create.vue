<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">姓名 *</text>
        <input class="input" v-model="form.name" placeholder="请输入姓名" />
      </view>
      <view class="form-item">
        <text class="label">手机号 *</text>
        <input class="input" v-model="form.phone" placeholder="请输入11位手机号" type="number" maxlength="11" />
      </view>
      <view class="form-item">
        <text class="label">性别</text>
        <picker :range="genderOptions" range-key="name" @change="onGenderChange">
          <view class="picker">{{ form.gender ? genderName : '请选择' }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">出生年月</text>
        <picker mode="date" @change="onBirthChange">
          <view class="picker">{{ form.birthDate || '请选择' }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">会员分类 *</text>
        <picker :range="categoryOptions" range-key="name" @change="onCategoryChange">
          <view class="picker">{{ form.categoryCode ? categoryName : '请选择' }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">渠道来源</text>
        <picker :range="channels" range-key="name" @change="onChannelChange">
          <view class="picker">{{ selectedChannelName || '请选择' }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">备注</text>
        <textarea class="textarea" v-model="form.note" placeholder="选填" />
      </view>
    </view>
    <button class="submit-btn" @click="handleSubmit" :loading="loading">提交建档</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { MEMBER_CATEGORIES, GENDERS, memberCategoryName } from '../../../utils/constants.js';

export default {
  data() {
    return {
      form: { name: '', phone: '', gender: '', birthDate: '', categoryCode: '', channelId: '', note: '' },
      categoryOptions: MEMBER_CATEGORIES,
      genderOptions: GENDERS,
      channels: [],
      selectedChannelName: '',
      loading: false,
    };
  },
  computed: {
    categoryName() { return memberCategoryName(this.form.categoryCode); },
    genderName() { return GENDERS.find((g) => g.code === this.form.gender)?.name || ''; },
  },
  onLoad() { this.loadChannels(); },
  methods: {
    async loadChannels() {
      try {
        const d = await api.channels();
        this.channels = d.tree || [];
      } catch (e) {}
    },
    onGenderChange(e) { this.form.gender = this.genderOptions[e.detail.value].code; },
    onBirthChange(e) { this.form.birthDate = e.detail.value; },
    onCategoryChange(e) { this.form.categoryCode = this.categoryOptions[e.detail.value].code; },
    onChannelChange(e) {
      const ch = this.channels[e.detail.value];
      this.form.channelId = ch.id;
      this.selectedChannelName = ch.name;
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
      } catch (e) {}
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.form { background: #fff; border-radius: 16rpx; padding: 20rpx; }
.form-item { margin-bottom: 24rpx; }
.label { font-size: 28rpx; color: #333; margin-bottom: 10rpx; display: block; }
.input { height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; }
.picker { height: 80rpx; line-height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; color: #666; }
.textarea { width: 100%; height: 120rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 20rpx; font-size: 28rpx; }
.submit-btn { margin-top: 30rpx; background: #1890ff; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; }
</style>
