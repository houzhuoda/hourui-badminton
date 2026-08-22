// 登录页
import { useMessage } from '../utils/useMessage';
import { Card, Form, Input, Button } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authApi } from '../api';

export default function Login({ onLogin }) {
  const message = useMessage();
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    try {
      const data = await authApi.login(values);
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      message.success('登录成功');
      onLogin();
    } catch (e) {
      message.error(e.message || '登录失败');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card title="侯瑞羽毛球场馆管理系统" style={{ width: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>登录</Button>
          </Form.Item>
        </Form>
        <div style={{ color: '#999', fontSize: 12, textAlign: 'center' }}>默认账号: admin / admin123</div>
      </Card>
    </div>
  );
}
