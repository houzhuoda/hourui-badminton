// 教练管理
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Tag, Space, Tabs, InputNumber as Num } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, businessTypeName } from '../utils/constants';
import CoachAvailability from './CoachAvailability.jsx';

export default function Coaches() {
  const message = useMessage();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editCoach, setEditCoach] = useState(null);
  const [form] = Form.useForm();
  const [rateModal, setRateModal] = useState(null);
  const [rateForm] = Form.useForm();
  const [detail, setDetail] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [availCoach, setAvailCoach] = useState(null);
  const [payoutData, setPayoutData] = useState({ list: [] });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutModal, setPayoutModal] = useState(null);
  const [payoutForm] = Form.useForm();
  const [payoutHistory, setPayoutHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try { setData(await api.get('/coaches')); } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const loadPayoutSummary = async () => {
    setPayoutLoading(true);
    try { setPayoutData(await api.get('/commissions/payout-summary', { params: { type: 'coach' } })); } catch (e) { message.error(e.message); }
    setPayoutLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editCoach) {
        await api.put(`/coaches/${editCoach.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/coaches', values);
        message.success('新增成功');
      }
      setModal(false); form.resetFields(); setEditCoach(null); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveRates = async () => {
    try {
      const values = await rateForm.validateFields();
      await api.put(`/coaches/${rateModal}/rates`, { rates: values.rates });
      message.success('费率已保存'); setRateModal(null); rateForm.resetFields();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSalesToggle = async (id, enabled) => {
    try { await api.patch(`/coaches/${id}/sales-enabled`, { enabled }); message.success('已更新'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  const showDetail = async (id) => {
    try {
      const d = await api.get(`/coaches/${id}`);
      setDetail(d); setDetailModal(true);
    } catch (e) { message.error(e.message); }
  };

  const handlePayout = async () => {
    try {
      const values = await payoutForm.validateFields();
      await api.post('/commissions/payouts', {
        beneficiaryId: payoutModal.id,
        beneficiaryType: 'coach',
        amount: values.amount,
        note: values.note,
      });
      message.success('发放成功');
      setPayoutModal(null); payoutForm.resetFields();
      loadPayoutSummary();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const showHistory = async (coachId) => {
    setPayoutHistory(coachId);
    try {
      const d = await api.get('/commissions/payouts', { params: { beneficiaryId: coachId, beneficiaryType: 'coach' } });
      setHistoryData(d.list || []);
    } catch (e) { message.error(e.message); }
  };

  return (
    <div className="page-container">
      <Tabs items={[
        { key: 'list', label: '教练列表', children: (
          <>
            <div className="flex-between mb-16">
              <h2>教练管理</h2>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditCoach(null); setModal(true); }}>新增教练</Button>
            </div>

            <Table loading={loading} dataSource={data} rowKey="id" size="small" columns={[
              { title: '姓名', dataIndex: 'name', key: 'name' },
              { title: '手机号', dataIndex: 'phone', key: 'phone' },
              { title: '主业务', dataIndex: 'primary_business_type', key: 'primary_business_type', render: (v) => {
                if (!v) return '-';
                const types = String(v).split(',').filter(Boolean);
                return types.map((t) => <Tag key={t} color="blue">{businessTypeName(t)}</Tag>);
              }},
              { title: '销售能力', dataIndex: 'sales_enabled', key: 'sales_enabled', render: (v, r) => <Switch checked={v} onChange={(c) => handleSalesToggle(r.id, c)} /> },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '在职' : '离职'}</Tag> },
              { title: '操作', key: 'action', render: (_, r) => (
                <Space>
                  <Button size="small" type="link" onClick={() => showDetail(r.id)}>详情</Button>
                  <Button size="small" type="link" onClick={() => {
                    const formValues = { ...r, primaryBusinessTypes: r.primary_business_type ? String(r.primary_business_type).split(',').filter(Boolean) : [] };
                    form.setFieldsValue(formValues); setEditCoach(r); setModal(true);
                  }}>编辑</Button>
                  <Button size="small" type="link" onClick={() => { rateForm.resetFields(); setRateModal(r.id); }}>费率</Button>
                  <Button size="small" type="link" onClick={() => setAvailCoach(r)}>可用时间</Button>
                </Space>
              )},
            ]} />
          </>
        )},
        { key: 'payout', label: '提成发放', children: (
          <>
            <div className="flex-between mb-16">
              <h2>教练提成发放</h2>
              <Button onClick={loadPayoutSummary}>刷新统计</Button>
            </div>
            <Table loading={payoutLoading} dataSource={payoutData.list} rowKey="id" size="small" pagination={false}
              locale={{ emptyText: '点击"刷新统计"加载提成数据' }}
              columns={[
                { title: '姓名', dataIndex: 'name', key: 'name' },
                { title: '手机号', dataIndex: 'phone', key: 'phone' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '在职' : '离职'}</Tag> },
                { title: '上课节数', dataIndex: 'session_count', key: 'session_count', render: (v) => v || 0 },
                { title: '课时费', dataIndex: 'lesson_total', key: 'lesson_total', render: (v) => `￥${v || 0}` },
                { title: '分成收入', dataIndex: 'share_total', key: 'share_total', render: (v) => `￥${v || 0}` },
                { title: '销售提成', dataIndex: 'sales_commission', key: 'sales_commission', render: (v) => `￥${v || 0}` },
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

      <Modal title={editCoach ? '编辑教练' : '新增教练'} open={modal} onOk={handleSave} onCancel={() => setModal(false)} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, pattern: /^\d{11}$/, message: '请输入11位手机号' }]}><Input /></Form.Item>
          {!editCoach && <Form.Item name="password" label="初始密码" rules={[{ required: true }]}><Input.Password /></Form.Item>}
          <Form.Item name="primaryBusinessTypes" label="主业务类型（可多选）">
            <Select mode="multiple" allowClear placeholder="选择教练主业务类型" options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
          </Form.Item>
          <Form.Item name="salesEnabled" label="销售能力" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal title="教练费率设置" open={!!rateModal} onOk={handleSaveRates} onCancel={() => setRateModal(false)} width={760}>
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 6, fontSize: 12, color: '#999' }}>
          按业务类型设置教练的课单价与课时费分成。课单价为每节课的固定课时费；分成比例为教练从课程收入中获得的课时费分成百分比；赠送课程是否提成控制会员使用赠送课时上课时，教练是否获得课时费分成。
        </div>
        <Form form={rateForm} layout="vertical">
          <Form.List name="rates" initialValue={[{ businessType: undefined, lessonFee: 0, shareRate: 0, giftCommission: false }]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[f.name, 'businessType']} rules={[{ required: true, message: '必选' }]}>
                      <Select placeholder="业务类型" style={{ width: 140 }} options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'lessonFee']} rules={[{ required: true, message: '必填' }]}>
                      <InputNumber placeholder="课单价" prefix="￥" min={0} style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'shareRate']}>
                      <InputNumber placeholder="分成比例" min={0} max={100} style={{ width: 120 }} formatter={(v) => v ? `${v}%` : ''} parser={(v) => v.replace('%', '')} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'giftCommission']} valuePropName="checked">
                      <Switch checkedChildren="分成" unCheckedChildren="不分成" />
                    </Form.Item>
                    <Button danger onClick={() => remove(f.name)}>删除</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ businessType: undefined, lessonFee: 0, shareRate: 0, giftCommission: false })}>+ 添加费率</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal title="教练详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={700}>
        {detail && (
          <Tabs items={[
            { key: 'info', label: '基本信息', children: (
              <div>
                <p>姓名：{detail.name}</p>
                <p>手机号：{detail.phone}</p>
                <p>主业务：{detail.primary_business_type ? String(detail.primary_business_type).split(',').filter(Boolean).map((t) => businessTypeName(t)).join('、') : '-'}</p>
                <p>销售能力：{detail.sales_enabled ? '已开启' : '未开启'}</p>
                <p>状态：{detail.status === 'ACTIVE' ? '在职' : '离职'}</p>
              </div>
            )},
            { key: 'rates', label: '费率设置', children: (
              <Table dataSource={detail.rates || []} rowKey="business_type" size="small" pagination={false} columns={[
                { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => businessTypeName(v) },
                { title: '课单价', dataIndex: 'lesson_fee', key: 'lesson_fee', render: (v) => v ? `￥${v}` : '-' },
                { title: '分成比例', dataIndex: 'share_rate', key: 'share_rate', render: (v) => v ? `${v}%` : '-' },
                { title: '赠送课时分成', dataIndex: 'gift_commission', key: 'gift_commission', render: (v) => v ? <Tag color="green">分成</Tag> : <Tag>不分成</Tag> },
              ]} />
            )},
            { key: 'stats', label: '上课统计', children: (
              <Table dataSource={detail.stats || []} rowKey="business_type" size="small" pagination={false} columns={[
                { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => businessTypeName(v) },
                { title: '上课节数', dataIndex: 'session_count', key: 'session_count' },
                { title: '课时费合计', dataIndex: 'total_lesson_fee', key: 'total_lesson_fee', render: (v) => `￥${v}` },
              ]} />
            )},
          ]} />
        )}
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

      <CoachAvailability coach={availCoach} open={!!availCoach} onClose={() => setAvailCoach(null)} />
    </div>
  );
}
