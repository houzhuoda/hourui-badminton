import { createApp, h, defineComponent, reactive, markRaw } from 'vue';
import { uni as uniApi, getApp } from './uni-shim.js';

// 全局注入 uni 和 getApp
window.uni = uniApi;
window.getApp = getApp;

// 手动导入所有页面
import RoleSelect from './pages/role-select/role-select.vue';
import Login from './pages/login/login.vue';
import MemberLogin from './pages/member/login/login.vue';
import SwitchRole from './pages/switch-role/switch-role.vue';
import MemberAssets from './pages/member/assets/assets.vue';
import MemberBooking from './pages/member/booking/booking.vue';
import MemberPrivateBooking from './pages/member/booking/private.vue';
import MemberBookingDetail from './pages/member/booking/detail.vue';
import MemberBookings from './pages/member/bookings/bookings.vue';
import MemberHistory from './pages/member/history/history.vue';
import MemberProfile from './pages/member/profile/profile.vue';
import MemberOrders from './pages/member/orders/orders.vue';
import SalesDashboard from './pages/sales/dashboard/dashboard.vue';
import SalesMembers from './pages/sales/members/members.vue';
import SalesMemberCreate from './pages/sales/members/create.vue';
import SalesMemberDetail from './pages/sales/members/detail.vue';
import SalesOrderCreate from './pages/sales/orders/create.vue';
import SalesOrderList from './pages/sales/orders/list.vue';
import SalesPerformance from './pages/sales/performance/performance.vue';
import CoachSchedule from './pages/coach/schedule/schedule.vue';
import CoachAttendance from './pages/coach/attendance/attendance.vue';
import CoachStats from './pages/coach/stats/stats.vue';
import CoachCreateMember from './pages/coach/sales/create-member.vue';
import CoachCreateOrder from './pages/coach/sales/create-order.vue';
import CoachPrivateBookings from './pages/coach/private-bookings/private-bookings.vue';
import CoachSalesDashboard from './pages/coach/sales/dashboard.vue';
import CoachSalesMembers from './pages/coach/sales/members.vue';
import CoachSalesMemberDetail from './pages/coach/sales/member-detail.vue';
import CoachSalesOrders from './pages/coach/sales/orders.vue';
import CoachSalesPerformance from './pages/coach/sales/performance.vue';
import CoachSalesChannels from './pages/coach/sales/channels.vue';
import SalesChannels from './pages/sales/channels/channels.vue';

// 路由表：所有 key 都带 /pages/ 前缀
const routes = markRaw({
  '/pages/role-select/role-select': RoleSelect,
  '/pages/login/login': Login,
  '/pages/member/login/login': MemberLogin,
  '/pages/switch-role/switch-role': SwitchRole,
  '/pages/member/assets/assets': MemberAssets,
  '/pages/member/booking/booking': MemberBooking,
  '/pages/member/booking/private': MemberPrivateBooking,
  '/pages/member/booking/detail': MemberBookingDetail,
  '/pages/member/bookings/bookings': MemberBookings,
  '/pages/member/history/history': MemberHistory,
  '/pages/member/profile/profile': MemberProfile,
  '/pages/member/orders/orders': MemberOrders,
  '/pages/sales/dashboard/dashboard': SalesDashboard,
  '/pages/sales/members/members': SalesMembers,
  '/pages/sales/members/create': SalesMemberCreate,
  '/pages/sales/members/detail': SalesMemberDetail,
  '/pages/sales/orders/create': SalesOrderCreate,
  '/pages/sales/orders/list': SalesOrderList,
  '/pages/sales/performance/performance': SalesPerformance,
  '/pages/sales/channels/channels': SalesChannels,
  '/pages/coach/schedule/schedule': CoachSchedule,
  '/pages/coach/attendance/attendance': CoachAttendance,
  '/pages/coach/stats/stats': CoachStats,
  '/pages/coach/sales/create-member': CoachCreateMember,
  '/pages/coach/sales/create-order': CoachCreateOrder,
  '/pages/coach/private-bookings/private-bookings': CoachPrivateBookings,
  '/pages/coach/sales/dashboard': CoachSalesDashboard,
  '/pages/coach/sales/members': CoachSalesMembers,
  '/pages/coach/sales/member-detail': CoachSalesMemberDetail,
  '/pages/coach/sales/orders': CoachSalesOrders,
  '/pages/coach/sales/performance': CoachSalesPerformance,
  '/pages/coach/sales/channels': CoachSalesChannels,
});

const RouterView = defineComponent({
  setup() {
    const route = reactive({ path: '/pages/member/login/login', query: {}, component: null });

    function navigate() {
      let hash = window.location.hash.slice(1) || '/pages/member/login/login';
      if (!hash.startsWith('/')) hash = '/' + hash;
      const qIdx = hash.indexOf('?');
      const path = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
      const queryStr = qIdx >= 0 ? hash.slice(qIdx + 1) : '';
      const query = {};
      new URLSearchParams(queryStr).forEach((v, k) => { query[k] = v; });
      route.path = path;
      route.query = query;
      route.component = routes[path] ? markRaw(routes[path]) : null;
      window.scrollTo(0, 0);
    }

    window.addEventListener('hashchange', navigate);
    navigate();

    return () => {
      if (!route.component) return h('div', { style: 'display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;color:#f00;' }, [
        h('p', null, '页面未找到: ' + route.path),
        h('button', { onClick: () => { window.location.hash = '/pages/member/login/login'; }, style: 'margin-top:20px;padding:10px 20px;background:#13c2c2;color:#fff;border:none;border-radius:8px;cursor:pointer;' }, '返回首页'),
      ]);
      return h(route.component, { query: route.query });
    };
  },
});

const App = defineComponent({
  setup() {
    return () => h('div', { id: 'app-container', style: 'max-width:500px;margin:0 auto;min-height:100vh;background:var(--bg);position:relative;overflow-x:hidden;' }, [
      h(RouterView),
    ]);
  },
});

const app = createApp(App);

// 全局 mixin：兼容 uni-app 的 onLoad / onShow / onUnload 生命周期
// uni-app 把 onLoad/onShow/onUnload 定义在组件顶层，Vue 3 不认识它们，
// 需要通过 this.$options 访问并在 mounted 时手动调用
app.mixin({
  props: { query: { type: Object, default: () => ({}) } },
  mounted() {
    const opts = this.$options;
    if (typeof opts.onLoad === 'function') opts.onLoad.call(this, this.query || {});
    if (typeof opts.onShow === 'function') opts.onShow.call(this);
  },
  activated() {
    const opts = this.$options;
    if (typeof opts.onShow === 'function') opts.onShow.call(this);
  },
  unmounted() {
    const opts = this.$options;
    if (typeof opts.onUnload === 'function') opts.onUnload.call(this);
  },
});

app.mount('#app');
// build 1787463415
