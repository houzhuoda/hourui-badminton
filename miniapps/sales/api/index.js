// 销售端小程序 - API 请求封装
const BASE_URL = 'http://localhost:3100/api';

function getToken() {
  return uni.getStorageSync('sales_token') || '';
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('sales_token');
          uni.removeStorageSync('sales_user');
          uni.reLaunch({ url: '/pages/login/login' });
          reject(new Error('未登录'));
          return;
        }
        if (res.data.code === 0) {
          resolve(res.data.data);
        } else {
          uni.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(new Error(res.data.message));
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}

export const api = {
  // 认证
  login: (data) => request('/auth/sales/login', { method: 'POST', data }),
  // 工作台
  dashboard: () => request('/sales/dashboard'),
  // 会员
  memberList: (params) => request('/members', { data: params }),
  memberDetail: (id) => request(`/members/${id}`),
  createMember: (data) => request('/members', { method: 'POST', data }),
  // 课程
  courseList: () => request('/courses'),
  courseDetail: (id) => request(`/courses/${id}`),
  // 订单
  createOrder: (data) => request('/orders', { method: 'POST', data }),
  orderList: (params) => request('/orders', { data: params }),
  // 业绩
  performance: () => request('/sales/performance'),
  // 提成
  myCommissions: () => request('/commissions/mine'),
  // 渠道
  channels: () => request('/channels'),
};
