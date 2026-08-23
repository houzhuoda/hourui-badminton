<template>
  <view>
    <Dashboard />
    <CoachTabBar active="sales" />
  </view>
</template>
<script>
import Dashboard from '../../sales/dashboard/dashboard.vue';
import CoachTabBar from '../../../components/CoachTabBar.vue';
export default {
  components: { Dashboard, CoachTabBar },
  name: 'CoachSalesDashboard',
};
</script>
