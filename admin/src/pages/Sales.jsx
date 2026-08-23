// 销售管理
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Switch, Tag, Space, Popconfirm, InputNumber, Tabs } from 'antd';
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
  const [payoutData, setPayoutData] = useState({ list: [] });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutModal, setPayoutModal] = useState(null); // { id, name, payable }
  const [payoutForm] = Form.useForm();
  const [payoutHistory, setPayoutHistory] = useState(null); // salesId
  const [historyData, setHistoryData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try { setData(await api.get('/sales-admin')); } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const loadPayoutSummary = async () => {
    setPayoutLoading(true);
    try { setPayoutData(await api.get('/commissions/payout-summary', { params: { type: 'sales' } })); } catch (e) { message.error(e.message); }
    setPayoutLoading(false);
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

  const handlePayout = async () => {
    try {
      const values = await payoutForm.validateFields();
      await api.post('/commissions/payouts', {
        beneficiaryId: payoutModal.id,
        beneficiaryType: 'sales',
        amount: values.amount,
        note: values.note,
      });
      message.success('发放成功');
      setPayoutModal(null); payoutForm.resetFields();
      loadPayoutSummary();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const showHistory = async (salesId) => {
    setPayoutHistory(salesId);
    try {
      const d = await api.get('/commissions/payouts', { params: { beneficiaryId: salesId, beneficiaryType: 'sales' } });
      setHistoryData(d.list || []);
    } catch (e) { message.error(e.message); }
  };

  return (
    <div className="page-container">
      <Tabs items={[
        { key: 'list', label: '销售列表', children: (
          <>
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
          </>
        )},
        { key: 'payout', label: '提成发放', children: (
          <>
            <div className="flex-between mb-16">
              <h2>销售提成发放</h2>
              <Button onClick={loadPayoutSummary}>刷新统计</Button>
            </div>
            <Table loading={payoutLoading} dataSource={payoutData.list} rowKey="id" size="small" pagination={false}
              locale={{ emptyText: '点击"刷新统计"加载提成数据' }}
              columns={[
                { title: '姓名', dataIndex: 'name', key: 'name' },
                { title: '手机号', dataIndex: 'phone', key: 'phone' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '在职' : '停用'}</Tag> },
                { title: '提成记录数', dataIndex: 'record_count', key: 'record_count', render: (v) => v || 0 },
                { title: '已计提(元)', dataIndex: 'earned', key: 'earned', render: (v) => `￥${v || 0}` },
                { title: '已发放(元)', dataIndex: 'paid', key: 'paid', render: (v) => `￥${v || 0}` },
                { title: '可发放(元)', dataIndex: 'payable', key: 'payable', render: (v) => <span style={{ color: v > 0 ? '#FF4D28' : '#999', fontWeight: 600 }}>￥{v || 0}</span> },
                { title: '操作', key: 'action', render: (_, r) => (
                  <Space>
                    <Button size="small" type="link" disabled={!r.payable || r.payable <= 0}
                      onClick={() => { setPayoutModal({ id: r.id, name: r.name, payable: r.payable }); payoutForm.setFieldsValue({ amount: r.payable }); }}>
                      发放提成
                    </Button>
                    <Button size="small" type="link" onClick={() => showHistory(r.id)}>发放记录</Button>
                  </Space>
                )},
              ]}
            />
          </>
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

      <Modal title={`发放提成 - ${payoutModal?.name || ''}`} open={!!payoutModal} onOk={handlePayout} onCancel={() => setPayoutModal(null)} width={450}>
        <div style={{ marginBottom: 16, padding: '12px', background: '#fafafa', borderRadius: 6 }}>
          <div>可发放余额：<b style={{ color: '#FF4D28', fontSize: 18 }}>￥{payoutModal?.payable || 0}</b></div>
        </div>
        <Form form={payoutForm} layout="vertical">
          <Form.Item name="amount" label="发放金额" rules={[{ required: true, message: '请输入发放金额' }]}>
            <InputNumber prefix="￥" min={1} max={payoutModal?.payable || 0} style={{ width: '100%' }} placeholder="输入发放金额" />
          </Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="选填" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="发放记录" open={!!payoutHistory} onCancel={() => setPayoutHistory(null)} footer={null} width={600}>
        <Table dataSource={historyData} rowKey="id" size="small" pagination={false} columns={[
          { title: '发放金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
          { title: '备注', dataIndex: 'note', key: 'note', render: (v) => v || '-' },
          { title: '操作人', dataIndex: 'operator_name', key: 'operator_name' },
          { title: '发放时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleString() },
        ]} />
      </Modal>
    </div>
  );
}
