<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">会员 *</text>
        <view class="member-display" v-if="member">{{ member.name }} ({{ member.phone }})</view>
        <button v-else size="mini" @click="selectMember">选择会员</button>
      </view>

      <view class="form-item">
        <text class="label">业务类型 *</text>
        <picker :range="businessTypes" range-key="name" @change="onBusinessChange">
          <view class="picker">{{ selectedBusinessName || '请选择' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">课程</text>
        <picker :range="filteredCourses" range-key="name" @change="onCourseChange">
          <view class="picker">{{ selectedCourseName || '请选择' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">收费模式 *</text>
        <picker :range="chargeModes" range-key="name" @change="onChargeModeChange">
          <view class="picker">{{ selectedChargeModeName || '请选择' }}</view>
        </picker>
      </view>

      <!-- 次卡档位 -->
      <view class="form-item" v-if="form.chargeMode === 'SESSION_PACK'">
        <text class="label">次卡档位 *</text>
        <picker :range="sessionPricingOptions" range-key="label" @change="onSpChange">
          <view class="picker">{{ selectedSpName || '请选择' }}</view>
        </picker>
      </view>

      <!-- 月卡档位 -->
      <view class="form-item" v-if="form.chargeMode === 'MONTHLY'">
        <text class="label">月卡档位 *</text>
        <picker :range="monthlyPricingOptions" range-key="label" @change="onMpChange">
          <view class="picker">{{ selectedMpName || '请选择' }}</view>
        </picker>
      </view>

      <!-- 预存金额 -->
      <view class="form-item" v-if="form.chargeMode === 'PREPAID'">
        <text class="label">预存金额 *</text>
        <picker :range="prepaidOptions" range-key="label" @change="onPrepaidChange">
          <view class="picker">{{ selectedPrepaidName || '请选择' }}</view>
        </picker>
      </view>

      <!-- 单次价格 -->
      <view class="form-item" v-if="form.chargeMode === 'SINGLE'">
        <text class="label">单次价格 *</text>
        <input class="input" v-model.number="form.singlePrice" type="digit" placeholder="价格" />
      </view>
    </view>

    <view class="summary" v-if="amount > 0">
      <text class="summary-label">应收金额</text>
      <text class="summary-amount">￥{{ amount }}</text>
    </view>

    <button class="submit-btn" @click="handleSubmit" :loading="loading">确认开单</button>
  </view>
</template>

<script>
import { api } from '../../api/index.js';
import { BUSINESS_TYPES, CHARGE_MODES, businessTypeName, chargeModeName } from '../../utils/constants.js';

export default {
  data() {
    return {
      memberId: '',
      member: null,
      businessTypes: BUSINESS_TYPES,
      chargeModes: CHARGE_MODES,
      courses: [],
      filteredCourses: [],
      courseDetail: null,
      form: { businessType: '', courseId: '', chargeMode: '', sessionPricingId: '', monthlyPricingId: '', depositAmount: '', singlePrice: '' },
      selectedBusinessName: '',
      selectedCourseName: '',
      selectedChargeModeName: '',
      selectedSpName: '',
      selectedMpName: '',
      selectedPrepaidName: '',
      sessionPricingOptions: [],
      monthlyPricingOptions: [],
      prepaidOptions: [],
      amount: 0,
      loading: false,
    };
  },
  onLoad(options) {
    if (options.memberId) {
      this.memberId = options.memberId;
      this.loadMember();
    }
    this.loadCourses();
  },
  methods: {
    async loadMember() {
      try { this.member = await api.memberDetail(this.memberId); } catch (e) {}
    },
    async loadCourses() {
      try { this.courses = await api.courseList(); } catch (e) {}
    },
    selectMember() {
      uni.navigateTo({ url: '/pages/members/members?select=1' });
    },
    onBusinessChange(e) {
      const b = this.businessTypes[e.detail.value];
      this.form.businessType = b.code;
      this.selectedBusinessName = b.name;
      this.filteredCourses = this.courses.filter((c) => c.business_type === b.code);
      this.form.courseId = '';
      this.selectedCourseName = '';
      this.courseDetail = null;
    },
    async onCourseChange(e) {
      const c = this.filteredCourses[e.detail.value];
      this.form.courseId = c.id;
      this.selectedCourseName = c.name;
      try {
        this.courseDetail = await api.courseDetail(c.id);
        this.sessionPricingOptions = (this.courseDetail.sessionPricing || []).map((sp) => ({
          label: `${sp.sessions}节${sp.gift_sessions ? '+赠' + sp.gift_sessions + '节' : ''} ￥${sp.price}`,
          id: sp.id, price: sp.price,
        }));
        this.monthlyPricingOptions = (this.courseDetail.monthlyPricing || []).map((mp) => ({
          label: `￥${mp.monthly_fee}/月 ${mp.monthly_quota}次`,
          id: mp.id, fee: mp.monthly_fee,
        }));
        this.prepaidOptions = (this.courseDetail.prepaidRules || []).map((r) => ({
          label: `预存￥${r.deposit_amount} 赠￥${r.gift_amount}`,
          amount: r.deposit_amount,
        }));
      } catch (e) {}
    },
    onChargeModeChange(e) {
      const m = this.chargeModes[e.detail.value];
      this.form.chargeMode = m.code;
      this.selectedChargeModeName = m.name;
      this.amount = 0;
    },
    onSpChange(e) {
      const sp = this.sessionPricingOptions[e.detail.value];
      this.form.sessionPricingId = sp.id;
      this.selectedSpName = sp.label;
      this.amount = sp.price;
    },
    onMpChange(e) {
      const mp = this.monthlyPricingOptions[e.detail.value];
      this.form.monthlyPricingId = mp.id;
      this.selectedMpName = mp.label;
      this.amount = mp.fee;
    },
    onPrepaidChange(e) {
      const p = this.prepaidOptions[e.detail.value];
      this.form.depositAmount = p.amount;
      this.selectedPrepaidName = p.label;
      this.amount = p.amount;
    },
    async handleSubmit() {
      if (!this.memberId) { uni.showToast({ title: '请选择会员', icon: 'none' }); return; }
      if (!this.form.businessType || !this.form.chargeMode) { uni.showToast({ title: '请填写完整', icon: 'none' }); return; }
      this.loading = true;
      try {
        const payload = { ...this.form, memberId: this.memberId, confirmed: true };
        const d = await api.createOrder(payload);
        uni.showModal({
          title: '开单成功',
          content: `订单金额: ￥${d.amount}\n提成: ￥${d.commissionAmount || 0}`,
          showCancel: false,
          success: () => uni.navigateBack(),
        });
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
.member-display { font-size: 28rpx; padding: 20rpx; background: #f0f8ff; border-radius: 10rpx; }
.summary { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 16rpx; padding: 30rpx; margin-top: 20rpx; }
.summary-label { font-size: 30rpx; }
.summary-amount { font-size: 40rpx; color: #1890ff; font-weight: bold; }
.submit-btn { background: #1890ff; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 20rpx; }
</style>
