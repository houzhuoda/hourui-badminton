<template>
  <view class="co-page">
    <view class="co-header">
      <text class="co-header-emoji">📝</text>
      <text class="co-header-title">购课开单</text>
    </view>
    <view class="co-form">
      <view class="co-form-item"><text class="co-label">会员 <text class="co-required">*</text></text>
        <view v-if="member" class="co-member-display" @click="changeMember">
          <text>{{ member.name }} ({{ member.phone }})</text>
          <text class="co-member-change">更换</text>
        </view>
        <MemberSearch v-else placeholder="输入姓名或手机号搜索会员" @select="onMemberSelect" />
      </view>
      <view class="co-form-item"><text class="co-label">业务类型 <text class="co-required">*</text></text>
        <SpPicker v-model="form.businessType" :options="businessTypeOptions" title="选择业务类型" @change="onBusinessChange" />
      </view>
      <view class="co-form-item"><text class="co-label">课程</text>
        <SpPicker v-model="form.courseId" :options="courseOptions" title="选择课程" @change="onCourseChange" />
      </view>
      <view class="co-form-item"><text class="co-label">收费模式 <text class="co-required">*</text></text>
        <SpPicker v-model="form.chargeMode" :options="chargeModeOptions" title="选择收费模式" @change="onChargeModeChange" />
      </view>
      <view class="co-form-item" v-if="form.chargeMode === 'SESSION_PACK'"><text class="co-label">次卡档位 <text class="co-required">*</text></text>
        <SpPicker v-model="form.sessionPricingId" :options="sessionPricingOptions" label-key="label" value-key="id" title="选择次卡档位" @change="onSpChange" />
      </view>
      <view class="co-form-item" v-if="form.chargeMode === 'MONTHLY'"><text class="co-label">月卡档位 <text class="co-required">*</text></text>
        <SpPicker v-model="form.monthlyPricingId" :options="monthlyPricingOptions" label-key="label" value-key="id" title="选择月卡档位" @change="onMpChange" />
      </view>
    </view>
    <view class="co-summary" v-if="amount > 0"><text class="co-summary-label">应收</text><text class="co-summary-amount">￥{{ amount }}</text></view>
    <button class="co-submit-btn" @click="submit" :loading="loading">确认开单</button>
  </view>
</template>

<script>
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, CHARGE_MODES, businessTypeName } from '../../../utils/constants.js';
import SpPicker from '../../../components/SpPicker.vue';
import MemberSearch from '../../../components/MemberSearch.vue';

export default {
  components: { SpPicker, MemberSearch },
  data() {
    return {
      memberId: '', member: null,
      businessTypeOptions: BUSINESS_TYPES.map((b) => ({ code: b.code, name: b.name })),
      chargeModeOptions: CHARGE_MODES.map((m) => ({ code: m.code, name: m.name })),
      courses: [], courseOptions: [], courseDetail: null,
      form: { businessType: '', courseId: '', chargeMode: '', sessionPricingId: '', monthlyPricingId: '' },
      sessionPricingOptions: [], monthlyPricingOptions: [],
      amount: 0, loading: false,
    };
  },
  onLoad(options) {
    if (options.memberId) { this.memberId = options.memberId; this.loadMember(); }
    api.courseList().then((d) => { this.courses = d; }).catch(() => {});
  },
  methods: {
    async loadMember() { try { this.member = await api.memberDetail(this.memberId); } catch {} },
    selectMember() { uni.navigateTo({ url: '/pages/coach/sales/create-member' }); },
    onMemberSelect(m) { if (m) { this.memberId = m.id; this.member = m; } },
    changeMember() { this.member = null; this.memberId = ''; },
    onBusinessChange(val) {
      this.courseOptions = this.courses.filter((c) => c.business_type === val).map((c) => ({ code: c.id, name: c.name }));
      this.form.courseId = '';
      this.courseDetail = null;
      this.amount = 0;
    },
    async onCourseChange(val) {
      try {
        this.courseDetail = await api.courseDetail(val);
        this.sessionPricingOptions = (this.courseDetail.sessionPricing || []).map((sp) => {
          let label = `${sp.sessions}节${sp.gift_sessions ? '+赠' + sp.gift_sessions + '节' : ''} ￥${sp.price}`;
          if (sp.extra_gift_business_type && sp.extra_gift_sessions) { label += ` 再赠${businessTypeName(sp.extra_gift_business_type)}${sp.extra_gift_sessions}节`; }
          return { label, id: sp.id, price: sp.price };
        });
        this.monthlyPricingOptions = (this.courseDetail.monthlyPricing || []).map((mp) => {
          let label = `￥${mp.monthly_fee}/月 ${mp.monthly_quota}次`;
          if (mp.extra_gift_business_type && mp.extra_gift_sessions) { label += ` 再赠${businessTypeName(mp.extra_gift_business_type)}${mp.extra_gift_sessions}节`; }
          return { label, id: mp.id, fee: mp.monthly_fee };
        });
      } catch {}
    },
    onChargeModeChange() { this.amount = 0; },
    onSpChange(val, item) { this.amount = item.price; },
    onMpChange(val, item) { this.amount = item.fee; },
    async submit() {
      if (!this.memberId || !this.form.businessType || !this.form.chargeMode) { uni.showToast({ title: '请填写完整', icon: 'none' }); return; }
      this.loading = true;
      try {
        const d = await api.createOrder({ ...this.form, memberId: this.memberId, confirmed: true });
        uni.showModal({ title: '开单成功', content: `金额: ￥${d.amount}\n提成: ￥${d.commissionAmount || 0}`, showCancel: false, success: () => uni.navigateBack() });
      } catch (e) {
        uni.showToast({ title: e.message || '开单失败', icon: 'none' });
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.co-page { padding: 32rpx; background: var(--sp-bg); min-height: 100vh; }

/* Header */
.co-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 24rpx; }
.co-header-emoji { font-size: 40rpx; }
.co-header-title { font-size: 36rpx; font-weight: 800; color: var(--sp-orange); }

/* Form */
.co-form { background: var(--card); border-radius: 28rpx; padding: 28rpx; box-shadow: var(--sp-shadow); }
.co-form-item { margin-bottom: 28rpx; }
.co-form-item:last-child { margin-bottom: 0; }
.co-label { font-size: 28rpx; font-weight: 600; color: var(--text); margin-bottom: 12rpx; display: block; }
.co-required { color: var(--sp-red); font-weight: 700; }
.co-member-display { font-size: 28rpx; padding: 20rpx 24rpx; background: var(--sp-bg-warm); border-radius: 16rpx; color: var(--text); font-weight: 600; border: 2rpx solid rgba(255,77,40,0.15); display: flex; justify-content: space-between; align-items: center; }
.co-member-change { color: var(--sp-orange); font-size: 26rpx; }

/* Summary */
.co-summary { display: flex; justify-content: space-between; align-items: center; background: var(--card); border-radius: 28rpx; padding: 28rpx 32rpx; margin-top: 24rpx; box-shadow: var(--sp-shadow); }
.co-summary-label { font-size: 28rpx; color: var(--text-sec); font-weight: 600; }
.co-summary-amount { font-size: 44rpx; color: var(--sp-orange); font-weight: 800; }

/* Submit button */
.co-submit-btn { background: var(--grad-orange) !important; color: #fff !important; border-radius: 100rpx !important; height: 96rpx; line-height: 96rpx; font-size: 32rpx; font-weight: 700; margin-top: 24rpx; box-shadow: var(--sp-shadow-orange); }
.co-submit-btn:active { transform: scale(0.97); }
</style>
