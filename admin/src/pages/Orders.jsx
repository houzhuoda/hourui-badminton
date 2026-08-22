// 订单管理
import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Card, Tag, Modal, Form, InputNumber, Popconfirm } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, CHARGE_MODES, ORDER_STATUS, businessTypeName, chargeModeName } from '../utils/constants';

export default function Orders() {
  const message = useMessage();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState({ page: 1, pageSize: 20, memberId: searchParams.get('memberId') || undefined });
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [courses, setCourses] = useState([]);
  const [members, setMembers] = useState([]);
  const [courseDetail, setCourseDetail] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try { setData(await api.get('/orders', { params })); } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [params]);

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(() => {});
    api.get('/members', { params: { pageSize: 100 } }).then(setMembers).catch(() => {});
  }, []);

  const handleRefund = async (id) => {
    try { await api.post(`/orders/${id}/refund`, { reason: '管理员退款' }); message.success('退款成功'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/orders', { ...values, confirmed: true });
      message.success('开单成功'); setCreateModal(false); form.resetFields(); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const onCourseChange = async (id) => {
    try { setCourseDetail(await api.get(`/courses/${id}`)); } catch {}
  };

  return (
    <div className="page-container">
      <div className="flex-between mb-16">
        <h2>订单管理</h2>
        <Button type="primary" onClick={() => { form.resetFields(); setCreateModal(true); }}>购课开单</Button>
      </div>

      <Card className="mb-16">
        <Space wrap>
          <Input.Search placeholder="订单号/会员" allowClear style={{ width: 200 }} onSearch={(v) => setParams({ ...params, keyword: v, page: 1 })} />
          <Select placeholder="业务类型" allowClear style={{ width: 150 }} onChange={(v) => setParams({ ...params, businessType: v, page: 1 })}
            options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
          <Select placeholder="收费模式" allowClear style={{ width: 150 }} onChange={(v) => setParams({ ...params, chargeMode: v, page: 1 })}
            options={CHARGE_MODES.map((m) => ({ label: m.name, value: m.code }))} />
          <Select placeholder="状态" allowClear style={{ width: 120 }} onChange={(v) => setParams({ ...params, status: v, page: 1 })}
            options={Object.entries(ORDER_STATUS).map(([k, v]) => ({ label: v, value: k }))} />
        </Space>
      </Card>

      <Table loading={loading} dataSource={data.list} rowKey="id" size="small"
        pagination={{ current: params.page, pageSize: params.pageSize, total: data.total, onChange: (page, pageSize) => setParams({ ...params, page, pageSize }) }}
        columns={[
          { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
          { title: '会员', dataIndex: 'member_name', key: 'member_name' },
          { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => <Tag color="blue">{businessTypeName(v)}</Tag> },
          { title: '收费模式', dataIndex: 'charge_mode', key: 'charge_mode', render: (v) => chargeModeName(v) },
          { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
          { title: '提成', dataIndex: 'commission_amount', key: 'commission_amount', render: (v) => v ? `￥${v}` : '-' },
          { title: '销售', dataIndex: 'sales_name', key: 'sales_name' },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'PAID' ? 'green' : 'red'}>{ORDER_STATUS[v]}</Tag> },
          { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleString() },
          { title: '操作', key: 'action', render: (_, r) => r.status === 'PAID' && (
            <Popconfirm title="确认退款？" onConfirm={() => handleRefund(r.id)}>
              <Button size="small" type="link" danger>退款</Button>
            </Popconfirm>
          )},
        ]} />

      <Modal title="购课开单" open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="memberId" label="会员" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择会员"
              options={members.list?.map((m) => ({ label: `${m.name} (${m.phone})`, value: m.id })) || []} />
          </Form.Item>
          <Form.Item name="businessType" label="业务类型" rules={[{ required: true }]}>
            <Select options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
          </Form.Item>
          <Form.Item name="courseId" label="课程">
            <Select allowClear options={courses.map((c) => ({ label: c.name, value: c.id }))} onChange={onCourseChange} />
          </Form.Item>
          <Form.Item name="chargeMode" label="收费模式" rules={[{ required: true }]}>
            <Select options={CHARGE_MODES.map((m) => ({ label: m.name, value: m.code }))} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const mode = getFieldValue('chargeMode');
              if (mode === 'SESSION_PACK') return (
                <Form.Item name="sessionPricingId" label="次卡档位" rules={[{ required: true }]}>
                  <Select options={courseDetail?.sessionPricing?.map((sp) => ({ label: `${sp.sessions}节 ${sp.gift_sessions ? `+赠${sp.gift_sessions}节 ` : ''}￥${sp.price}`, value: sp.id })) || []} />
                </Form.Item>
              );
              if (mode === 'MONTHLY') return (
                <Form.Item name="monthlyPricingId" label="月卡档位" rules={[{ required: true }]}>
                  <Select options={courseDetail?.monthlyPricing?.map((mp) => ({ label: `￥${mp.monthly_fee}/月 ${mp.monthly_quota}次`, value: mp.id })) || []} />
                </Form.Item>
              );
              if (mode === 'PREPAID') return (
                <Form.Item name="depositAmount" label="预存金额" rules={[{ required: true }]}>
                  <Select options={courseDetail?.prepaidRules?.map((r) => ({ label: `预存￥${r.deposit_amount} 赠￥${r.gift_amount}`, value: r.deposit_amount })) || []} />
                </Form.Item>
              );
              if (mode === 'SINGLE') return <Form.Item name="singlePrice" label="单次价格"><InputNumber min={0} /></Form.Item>;
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
