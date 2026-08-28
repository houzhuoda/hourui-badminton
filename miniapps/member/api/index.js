// 会员端 API
const BASE_URL = 'http://localhost:3100/api';

function getToken() { return uni.getStorageSync('member_token') || ''; }

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...options.header },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('member_token'); uni.removeStorageSync('member_user');
          uni.reLaunch({ url: '/pages/login/login' }); reject(new Error('未登录')); return;
        }
        if (res.data.code === 0) resolve(res.data.data);
        else { uni.showToast({ title: res.data.message || '请求失败', icon: 'none' }); reject(new Error(res.data.message)); }
      },
      fail: (err) => { uni.showToast({ title: '网络错误', icon: 'none' }); reject(err); },
    });
  });
}

export const api = {
  sendCode: (data) => request('/auth/member/send-code', { method: 'POST', data }),
  login: (data) => request('/auth/member/login', { method: 'POST', data }),
  memberPasswordLogin: (data) => request('/auth/member/password-login', { method: 'POST', data }),
  memberRegister: (data) => request('/auth/member/register', { method: 'POST', data }),
  myAssets: () => request('/member-end/my-assets'),
  myBookings: () => request('/member-end/my-bookings'),
  myConsumption: (params) => request('/member-end/my-consumption', { data: params }),
  myAttendance: (params) => request('/member-end/my-attendance', { data: params }),
  availableSessions: (params) => request('/bookings/available', { data: params }),
  bookSession: (data) => request('/bookings', { method: 'POST', data }),
  cancelBooking: (id, data) => request(`/bookings/${id}`, { method: 'DELETE', data }),
  requestLeave: (data) => request('/member-end/leave-request', { method: 'POST', data }),
  leaveTypes: () => request('/member-end/leave-types'),
  myInfo: () => request('/member-end/my-info'),
  courses: (params) => request('/courses', { data: params }),
};
