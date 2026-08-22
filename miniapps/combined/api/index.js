// 统一 API 封装
const BASE_URL = '/api';

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
        if (res.data.code === 0) resolve(res.data.data);
        else { uni.showToast({ title: res.data.message || '请求失败', icon: 'none' }); reject(new Error(res.data.message)); }
      },
      fail: (err) => { uni.showToast({ title: '网络错误', icon: 'none' }); reject(err); },
    });
  });
}

export const api = {
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
  channels: () => request('/channels'),

  // 教练端
  mySchedule: (params) => request('/sessions', { data: params }),
  sessionDetail: (id) => request(`/sessions/${id}`),
  submitAttendance: (sessionId, data) => request(`/attendance/${sessionId}/submit`, { method: 'POST', data }),
  updateAttendance: (sessionId, memberId, data) => request(`/attendance/${sessionId}/attendance/${memberId}`, { method: 'PATCH', data }),
  sessionAttendance: (sessionId) => request(`/attendance/${sessionId}/attendance`),
  myStats: (params) => request('/attendance/stats/coach', { data: params }),
  coachDetail: (id) => request(`/coaches/${id}`),

  // 教练端 - 私教/陪练预约
  myPrivateBookingsCoach: (params) => request('/private-bookings/private/coach', { data: params }),
  coachCancelPrivate: (id, data) => request(`/private-bookings/private/${id}/coach-cancel`, { method: 'DELETE', data }),
};
