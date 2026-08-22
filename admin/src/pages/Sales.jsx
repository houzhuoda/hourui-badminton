// 销售管理
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Switch, Tag, Space, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
export default function Sales() {
  const message = useMessage();
  const [data, setData] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form] = Form.useForm();
  const [pwdModal, setPwdModal] = useState(null);
  const [pwdForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try { setData(await api.get('/sales-admin')); } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (edit) {
        await api.put(`/sales-admin/${edit.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/sales-admin', values);
        message.success('新增成功');
      }
      setModal(false); form.resetFields(); setEdit(null); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleStatus = async (id, status) => {
    try { await api.patch(`/sales-admin/${id}/status`, { status }); message.success('已更新'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  const handleReset = async () => {
    try {
      const v = await pwdForm.validateFields();
      await api.patch(`/sales-admin/${pwdModal}/reset-password`, v);
      message.success('密码已重置'); setPwdModal(null); pwdForm.resetFields();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  return (
    <div className="page-container">
      <div className="flex-between mb-16">
        <h2>销售管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEdit(null); setModal(true); }}>新增销售</Button>
      </div>

      <Table loading={loading} dataSource={data.list} rowKey="id" size="small" pagination={false} columns={[
        { title: '姓名', dataIndex: 'name', key: 'name' },
        { title: '手机号', dataIndex: 'phone', key: 'phone' },
        { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '在职' : '停用'}</Tag> },
        { title: '建档时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleString() },
        { title: '操作', key: 'action', render: (_, r) => (
          <Space>
            <Button size="small" type="link" onClick={() => { form.setFieldsValue(r); setEdit(r); setModal(true); }}>编辑</Button>
            <Button size="small" type="link" onClick={() => { setPwdModal(r.id); }}>重置密码</Button>
            {r.status === 'ACTIVE' ? (
              <Popconfirm title="确认停用？" onConfirm={() => handleStatus(r.id, 'DISABLED')}><Button size="small" type="link" danger>停用</Button></Popconfirm>
            ) : (
              <Button size="small" type="link" onClick={() => handleStatus(r.id, 'ACTIVE')}>启用</Button>
            )}
          </Space>
        )},
      ]} />

      <Modal title={edit ? '编辑销售' : '新增销售'} open={modal} onOk={handleSave} onCancel={() => setModal(false)} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, pattern: /^\d{11}$/, message: '11位手机号' }]}><Input /></Form.Item>
          {!edit && <Form.Item name="password" label="初始密码" rules={[{ required: true }]}><Input.Password /></Form.Item>}
          {edit && <Form.Item name="password" label="新密码（留空不修改）"><Input.Password /></Form.Item>}
        </Form>
      </Modal>

      <Modal title="重置密码" open={!!pwdModal} onOk={handleReset} onCancel={() => setPwdModal(null)}>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
