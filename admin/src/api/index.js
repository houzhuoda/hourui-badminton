// API 请求封装
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.BASE_URL.replace(/\/admin\/$/, '/api/'),
  timeout: 10000,
});

// 请求拦截：附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一处理
api.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data;
    if (code === 0) return data;
    return Promise.reject(new Error(message || '请求失败'));
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = import.meta.env.BASE_URL + 'login';
    }
    const msg = error.response?.data?.message || error.message;
    return Promise.reject(new Error(msg));
  }
);

export default api;

// 认证
export const authApi = {
  login: (data) => axios.post(`${import.meta.env.BASE_URL.replace(/\/admin\/$/, '/api/')}auth/login`, data).then((r) => r.data.data),
};

// 通用 CRUD 辅助
export function createApi(baseUrl) {
  return {
    list: (params) => api.get(baseUrl, { params }),
    detail: (id) => api.get(`${baseUrl}/${id}`),
    create: (data) => api.post(baseUrl, data),
    update: (id, data) => api.put(`${baseUrl}/${id}`, data),
    remove: (id) => api.delete(`${baseUrl}/${id}`),
  };
}
