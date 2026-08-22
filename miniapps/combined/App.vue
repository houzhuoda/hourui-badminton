<script>
export default {
  globalData: { role: '', token: '', user: null },
  onLaunch() {
    const role = uni.getStorageSync('role') || '';
    const token = uni.getStorageSync('token') || '';
    let user = null;
    try { user = JSON.parse(uni.getStorageSync('user') || '{}'); } catch (e) { user = {}; }
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.role = role;
      app.globalData.token = token;
      app.globalData.user = user;
    }
  },
};
</script>

<style>
page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
</style>
