// 课表管理 — 按三类分类
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, TimePicker, Tag, Space, Popconfirm, Tabs, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, businessTypeName, SESSION_STATUS } from '../utils/constants';
import dayjs from 'dayjs';

// 三大类
const CATEGORY_TABS = [
  { key: 'ALL', label: '全部' },
  { key: 'PRIVATE_PRACTICE', label: '私教/陪练', types: ['PRIVATE', 'PRACTICE'] },
  { key: 'GROUP', label: '大课类', types: ['ADULT_GROUP', 'KID_GROUP', 'FITNESS', 'GYM'] },
  { key: 'COMMUNITY', label: '群活动', types: ['COMMUNITY'] },
];

export default function Schedule() {
  const message = useMessage();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [courts, setCourts] = useState([]);
  const [modal, setModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [filters, setFilters] = useState({ startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(7, 'day').format('YYYY-MM-DD') });
  const [activeTab, setActiveTab] = useState('ALL');
  const [dateRange, setDateRange] = useState([dayjs(), dayjs().add(7, 'day')]);

  const doSearch = () => {
    setFilters({
      startDate: dateRange[0].format('YYYY-MM-DD'),
      endDate: dateRange[1].format('YYYY-MM-DD'),
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get('/sessions', { params: filters });
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(() => {});
    api.get('/coaches').then(setCoaches).catch(() => {});
    api.get('/courts/courts').then(setCourts).catch(() => {});
    loadData();
  }, [filters]);

  // 按分类过滤
  const getFilteredData = () => {
    if (activeTab === 'ALL') return data;
    const tab = CATEGORY_TABS.find((t) => t.key === activeTab);
    if (!tab || !tab.types) return data;
    return data.filter((s) => tab.types.includes(s.business_type));
  };
  const filteredData = getFilteredData();

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

  const handleBatch = async () => {
    try {
      const values = await batchForm.validateFields();
      const payload = {
        ...values,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        weeklySlots: values.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime.format('HH:mm'), endTime: s.endTime.format('HH:mm') })),
      };
      delete payload.dateRange; delete payload.slots;
      await api.post('/sessions/batch', payload);
      message.success('批量排课成功'); setBatchModal(false); batchForm.resetFields(); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleCancel = async (id) => {
    try { await api.delete(`/sessions/${id}`, { data: { reason: '管理员取消' } }); message.success('已取消'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  // 根据当前 Tab 过滤课程选项
  const getFilteredCourses = () => {
    if (activeTab === 'ALL') return courses;
    const tab = CATEGORY_TABS.find((t) => t.key === activeTab);
    if (!tab || !tab.types) return courses;
    return courses.filter((c) => tab.types.includes(c.business_type));
  };

  return (
    <div className="page-container">
      <div className="flex-between mb-16">
        <h2>课表管理</h2>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>排课</Button>
          <Button icon={<CopyOutlined />} onClick={() => { batchForm.resetFields(); setBatchModal(true); }}>批量排课</Button>
        </Space>
      </div>

      <Card className="mb-16">
        <Space>
          <DatePicker.RangePicker value={dateRange} onChange={(v) => v && setDateRange(v)} />
          <Button type="primary" onClick={doSearch}>查询</Button>
        </Space>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="mb-16" items={CATEGORY_TABS.map((t) => ({ key: t.key, label: t.label }))} />

      {activeTab === 'PRIVATE_PRACTICE' && (
        <Alert type="info" showIcon message="私教/陪练：教练先在「教练管理-可用时间」设置每周可用时段，会员在小程序端按时间段约课。此处排课用于固定私教/陪练课次。" className="mb-16" />
      )}
      {activeTab === 'GROUP' && (
        <Alert type="warning" showIcon message="大课类（成人/儿童/体能/健身）为最高优先级排课，其他课程不能与之冲突。请选择场地，系统会自动校验场地和教练冲突。" className="mb-16" />
      )}
      {activeTab === 'COMMUNITY' && (
        <Alert type="info" showIcon message="群活动按日期排课，单次付费或群活动多次卡。请选择场地，系统会自动校验冲突。" className="mb-16" />
      )}

      <Table loading={loading} dataSource={filteredData} rowKey="id" size="small" pagination={{ pageSize: 50 }} columns={[
        { title: '日期', dataIndex: 'date', key: 'date' },
        { title: '时间', key: 'time', render: (_, r) => `${r.start_time} - ${r.end_time}` },
        { title: '课程', dataIndex: 'course_name', key: 'course_name' },
        { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => <Tag>{businessTypeName(v)}</Tag> },
        { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
        { title: '场地', dataIndex: 'court_name', key: 'court_name', render: (v) => v || '-' },
        { title: '容量', key: 'capacity', render: (_, r) => `${r.booked_count}/${r.capacity}` },
        { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'SCHEDULED' ? 'blue' : v === 'COMPLETED' ? 'green' : 'red'}>{SESSION_STATUS[v]}</Tag> },
        { title: '操作', key: 'action', render: (_, r) => r.status === 'SCHEDULED' && (
          <Popconfirm title="确认取消此课次？" onConfirm={() => handleCancel(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>取消</Button>
          </Popconfirm>
        )},
      ]} />

      <Modal title="排课" open={modal} onOk={handleCreate} onCancel={() => setModal(false)} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="courseId" label="课程" rules={[{ required: true }]}>
            <Select options={getFilteredCourses().map((c) => ({ label: `${c.name}（${businessTypeName(c.business_type)}）`, value: c.id }))} />
          </Form.Item>
          <Form.Item name="coachId" label="教练" rules={[{ required: true }]}>
            <Select options={coaches.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="courtId" label="场地" tooltip="选择场地后系统会自动校验场地时间冲突">
            <Select allowClear options={courts.map((c) => ({ label: `${c.name}${c.venue_name ? `（${c.venue_name}）` : ''}`, value: c.id }))} />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}><DatePicker /></Form.Item>
          <Form.Item name="timeRange" label="时间段" rules={[{ required: true }]}><TimePicker.RangePicker format="HH:mm" /></Form.Item>
          <Form.Item name="capacity" label="容量"><InputNumber min={1} /></Form.Item>
          <Form.Item name="bookingOpen" label="开放约课" valuePropName="checked"><Select options={[{ label: '开放', value: true }, { label: '不开放', value: false }]} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="批量排课（按周模板）" open={batchModal} onOk={handleBatch} onCancel={() => setBatchModal(false)} width={640}>
        <Form form={batchForm} layout="vertical">
          <Form.Item name="courseId" label="课程" rules={[{ required: true }]}>
            <Select options={getFilteredCourses().map((c) => ({ label: `${c.name}（${businessTypeName(c.business_type)}）`, value: c.id }))} />
          </Form.Item>
          <Form.Item name="coachId" label="教练" rules={[{ required: true }]}>
            <Select options={coaches.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="courtId" label="场地" tooltip="选择场地后系统会自动校验场地时间冲突">
            <Select allowClear options={courts.map((c) => ({ label: `${c.name}${c.venue_name ? `（${c.venue_name}）` : ''}`, value: c.id }))} />
          </Form.Item>
          <Form.Item name="dateRange" label="日期范围" rules={[{ required: true }]}><DatePicker.RangePicker /></Form.Item>
          <Form.Item name="capacity" label="容量"><InputNumber min={1} /></Form.Item>
          <Form.List name="slots" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key}>
                    <Form.Item name={[f.name, 'dayOfWeek']} rules={[{ required: true }]}>
                      <Select placeholder="周几" style={{ width: 100 }} options={[1,2,3,4,5,6,7].map((d) => ({ label: `周${'一二三四五六日'[d-1]}`, value: d }))} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'startTime']} rules={[{ required: true }]}><TimePicker format="HH:mm" placeholder="开始" /></Form.Item>
                    <Form.Item name={[f.name, 'endTime']} rules={[{ required: true }]}><TimePicker format="HH:mm" placeholder="结束" /></Form.Item>
                    <Button onClick={() => remove(f.name)}>删除</Button>
                  </Space>
                ))}
                <Button onClick={() => add({})}>添加时段</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
