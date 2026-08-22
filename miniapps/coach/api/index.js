// 教练端 API
const BASE_URL = 'http://localhost:3100/api';

function getToken() { return uni.getStorageSync('coach_token') || ''; }

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...options.header },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('coach_token'); uni.removeStorageSync('coach_user');
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
  login: (data) => request('/auth/coach/login', { method: 'POST', data }),
  mySchedule: (params) => request('/sessions', { data: params }),
  sessionDetail: (id) => request(`/sessions/${id}`),
  submitAttendance: (sessionId, data) => request(`/attendance/${sessionId}/submit`, { method: 'POST', data }),
  updateAttendance: (sessionId, memberId, data) => request(`/attendance/${sessionId}/attendance/${memberId}`, { method: 'PATCH', data }),
  sessionAttendance: (sessionId) => request(`/attendance/${sessionId}/attendance`),
  myStats: (params) => request('/attendance/stats/coach', { data: params }),
  coachDetail: (id) => request(`/coaches/${id}`),
  // 销售功能（需教练开启 salesEnabled）
  createMember: (data) => request('/members', { method: 'POST', data }),
  memberList: (params) => request('/members', { data: params }),
  courseList: () => request('/courses'),
  courseDetail: (id) => request(`/courses/${id}`),
  createOrder: (data) => request('/orders', { method: 'POST', data }),
  myCommissions: () => request('/commissions/mine'),
};
