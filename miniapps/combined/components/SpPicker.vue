<template>
  <view class="sp-picker" @click="open">
    <text class="sp-picker-text" :class="{ placeholder: !displayText || displayText === placeholder }">{{ displayText }}</text>
    <text class="sp-picker-arrow">▾</text>

    <view v-if="visible" class="sp-mask" @click="close">
      <view class="sp-sheet" @click.stop>
        <view class="sp-sheet-handle"></view>
        <view class="sp-sheet-header">
          <text class="sp-sheet-title">{{ title || '请选择' }}</text>
          <text class="sp-sheet-close" @click="close">✕</text>
        </view>
        <scroll-view scroll-y class="sp-sheet-body">
          <view
            v-for="(item, idx) in options"
            :key="idx"
            class="sp-option"
            :class="{ active: getValue(item) === modelValue }"
            @click="select(item)"
          >
            <text class="sp-option-text">{{ getLabel(item) }}</text>
            <text v-if="getValue(item) === modelValue" class="sp-check">✓</text>
          </view>
          <view v-if="options.length === 0" class="sp-empty">暂无选项</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
    labelKey: { type: String, default: 'name' },
    valueKey: { type: String, default: 'code' },
    placeholder: { type: String, default: '请选择' },
    title: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return { visible: false };
  },
  computed: {
    displayText() {
      if (!this.modelValue) return this.placeholder;
      const item = this.options.find((o) => this.getValue(o) === this.modelValue);
      return item ? this.getLabel(item) : this.placeholder;
    },
  },
  methods: {
    getValue(item) {
      return typeof item === 'object' ? item[this.valueKey] : item;
    },
    getLabel(item) {
      return typeof item === 'object' ? item[this.labelKey] : item;
    },
    open() { this.visible = true; },
    close() { this.visible = false; },
    select(item) {
      const val = this.getValue(item);
      this.$emit('update:modelValue', val);
      this.$emit('change', val, item);
      this.visible = false;
    },
  },
};
</script>

<style scoped>
.sp-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 96rpx;
  border: 2rpx solid var(--border, #EEF0F3);
  border-radius: 20rpx;
  padding: 0 28rpx;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s ease;
}
.sp-picker:active {
  border-color: var(--sp-orange, #FF4D28);
  box-shadow: 0 0 0 6rpx rgba(255, 77, 40, 0.08);
}
.sp-picker-text {
  font-size: 30rpx;
  color: var(--text, #0F172A);
  font-weight: 500;
}
.sp-picker-text.placeholder {
  color: var(--sp-gray-light, #9CA3AF);
  font-weight: 400;
}
.sp-picker-arrow {
  font-size: 24rpx;
  color: var(--sp-gray-light, #9CA3AF);
  margin-left: 12rpx;
}

.sp-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}
.sp-sheet {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  animation: sp-slide-up 0.25s ease;
}
@keyframes sp-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sp-sheet-handle {
  width: 64rpx;
  height: 8rpx;
  background: #E5E7EB;
  border-radius: 100rpx;
  margin: 20rpx auto 0;
}
.sp-sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #F3F4F6;
}
.sp-sheet-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text, #0F172A);
}
.sp-sheet-close {
  font-size: 32rpx;
  color: var(--sp-gray, #6B7280);
  cursor: pointer;
  padding: 8rpx;
}
.sp-sheet-body {
  max-height: 56vh;
  overflow-y: auto;
  padding: 8rpx 0 32rpx;
}
.sp-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  cursor: pointer;
  transition: background 0.15s ease;
}
.sp-option:active {
  background: var(--sp-bg-warm, #FFF5F0);
}
.sp-option.active {
  background: rgba(255, 77, 40, 0.06);
}
.sp-option-text {
  font-size: 30rpx;
  color: var(--text, #0F172A);
  font-weight: 500;
}
.sp-option.active .sp-option-text {
  color: var(--sp-orange, #FF4D28);
  font-weight: 700;
}
.sp-check {
  color: var(--sp-orange, #FF4D28);
  font-size: 36rpx;
  font-weight: 700;
}
.sp-empty {
  text-align: center;
  color: var(--sp-gray-light, #9CA3AF);
  padding: 80rpx;
  font-size: 28rpx;
}
</style>
