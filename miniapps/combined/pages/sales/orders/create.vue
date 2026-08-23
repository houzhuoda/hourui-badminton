<template>
  <view class="page">
    <view class="form">
      <view class="form-item">
        <text class="label">会员 *</text>
        <view v-if="member" class="member-display" @click="changeMember">
          {{ member.name }} ({{ member.phone }})
          <text class="member-change">更换</text>
        </view>
        <MemberSearch v-else placeholder="输入姓名或手机号搜索会员" @select="onMemberSelect" />
      </view>

      <view class="form-item">
        <text class="label">业务类型 *</text>
        <SpPicker v-model="form.businessType" :options="businessTypeOptions" title="选择业务类型" @change="onBusinessChange" />
      </view>

      <view class="form-item">
        <text class="label">课程</text>
        <SpPicker v-model="form.courseId" :options="courseOptions" title="选择课程" @change="onCourseChange" />
      </view>

      <view class="form-item">
        <text class="label">收费模式 *</text>
        <SpPicker v-model="form.chargeMode" :options="chargeModeOptions" title="选择收费模式" @change="onChargeModeChange" />
      </view>

      <!-- 次卡档位 -->
      <view class="form-item" v-if="form.chargeMode === 'SESSION_PACK'">
        <text class="label">次卡档位 *</text>
        <SpPicker v-model="form.sessionPricingId" :options="sessionPricingOptions" label-key="label" value-key="id" title="选择次卡档位" @change="onSpChange" />
      </view>

      <!-- 月卡档位 -->
      <view class="form-item" v-if="form.chargeMode === 'MONTHLY'">
        <text class="label">月卡档位 *</text>
        <SpPicker v-model="form.monthlyPricingId" :options="monthlyPricingOptions" label-key="label" value-key="id" title="选择月卡档位" @change="onMpChange" />
      </view>

      <!-- 单次价格 -->
      <view class="form-item" v-if="form.chargeMode === 'SINGLE'">
        <text class="label">单次价格 *</text>
        <input class="input" v-model.number="form.singlePrice" type="digit" placeholder="请输入价格" />
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
import { api } from '../../../api/index.js';
import { BUSINESS_TYPES, CHARGE_MODES, businessTypeName, chargeModeName } from '../../../utils/constants.js';
import SpPicker from '../../../components/SpPicker.vue';
import MemberSearch from '../../../components/MemberSearch.vue';

export default {
  components: { SpPicker, MemberSearch },
  data() {
    return {
      memberId: '',
      member: null,
      businessTypeOptions: BUSINESS_TYPES.map((b) => ({ code: b.code, name: b.name })),
      chargeModeOptions: CHARGE_MODES.map((m) => ({ code: m.code, name: m.name })),
      courses: [],
      courseOptions: [],
      courseDetail: null,
      form: { businessType: '', courseId: '', chargeMode: '', sessionPricingId: '', monthlyPricingId: '', singlePrice: '' },
      sessionPricingOptions: [],
      monthlyPricingOptions: [],
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
      uni.navigateTo({ url: '/pages/sales/members/members?select=1' });
    },
    onMemberSelect(m) {
      if (m) { this.memberId = m.id; this.member = m; }
    },
    changeMember() {
      this.member = null; this.memberId = '';
    },
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
          if (sp.extra_gift_business_type && sp.extra_gift_sessions) {
            const btName = businessTypeName(sp.extra_gift_business_type);
            label += ` 再赠${btName}${sp.extra_gift_sessions}节`;
          }
          return { label, id: sp.id, price: sp.price };
        });
        this.monthlyPricingOptions = (this.courseDetail.monthlyPricing || []).map((mp) => {
          let label = `￥${mp.monthly_fee}/月 ${mp.monthly_quota}次`;
          if (mp.extra_gift_business_type && mp.extra_gift_sessions) {
            const btName = businessTypeName(mp.extra_gift_business_type);
            label += ` 再赠${btName}${mp.extra_gift_sessions}节`;
          }
          return { label, id: mp.id, fee: mp.monthly_fee };
        });
      } catch (e) {}
    },
    onChargeModeChange() {
      this.amount = 0;
    },
    onSpChange(val, item) {
      this.amount = item.price;
    },
    onMpChange(val, item) {
      this.amount = item.fee;
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
      } catch (e) {
        uni.showToast({ title: e.message || '开单失败', icon: 'none' });
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped>
.page { padding: 20rpx; }
.form { background: #fff; border-radius: 16rpx; padding: 20rpx; }
.form-item { margin-bottom: 24rpx; }
.form-item .label { font-size: 28rpx; color: #333; margin-bottom: 10rpx; display: block; }
.input { height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; }
.member-display { font-size: 28rpx; padding: 20rpx; background: #f0f8ff; border-radius: 10rpx; display: flex; justify-content: space-between; align-items: center; }
.member-change { color: #1890ff; font-size: 26rpx; }
.summary { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 16rpx; padding: 30rpx; margin-top: 20rpx; }
.summary-label { font-size: 30rpx; }
.summary-amount { font-size: 40rpx; color: #1890ff; font-weight: bold; }
.submit-btn { background: #1890ff; color: #fff; border-radius: 10rpx; height: 90rpx; line-height: 90rpx; font-size: 32rpx; margin-top: 20rpx; }
</style>
