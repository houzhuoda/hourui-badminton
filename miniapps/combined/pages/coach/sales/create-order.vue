<template>
  <view class="page">
    <view class="form">
      <view class="form-item"><text class="label">会员 *</text>
        <view class="member-display" v-if="member">{{ member.name }} ({{ member.phone }} )</view>
        <button v-else size="mini" @click="selectMember">选择会员</button>
      </view>
      <view class="form-item"><text class="label">业务类型 *</text>
        <picker :range="businessTypes" range-key="name" @change="onBusiness"><view class="picker">{{ selectedBusinessName || '请选择' }}</view></picker>
      </view>
      <view class="form-item"><text class="label">课程</text>
        <picker :range="filteredCourses" range-key="name" @change="onCourse"><view class="picker">{{ selectedCourseName || '请选择' }}</view></picker>
      </view>
      <view class="form-item"><text class="label">收费模式 *</text>
        <picker :range="chargeModes" range-key="name" @change="onChargeMode"><view class="picker">{{ selectedChargeModeName || '请选择' }}</view></picker>
      </view>
      <view class="form-item" v-if="form.chargeMode === 'SESSION_PACK'"><text class="label">次卡档位 *</text>
        <picker :range="sessionPricingOptions" range-key="label" @change="onSp"><view class="picker">{{ selectedSpName || '请选择' }}</view></picker>
      </view>
      <view class="form-item" v-if="form.chargeMode === 'MONTHLY'"><text class="label">月卡档位 *</text>
        <picker :range="monthlyPricingOptions" range-key="label" @change="onMp"><view class="picker">{{ selectedMpName || '请选择' }}</view></picker>
      </view>
      <view class="form-item" v-if="form.chargeMode === 'PREPAID'"><text class="label">预存金额 *</text>
        <picker :range="prepaidOptions" range-key="label" @change="onPrepaid"><view class="picker">{{ selectedPrepaidName || '请选择' }}</view></picker>
      </view>
    </view>
    <view class="summary" v-if="amount > 0"><text>应收</text><text class="amount">￥{{ amount }}</text></view>
    <button class="submit-btn" @click="submit" :loading="loading">确认开单</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, CHARGE_MODES } from '../../../utils/constants.js';

export default {
  data() { return {
    memberId: '', member: null, businessTypes: BUSINESS_TYPES, chargeModes: CHARGE_MODES,
    courses: [], filteredCourses: [], courseDetail: null,
    form: { businessType: '', courseId: '', chargeMode: '', sessionPricingId: '', monthlyPricingId: '', depositAmount: '' },
    selectedBusinessName: '', selectedCourseName: '', selectedChargeModeName: '',
    selectedSpName: '', selectedMpName: '', selectedPrepaidName: '',
    sessionPricingOptions: [], monthlyPricingOptions: [], prepaidOptions: [],
    amount: 0, loading: false,
  }; },
  onLoad(options) {
    if (options.memberId) { this.memberId = options.memberId; this.loadMember(); }
    api.courseList().then((d) => { this.courses = d; }).catch(() => {});
  },
  methods: {
    async loadMember() { try { this.member = await api.memberList({ keyword: this.memberId }); } catch {} },
    selectMember() { uni.navigateTo({ url: '/pages/coach/sales/create-member' }); },
    onBusiness(e) { const b = this.businessTypes[e.detail.value]; this.form.businessType = b.code; this.selectedBusinessName = b.name; this.filteredCourses = this.courses.filter((c) => c.business_type === b.code); },
    async onCourse(e) { const c = this.filteredCourses[e.detail.value]; this.form.courseId = c.id; this.selectedCourseName = c.name; try { this.courseDetail = await api.courseDetail(c.id); this.sessionPricingOptions = (this.courseDetail.sessionPricing||[]).map((sp)=>({label:`${sp.sessions}节${sp.gift_sessions?'+赠'+sp.gift_sessions+'节':''} ￥${sp.price}`,id:sp.id,price:sp.price})); this.monthlyPricingOptions=(this.courseDetail.monthlyPricing||[]).map((mp)=>({label:`￥${mp.monthly_fee}/月 ${mp.monthly_quota}次`,id:mp.id,fee:mp.monthly_fee})); this.prepaidOptions=(this.courseDetail.prepaidRules||[]).map((r)=>({label:`预存￥${r.deposit_amount} 赠￥${r.gift_amount}`,amount:r.deposit_amount})); } catch {} },
    onChargeMode(e) { const m = this.chargeModes[e.detail.value]; this.form.chargeMode = m.code; this.selectedChargeModeName = m.name; this.amount = 0; },
    onSp(e) { const sp = this.sessionPricingOptions[e.detail.value]; this.form.sessionPricingId = sp.id; this.selectedSpName = sp.label; this.amount = sp.price; },
    onMp(e) { const mp = this.monthlyPricingOptions[e.detail.value]; this.form.monthlyPricingId = mp.id; this.selectedMpName = mp.label; this.amount = mp.fee; },
    onPrepaid(e) { const p = this.prepaidOptions[e.detail.value]; this.form.depositAmount = p.amount; this.selectedPrepaidName = p.label; this.amount = p.amount; },
    async submit() {
      if (!this.memberId || !this.form.businessType || !this.form.chargeMode) { uni.showToast({ title: '请填写完整', icon: 'none' }); return; }
      this.loading = true;
      try { const d = await api.createOrder({ ...this.form, memberId: this.memberId, confirmed: true }); uni.showModal({ title: '开单成功', content: `金额: ￥${d.amount}\n提成: ￥${d.commissionAmount||0}`, showCancel: false, success: () => uni.navigateBack() }); } catch {}
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
.member-display { font-size: 28rpx; padding: 20rpx; background: #f9f0ff; border-radius: 10rpx; }
.summary { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 16rpx; padding: 30rpx; margin-top: 20rpx; }
.amount { font-size: 40rpx; color: #722ed1; font-weight: bold; }
.submit-btn { background: #722ed1; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 20rpx; }
</style>
