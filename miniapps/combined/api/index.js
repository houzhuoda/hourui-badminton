// 统一 API 封装
// 部署在子路径时使用 /hourui/api，本地开发使用 /api
const BASE_URL = (typeof window !== 'undefined' && window.location.pathname.includes('/hourui/')) ? '/hourui/api' : '/api';

function getToken() { return uni.getStorageSync('token') || ''; }

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...options.header },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.removeStorageSync('user');
          uni.removeStorageSync('role');
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.token = '';
            app.globalData.user = null;
            app.globalData.role = '';
          }
          uni.reLaunch({ url: '/pages/member/login/login' });
          reject(new Error('未登录'));
          return;
        }
        if (res.statusCode === 403) {
          // 业务层面的 403（如 NO_PACK 无课包）需要携带 data 给调用方处理
          if (res.data && res.data.message === 'NO_PACK') {
            const err = new Error(res.data.message);
            err.data = res.data.data;
            err.code = res.data.code;
            reject(err);
            return;
          }
          // 权限不足：身份切换后 token 角色不匹配，引导重新登录
          const msg = (res.data && res.data.message) || '无权限';
          reject(new Error(msg));
          setTimeout(() => {
            uni.showModal({
              title: '权限不足',
              content: '当前身份无法执行此操作，请重新登录会员账号',
              confirmText: '重新登录',
              success: (r) => {
                if (r.confirm) {
                  uni.removeStorageSync('token');
                  uni.removeStorageSync('user');
                  uni.removeStorageSync('role');
                  const app = getApp();
                  if (app && app.globalData) {
                    app.globalData.token = '';
                    app.globalData.user = null;
                    app.globalData.role = '';
                  }
                  uni.reLaunch({ url: '/pages/member/login/login' });
                }
              },
            });
          }, 100);
          return;
        }
        if (res.data.code === 0) resolve(res.data.data);
        else {
          // 携带 data 供调用方判断（如 NO_PACK 场景）
          const err = new Error(res.data.message);
          err.data = res.data.data;
          err.code = res.data.code;
          reject(err);
        }
      },
      fail: (err) => { reject(err); },
    });
  });
}

export const api = {
  // 通用 GET
  get: (url, params) => request(url, { data: params }),
  // 认证（按角色）
  sendCode: (data) => request('/auth/member/send-code', { method: 'POST', data }),
  login: (role, data) => {
    const paths = {
      member: '/auth/member/login',
      sales: '/auth/sales/login',
      coach: '/auth/coach/login',
    };
    const p = paths[role];
    if (!p) { uni.showToast({ title: '无效角色', icon: 'none' }); return Promise.reject(new Error('无效角色')); }
    return request(p, { method: 'POST', data });
  },
  memberRegister: (data) => request('/auth/member/register', { method: 'POST', data }),
  memberPasswordLogin: (data) => request('/auth/member/password-login', { method: 'POST', data }),
  memberWechatLogin: (data) => request('/auth/member/wechat-login', { method: 'POST', data }),
  switchIdentity: (targetRole) => request('/auth/switch-identity', { method: 'POST', data: { targetRole } }),
  switchableRoles: () => request('/auth/switchable-roles'),

  // 会员端
  myAssets: () => request('/member-end/my-assets'),
  myBookings: (params) => request('/bookings/mine', { data: params }),
  myConsumption: () => request('/member-end/my-consumption'),
  myAttendance: () => request('/member-end/my-attendance'),
  availableSessions: (params) => request('/bookings/available', { data: params }),
  bookSession: (data) => request('/bookings', { method: 'POST', data }),
  cancelBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),

  // 私教/陪练预约
  coachList: (params) => request('/coaches', { data: params }),
  coachAvailableSlots: (coachId, params) => request(`/private-bookings/${coachId}/available-slots`, { data: params }),
  bookPrivate: (data) => request('/private-bookings/private', { method: 'POST', data }),
  cancelPrivateBooking: (id) => request(`/private-bookings/private/${id}`, { method: 'DELETE' }),
  myPrivateBookings: () => request('/private-bookings/private/mine'),

  // 销售端
  dashboard: () => request('/sales/dashboard'),
  memberList: (params) => request('/members', { data: params }),
  memberDetail: (id) => request(`/members/${id}`),
  createMember: (data) => request('/members', { method: 'POST', data }),
  courseList: () => request('/courses'),
  courseDetail: (id) => request(`/courses/${id}`),
  createOrder: (data) => request('/orders', { method: 'POST', data }),
  orderList: (params) => request('/orders', { data: params }),
  performance: () => request('/sales/performance'),
  myCommissions: () => request('/commissions/mine'),
  myPayouts: () => request('/commissions/payouts'),
  channels: () => request('/channels'),
  channelStats: (params) => request('/channels/stats/summary', { data: params }),
  memberSearch: (keyword) => request('/members/search', { data: { keyword } }),

  // 教练端
  mySchedule: (params) => request('/sessions', { data: params }),
  sessionDetail: (id) => request(`/sessions/${id}`),
  submitAttendance: (sessionId, data) => request(`/attendance/${sessionId}/submit`, { method: 'POST', data }),
  updateAttendance: (sessionId, memberId, data) => request(`/attendance/${sessionId}/attendance/${memberId}`, { method: 'PATCH', data }),
  sessionAttendance: (sessionId) => request(`/attendance/${sessionId}/attendance`),
  myStats: (params) => request('/attendance/stats/coach', { data: params }),
  myAttendanceDetail: (params) => request('/attendance/my-detail', { data: params }),
  coachDetail: (id) => request(`/coaches/${id}`),

  // 教练端 - 私教/陪练预约
  myPrivateBookingsCoach: (params) => request('/private-bookings/private/coach', { data: params }),
  coachCancelPrivate: (id, data) => request(`/private-bookings/private/${id}/coach-cancel`, { method: 'DELETE', data }),
};
