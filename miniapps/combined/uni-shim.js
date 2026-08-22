// uni API 兼容层 - 在浏览器中模拟 uni-app API
const storage = window.localStorage;

export const uni = {
  getStorageSync(key) { return storage.getItem(key) || ''; },
  setStorageSync(key, val) { storage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); },
  removeStorageSync(key) { storage.removeItem(key); },
  showToast(opts) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999;pointer-events:none;';
    el.textContent = opts.title || '';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  },
  showModal(opts) {
    const msg = opts.content || opts.title || '';
    if (opts.showCancel === false) { alert(msg); opts.success && opts.success({ confirm: true }); return; }
    if (confirm(msg)) opts.success && opts.success({ confirm: true });
    else opts.success && opts.success({ cancel: true });
  },
  request(opts) {
    const headers = { 'Content-Type': 'application/json', ...opts.header };
    const method = (opts.method || 'GET').toUpperCase();
    let url = opts.url;
    let body;

    if (method === 'GET') {
      // GET 请求：把 data 拼成 query string
      if (opts.data && typeof opts.data === 'object') {
        const params = new URLSearchParams();
        let hasParam = false;
        for (const [k, v] of Object.entries(opts.data)) {
          if (v !== undefined && v !== null && v !== '') { params.append(k, v); hasParam = true; }
        }
        if (hasParam) url += (url.includes('?') ? '&' : '?') + params.toString();
      }
    } else {
      // POST/PUT/DELETE：data 放 body
      body = opts.data ? JSON.stringify(opts.data) : undefined;
    }

    fetch(url, { method, headers, body })
      .then(async (res) => {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { code: -1, message: text }; }
        if (res.status === 401 && opts.success) { opts.success({ statusCode: 401, data }); return; }
        if (res.status >= 400) {
          const msg = (data && data.message) || `请求失败(${res.status})`;
          if (opts.success) opts.success({ statusCode: res.status, data: { code: res.status, message: msg } });
          return;
        }
        if (opts.success) opts.success({ statusCode: res.status, data });
      })
      .catch((err) => { if (opts.fail) opts.fail(err); });
  },
  navigateTo(opts) { window.location.hash = opts.url; },
  reLaunch(opts) { window.location.hash = opts.url; },
  switchTab(opts) { window.location.hash = opts.url; },
  navigateBack() { window.history.back(); },
};

export function getApp() {
  return { globalData: { role: '', token: '', user: null } };
}
