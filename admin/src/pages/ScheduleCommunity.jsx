// 群活动排课 — 按日期排课
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, InputNumber, Select, DatePicker, TimePicker, Tag, Space, Popconfirm, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { SESSION_STATUS } from '../utils/constants';
import dayjs from 'dayjs';

export default function ScheduleCommunity() {
  const message = useMessage();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [courts, setCourts] = useState([]);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(30, 'day').format('YYYY-MM-DD') });
  const [dateRange, setDateRange] = useState([dayjs(), dayjs().add(30, 'day')]);

  const doSearch = () => {
    setFilters({ startDate: dateRange[0].format('YYYY-MM-DD'), endDate: dateRange[1].format('YYYY-MM-DD') });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get('/sessions', { params: { ...filters, businessType: 'COMMUNITY' } });
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    api.get('/courses').then((d) => setCourses(d.filter((c) => c.business_type === 'COMMUNITY'))).catch(() => {});
    api.get('/coaches').then(setCoaches).catch(() => {});
    api.get('/courts/courts').then(setCourts).catch(() => {});
    loadData();
  }, [filters]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.timeRange[0].format('HH:mm'),
        endTime: values.timeRange[1].format('HH:mm'),
        bookingOpen: values.bookingOpen ?? true,
      };
      delete payload.timeRange;
      await api.post('/sessions', payload);
      message.success('排课成功'); setModal(false); form.resetFields(); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleCancel = async (id) => {
    try { await api.delete(`/sessions/${id}`, { data: { reason: '管理员取消' } }); message.success('已取消'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>群活动排课</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>排课</Button>
      </div>

      <Alert type="info" showIcon message="群活动按日期排课，单次付费或群活动多次卡。请选择场地，系统自动校验冲突。" className="mb-16" />

      <Card className="mb-16">
        <Space>
          <DatePicker.RangePicker value={dateRange} onChange={(v) => v && setDateRange(v)} />
          <Button type="primary" onClick={doSearch}>查询</Button>
        </Space>
      </Card>

      <Table loading={loading} dataSource={data} rowKey="id" size="small" pagination={{ pageSize: 50 }} columns={[
        { title: '日期', dataIndex: 'date', key: 'date' },
        { title: '时间', key: 'time', render: (_, r) => `${r.start_time} - ${r.end_time}` },
        { title: '活动名称', dataIndex: 'course_name', key: 'course_name' },
        { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
        { title: '场地', dataIndex: 'court_name', key: 'court_name', render: (v) => v || '-' },
        { title: '报名', key: 'capacity', render: (_, r) => `${r.booked_count}/${r.capacity}` },
        { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'SCHEDULED' ? 'blue' : v === 'COMPLETED' ? 'green' : 'red'}>{SESSION_STATUS[v]}</Tag> },
        { title: '操作', key: 'action', render: (_, r) => r.status === 'SCHEDULED' && (
          <Popconfirm title="确认取消？" onConfirm={() => handleCancel(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>取消</Button>
          </Popconfirm>
        )},
      ]} />

      <Modal title="群活动排课" open={modal} onOk={handleCreate} onCancel={() => setModal(false)} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="courseId" label="活动" rules={[{ required: true }]}>
            <Select options={courses.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="coachId" label="教练" rules={[{ required: true }]}>
            <Select options={coaches.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="courtId" label="场地" rules={[{ required: true, message: '请选择场地' }]}>
            <Select options={courts.map((c) => ({ label: `${c.name}${c.venue_name ? `（${c.venue_name}）` : ''}`, value: c.id }))} />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}><DatePicker /></Form.Item>
          <Form.Item name="timeRange" label="时间段" rules={[{ required: true }]}><TimePicker.RangePicker format="HH:mm" /></Form.Item>
          <Form.Item name="capacity" label="人数上限" initialValue={20}><InputNumber min={1} /></Form.Item>
          <Form.Item name="bookingOpen" label="开放报名" initialValue={true}>
            <Select options={[{ label: '开放', value: true }, { label: '不开放', value: false }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
