<template>
  <view class="page">
    <view class="form">
      <view class="form-item"><text class="label">姓名 *</text><input class="input" v-model="form.name" placeholder="姓名" /></view>
      <view class="form-item"><text class="label">手机号 *</text><input class="input" v-model="form.phone" placeholder="11位手机号" type="number" maxlength="11" /></view>
      <view class="form-item"><text class="label">性别</text>
        <picker :range="GENDERS" range-key="name" @change="onGender"><view class="picker">{{ genderName || '请选择' }}</view></picker>
      </view>
      <view class="form-item"><text class="label">会员分类 *</text>
        <picker :range="MEMBER_CATEGORIES" range-key="name" @change="onCategory"><view class="picker">{{ categoryName || '请选择' }}</view></picker>
      </view>
    </view>
    <button class="submit-btn" @click="submit" :loading="loading">建档</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { MEMBER_CATEGORIES, GENDERS, memberCategoryName } from '../../../utils/constants.js';

export default {
  data() { return { form: { name: '', phone: '', gender: '', categoryCode: '' }, GENDERS, MEMBER_CATEGORIES, loading: false }; },
  computed: {
    genderName() { return GENDERS.find((g) => g.code === this.form.gender)?.name || ''; },
    categoryName() { return memberCategoryName(this.form.categoryCode); },
  },
  methods: {
    onGender(e) { this.form.gender = GENDERS[e.detail.value].code; },
    onCategory(e) { this.form.categoryCode = MEMBER_CATEGORIES[e.detail.value].code; },
    async submit() {
      if (!this.form.name || !this.form.phone || !this.form.categoryCode) { uni.showToast({ title: '请填写必填项', icon: 'none' }); return; }
      if (!/^\d{11}$/.test(this.form.phone)) { uni.showToast({ title: '手机号格式错误', icon: 'none' }); return; }
      this.loading = true;
      try {
        const m = await api.createMember(this.form);
        uni.showToast({ title: '建档成功', icon: 'success' });
        setTimeout(() => uni.navigateTo({ url: `/pages/coach/sales/create-order?memberId=${m.id}` }), 1500);
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
.label { font-size: 28rpx; margin-bottom: 10rpx; display: block; }
.input { height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; }
.picker { height: 80rpx; line-height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; color: #666; }
.submit-btn { background: #722ed1; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 20rpx; }
</style>
