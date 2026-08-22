// 主布局：侧边栏 + 顶栏
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const menuItems = [
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

export default function MainLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    onLogout();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ height: 64, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 'bold' }}>
          侯瑞羽毛球系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Dropdown menu={{ items: [{ key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout }] }}>
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
    </Layout>
  );
}
