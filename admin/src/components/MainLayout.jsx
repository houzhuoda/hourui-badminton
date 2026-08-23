// 主布局：侧边栏 + 顶栏（支持菜单拖拽排序）
import { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Tooltip, Modal, Form, Input, message } from 'antd';
import { UserOutlined, LogoutOutlined, HolderOutlined, KeyOutlined, EditOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const { Header, Sider, Content } = Layout;

const DEFAULT_MENU = [
  { key: '/', label: '经营看板' },
  { key: '/members', label: '会员管理' },
  { key: '/courses', label: '课程与定价' },
  { key: '/schedule-private', label: '私教/陪练排班' },
  { key: '/schedule-group', label: '大课排课' },
  { key: '/schedule-community', label: '群活动排课' },
  { key: '/coaches', label: '教练管理' },
  { key: '/courts', label: '场地管理' },
  { key: '/commissions', label: '销售提成设置' },
  { key: '/sales', label: '销售管理' },
  { key: '/channels', label: '渠道来源' },
  { key: '/orders', label: '订单管理' },
  { key: '/reports', label: '统计报表' },
  { key: '/member-end-config', label: '会员端配置' },
];

const STORAGE_KEY = 'admin_menu_order';

// 读取保存的排序，合并新增菜单项
function loadMenuOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_MENU;
    const savedKeys = new Set(saved);
    const ordered = saved.map((k) => DEFAULT_MENU.find((m) => m.key === k)).filter(Boolean);
    // 追加新增的菜单项
    for (const item of DEFAULT_MENU) {
      if (!savedKeys.has(item.key)) ordered.push(item);
    }
    return ordered;
  } catch {
    return DEFAULT_MENU;
  }
}

function saveMenuOrder(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((m) => m.key)));
}

export default function MainLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
  const [menuItems, setMenuItems] = useState(() => loadMenuOrder());
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const dragIndexRef = useRef(null);
  const [profileModal, setProfileModal] = useState(false);
  const [profileType, setProfileType] = useState('info'); // 'info' | 'password'
  const [profileForm] = Form.useForm();
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setMenuItems(loadMenuOrder());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    onLogout();
  };

  const openProfile = (type) => {
    setProfileType(type);
    profileForm.resetFields();
    if (type === 'info') profileForm.setFieldsValue({ name: user.name || '' });
    setProfileModal(true);
  };

  const handleProfileSave = async () => {
    try {
      const values = await profileForm.validateFields();
      setProfileLoading(true);
      if (profileType === 'info') {
        const d = await api.post('/admin/update-profile', { name: values.name });
        localStorage.setItem('admin_token', d.token);
        localStorage.setItem('admin_user', JSON.stringify(d.user));
        message.success('信息修改成功');
      } else {
        await api.post('/admin/change-password', { oldPassword: values.oldPassword, newPassword: values.newPassword });
        message.success('密码修改成功');
      }
      setProfileModal(false);
      profileForm.resetFields();
    } catch (e) {
      if (e.message) message.error(e.message);
    }
    setProfileLoading(false);
  };

  // 拖拽排序
  const onDragStart = (index) => {
    dragIndexRef.current = index;
    setDragIndex(index);
  };
  const onDragOver = (e, index) => {
    e.preventDefault();
    if (overIndex !== index) setOverIndex(index);
  };
  const onDrop = (index) => {
    const from = dragIndexRef.current;
    if (from === null || from === index) { setDragIndex(null); setOverIndex(null); return; }
    setMenuItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      saveMenuOrder(next);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  };
  const onDragEnd = () => { setDragIndex(null); setOverIndex(null); dragIndexRef.current = null; };

  // 自定义渲染菜单项，加拖拽手柄
  const renderMenuItems = menuItems.map((item, index) => ({
    ...item,
    icon: <HolderOutlined style={{ cursor: 'grab', color: '#888', fontSize: 12 }} />,
    label: (
      <span
        draggable
        onDragStart={() => onDragStart(index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDrop={() => onDrop(index)}
        onDragEnd={onDragEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: dragIndex === index ? 0.4 : 1,
          background: overIndex === index && dragIndex !== null ? 'rgba(24,144,255,0.15)' : 'transparent',
          borderRadius: 4,
          padding: '0 4px',
          transition: 'background 0.2s',
        }}
      >
        <span>{item.label}</span>
      </span>
    ),
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ height: 64, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 'bold' }}>
          侯瑞羽毛球系统
        </div>
        <Tooltip title="拖动菜单项可调整顺序" placement="right" color="#1890ff">
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 4, cursor: 'help' }}>
            ⠿ 拖拽排序
          </div>
        </Tooltip>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={renderMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Dropdown menu={{ items: [
            { key: 'info', label: '修改信息', icon: <EditOutlined />, onClick: () => openProfile('info') },
            { key: 'password', label: '修改密码', icon: <KeyOutlined />, onClick: () => openProfile('password') },
            { type: 'divider' },
            { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout },
          ] }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user.name || '管理员'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 0, background: '#f5f5f5', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
      <Modal
        title={profileType === 'info' ? '修改信息' : '修改密码'}
        open={profileModal}
        onOk={handleProfileSave}
        onCancel={() => { setProfileModal(false); profileForm.resetFields(); }}
        confirmLoading={profileLoading}
        okText="保存"
      >
        {profileType === 'info' ? (
          <Form form={profileForm} layout="vertical">
            <Form.Item name="name" label="管理员姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item label="用户名">
              <Input value={user.username || ''} disabled />
            </Form.Item>
          </Form>
        ) : (
          <Form form={profileForm} layout="vertical">
            <Form.Item name="oldPassword" label="旧密码" rules={[{ required: true, message: '请输入旧密码' }]}>
              <Input.Password placeholder="请输入旧密码" />
            </Form.Item>
            <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
              <Input.Password placeholder="请输入新密码（至少6位）" />
            </Form.Item>
            <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({ validator: (_, value) => (!value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('两次密码不一致'))) }),
            ]}>
              <Input.Password placeholder="请再次输入新密码" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Layout>
  );
}
