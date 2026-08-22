// 课程与定价管理
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tabs, Tag, Space, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, AUDIENCE_TYPES, businessTypeName } from '../utils/constants';

export default function Courses() {
  const message = useMessage();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [form] = Form.useForm();
  const [spModal, setSpModal] = useState(false);
  const [spForm] = Form.useForm();
  const [mpModal, setMpModal] = useState(false);
  const [mpForm] = Form.useForm();
  const [prepaidModal, setPrepaidModal] = useState(false);
  const [prepaidForm] = Form.useForm();
  const [prepaidRules, setPrepaidRules] = useState([]);
  const [discountModal, setDiscountModal] = useState(false);
  const [discountForm] = Form.useForm();
  const [discountRules, setDiscountRules] = useState([]);

  const loadCourses = async () => {
    setLoading(true);
    try { setCourses(await api.get('/courses')); } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const loadPrepaid = async () => { try { setPrepaidRules(await api.get('/courses/prepaid-rules/list')); } catch {} };
  const loadDiscount = async () => { try { setDiscountRules(await api.get('/courses/discount-rules/list')); } catch {} };

  useEffect(() => { loadCourses(); loadPrepaid(); loadDiscount(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editCourse) {
        await api.put(`/courses/${editCourse.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/courses', values);
        message.success('新增成功');
      }
      setModal(false); form.resetFields(); setEditCourse(null); loadCourses();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveSp = async (courseId) => {
    try {
      const values = await spForm.validateFields();
      await api.post(`/courses/${courseId}/session-pricing`, values);
      message.success('定价已添加'); setSpModal(false); spForm.resetFields(); loadCourses();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveMp = async (courseId) => {
    try {
      const values = await mpForm.validateFields();
      await api.post(`/courses/${courseId}/monthly-pricing`, values);
      message.success('月卡定价已添加'); setMpModal(false); mpForm.resetFields(); loadCourses();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSavePrepaid = async () => {
    try {
      const values = await prepaidForm.validateFields();
      await api.post('/courses/prepaid-rules', values);
      message.success('预存规则已添加'); setPrepaidModal(false); prepaidForm.resetFields(); loadPrepaid();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveDiscount = async () => {
    try {
      const values = await discountForm.validateFields();
      await api.post('/courses/discount-rules', values);
      message.success('折扣规则已添加'); setDiscountModal(false); discountForm.resetFields(); loadDiscount();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  return (
    <div className="page-container">
      <h2>课程与定价管理</h2>
      <Tabs items={[
        { key: 'courses', label: '课程列表', children: (
          <>
            <Button type="primary" icon={<PlusOutlined />} className="mb-16" onClick={() => { form.resetFields(); setEditCourse(null); setModal(true); }}>新增课程</Button>
            <Table loading={loading} dataSource={courses} rowKey="id" size="small" columns={[
              { title: '课程名称', dataIndex: 'name', key: 'name' },
              { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => <Tag color="blue">{businessTypeName(v)}</Tag> },
              { title: '适用对象', dataIndex: 'audience', key: 'audience' },
              { title: '时长(分)', dataIndex: 'duration_min', key: 'duration_min' },
              { title: '标准单价', dataIndex: 'standard_price', key: 'standard_price', render: (v) => `￥${v}` },
              { title: '次卡档位', key: 'sp', render: (_, r) => <span>{r.sessionPricing?.length || 0}档</span> },
              { title: '月卡档位', key: 'mp', render: (_, r) => <span>{r.monthlyPricing?.length || 0}档</span> },
              { title: '操作', key: 'action', render: (_, r) => (
                <Space>
                  <Button size="small" type="link" onClick={() => { form.setFieldsValue(r); setEditCourse(r); setModal(true); }}>编辑</Button>
                  <Button size="small" type="link" onClick={() => { spForm.resetFields(); setSpModal(r.id); }}>加次卡</Button>
                  <Button size="small" type="link" onClick={() => { mpForm.resetFields(); setMpModal(r.id); }}>加月卡</Button>
                </Space>
              )},
            ]} />
          </>
        )},
        { key: 'prepaid', label: '预存赠送规则', children: (
          <>
            <Button type="primary" icon={<PlusOutlined />} className="mb-16" onClick={() => { prepaidForm.resetFields(); setPrepaidModal(true); }}>新增规则</Button>
            <Table dataSource={prepaidRules} rowKey="id" size="small" pagination={false} columns={[
              { title: '预存金额', dataIndex: 'deposit_amount', key: 'deposit_amount', render: (v) => `￥${v}` },
              { title: '赠送金额', dataIndex: 'gift_amount', key: 'gift_amount', render: (v) => `￥${v}` },
              { title: '账户总额', key: 'total', render: (_, r) => `￥${r.deposit_amount + r.gift_amount}` },
              { title: '操作', key: 'action', render: (_, r) => (
                <Popconfirm title="确认停用？" onConfirm={async () => { await api.delete(`/courses/prepaid-rules/${r.id}`); message.success('已停用'); loadPrepaid(); }}>
                  <Button size="small" type="link" danger>停用</Button>
                </Popconfirm>
              )},
            ]} />
          </>
        )},
        { key: 'discount', label: '折扣规则', children: (
          <>
            <Button type="primary" icon={<PlusOutlined />} className="mb-16" onClick={() => { discountForm.resetFields(); setDiscountModal(true); }}>新增折扣</Button>
            <Table dataSource={discountRules} rowKey="id" size="small" pagination={false} columns={[
              { title: '名称', dataIndex: 'name', key: 'name' },
              { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => v ? businessTypeName(v) : '全部' },
              { title: '类型', dataIndex: 'discount_type', key: 'discount_type', render: (v) => v === 'RATE' ? '比例' : '优惠价' },
              { title: '值', dataIndex: 'discount_value', key: 'discount_value', render: (v, r) => r.discount_type === 'RATE' ? `${v}%` : `￥${v}` },
              { title: '适用', dataIndex: 'target', key: 'target' },
              { title: '操作', key: 'action', render: (_, r) => (
                <Popconfirm title="确认停用？" onConfirm={async () => { await api.delete(`/courses/discount-rules/${r.id}`); message.success('已停用'); loadDiscount(); }}>
                  <Button size="small" type="link" danger>停用</Button>
                </Popconfirm>
              )},
            ]} />
          </>
        )},
      ]} />

      <Modal title={editCourse ? '编辑课程' : '新增课程'} open={modal} onOk={handleSave} onCancel={() => setModal(false)} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="课程名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="businessType" label="业务类型" rules={[{ required: true }]}>
            <Select options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
          </Form.Item>
          <Form.Item name="audience" label="适用对象"><Select options={AUDIENCE_TYPES.map((a) => ({ label: a.name, value: a.code }))} /></Form.Item>
          <Form.Item name="durationMin" label="单节时长(分钟)"><InputNumber min={30} max={180} /></Form.Item>
          <Form.Item name="standardPrice" label="标准单价(元)"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增次卡定价" open={!!spModal} onOk={() => handleSaveSp(spModal)} onCancel={() => setSpModal(false)}>
        <Form form={spForm} layout="vertical">
          <Form.Item name="sessions" label="节数" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          <Form.Item name="price" label="价格(元)" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="giftSessions" label="赠送节数"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增月卡定价" open={!!mpModal} onOk={() => handleSaveMp(mpModal)} onCancel={() => setMpModal(false)}>
        <Form form={mpForm} layout="vertical">
          <Form.Item name="monthlyFee" label="月费(元)" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="weeklyFrequency" label="周频次" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          <Form.Item name="monthlyQuota" label="月额度次数" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增预存赠送规则" open={prepaidModal} onOk={handleSavePrepaid} onCancel={() => setPrepaidModal(false)}>
        <Form form={prepaidForm} layout="vertical">
          <Form.Item name="depositAmount" label="预存金额(元)" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="giftAmount" label="赠送金额(元)" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增折扣规则" open={discountModal} onOk={handleSaveDiscount} onCancel={() => setDiscountModal(false)}>
        <Form form={discountForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="businessType" label="业务类型"><Select allowClear options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} /></Form.Item>
          <Form.Item name="discountType" label="折扣类型" rules={[{ required: true }]}>
            <Select options={[{ label: '比例(%)', value: 'RATE' }, { label: '优惠价(元)', value: 'FIXED' }]} />
          </Form.Item>
          <Form.Item name="discountValue" label="折扣值" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="target" label="适用群体"><Select options={[{ label: '全部', value: 'ALL' }, { label: '新客', value: 'NEW' }]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
