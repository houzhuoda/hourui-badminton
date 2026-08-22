// 教练可用时间设置
import { useEffect, useState } from 'react';
import { Modal, Form, Select, InputNumber, Table, Tag, Button, Space, DatePicker, Tabs, Popconfirm, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import dayjs from 'dayjs';

const WEEKDAYS = [
  { key: 1, label: '周一' }, { key: 2, label: '周二' }, { key: 3, label: '周三' },
  { key: 4, label: '周四' }, { key: 5, label: '周五' }, { key: 6, label: '周六' }, { key: 7, label: '周日' },
];

export default function CoachAvailability({ coach, open, onClose }) {
  const message = useMessage();
  const [templates, setTemplates] = useState([]);
  const [timeOffs, setTimeOffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [offModal, setOffModal] = useState(false);
  const [form] = Form.useForm();
  const [offForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('templates');

  const loadData = async () => {
    if (!coach) return;
    setLoading(true);
    try {
      const t = await api.get(`/private-bookings/${coach.id}/availability`);
      setTemplates(t);
      const today = dayjs().format('YYYY-MM-DD');
      const end = dayjs().add(90, 'day').format('YYYY-MM-DD');
      const off = await api.get(`/private-bookings/${coach.id}/time-off?startDate=${today}&endDate=${end}`);
      setTimeOffs(off);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { if (open) loadData(); }, [open]);

  const handleSaveTemplates = async () => {
    try {
      const values = await form.validateFields();
      const newTemplates = [...templates, { dayOfWeek: values.dayOfWeek, startHour: values.startHour, endHour: values.endHour, businessTypes: values.businessTypes?.join(',') || 'PRIVATE,PRACTICE' }];
      await api.put(`/private-bookings/${coach.id}/availability`, { templates: newTemplates });
      message.success('已添加');
      setAddModal(false); form.resetFields(); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleDeleteTemplate = async (idx) => {
    const newTemplates = templates.filter((_, i) => i !== idx);
    try {
      await api.put(`/private-bookings/${coach.id}/availability`, {
        templates: newTemplates.map((t) => ({ dayOfWeek: t.day_of_week, startHour: t.start_hour, endHour: t.end_hour, businessTypes: t.business_types })),
      });
      message.success('已删除'); loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleAddOff = async () => {
    try {
      const values = await offForm.validateFields();
      await api.post(`/private-bookings/${coach.id}/time-off`, {
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.timeRange[0].format('HH:mm'),
        endTime: values.timeRange[1].format('HH:mm'),
        reason: values.reason || '',
      });
      message.success('请假已添加'); setOffModal(false); offForm.resetFields(); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleDeleteOff = async (offId) => {
    try { await api.delete(`/private-bookings/${coach.id}/time-off/${offId}`); message.success('已删除'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  const wdName = (d) => WEEKDAYS.find((w) => w.key === d)?.label || d;
  const btName = (s) => s?.split(',').map((t) => t === 'PRIVATE' ? '私教' : t === 'PRACTICE' ? '陪练' : t).join('、');

  return (
    <Modal title={`${coach?.name} - 可用时间设置`} open={open} onCancel={onClose} footer={null} width={700}>
      <Space className="mb-16">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setAddModal(true); }}>添加可用时段</Button>
        <Button icon={<PlusOutlined />} onClick={() => { offForm.resetFields(); setOffModal(true); }}>添加请假</Button>
      </Space>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'templates', label: '每周可用时间', children: (
          <Table loading={loading} dataSource={templates} rowKey={(r, i) => i} size="small" pagination={false} columns={[
            { title: '周几', dataIndex: 'day_of_week', key: 'day_of_week', render: (v) => <Tag color="blue">{wdName(v)}</Tag> },
            { title: '时间段', key: 'time', render: (_, r) => `${r.start_hour}:00 - ${r.end_hour}:00` },
            { title: '适用业务', dataIndex: 'business_types', key: 'business_types', render: (v) => btName(v) },
            { title: '操作', key: 'action', render: (_, r, idx) => (
              <Popconfirm title="确认删除？" onConfirm={() => handleDeleteTemplate(idx)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            )},
          ]} />
        )},
        { key: 'time-off', label: '请假记录', children: (
          <Table loading={loading} dataSource={timeOffs} rowKey="id" size="small" pagination={false} columns={[
            { title: '日期', dataIndex: 'date', key: 'date' },
            { title: '时间段', key: 'time', render: (_, r) => `${r.start_time} - ${r.end_time}` },
            { title: '原因', dataIndex: 'reason', key: 'reason', render: (v) => v || '-' },
            { title: '操作', key: 'action', render: (_, r) => (
              <Popconfirm title="确认删除？" onConfirm={() => handleDeleteOff(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            )},
          ]} />
        )},
      ]} />

      <Modal title="添加可用时段" open={addModal} onOk={handleSaveTemplates} onCancel={() => setAddModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="dayOfWeek" label="周几" rules={[{ required: true }]}>
            <Select options={WEEKDAYS.map((w) => ({ label: w.label, value: w.key }))} />
          </Form.Item>
          <Space>
            <Form.Item name="startHour" label="开始小时" rules={[{ required: true }]}>
              <InputNumber min={0} max={23} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="endHour" label="结束小时" rules={[{ required: true }]}>
              <InputNumber min={1} max={24} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="businessTypes" label="适用业务类型">
            <Select mode="multiple" defaultValue={['PRIVATE', 'PRACTICE']} options={[
              { label: '私教', value: 'PRIVATE' },
              { label: '陪练', value: 'PRACTICE' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加请假" open={offModal} onOk={handleAddOff} onCancel={() => setOffModal(false)}>
        <Form form={offForm} layout="vertical">
          <Form.Item name="date" label="日期" rules={[{ required: true }]}><DatePicker /></Form.Item>
          <Form.Item name="timeRange" label="时间段" rules={[{ required: true }]}>
            <DatePicker.RangePicker picker="time" format="HH:mm" />
          </Form.Item>
          <Form.Item name="reason" label="原因"><Input /></Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}
