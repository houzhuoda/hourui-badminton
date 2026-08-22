// 会员管理列表
import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Card, Tag, Modal, Form } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { MEMBER_CATEGORIES, MEMBER_STATUS, GENDERS, businessTypeName, memberCategoryName } from '../utils/constants';

export default function Members() {
  const message = useMessage();
  const navigate = useNavigate();
  const [data, setData] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState({ page: 1, pageSize: 20 });
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [channels, setChannels] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get('/members', { params });
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const loadChannels = async () => {
    try {
      const d = await api.get('/channels', { params: { status: 'ACTIVE' } });
      setChannels(d.tree || []);
    } catch {}
  };

  useEffect(() => { loadData(); loadChannels(); }, [params]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/members', values);
      message.success('建档成功');
      setCreateModal(false);
      form.resetFields();
      loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  return (
    <div className="page-container">
      <div className="flex-between mb-16">
        <h2>会员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>新建会员</Button>
      </div>

      <Card className="mb-16">
        <Space wrap>
          <Input.Search placeholder="姓名/手机号" allowClear style={{ width: 200 }} onSearch={(v) => setParams({ ...params, keyword: v, page: 1 })} />
          <Select placeholder="会员分类" allowClear style={{ width: 150 }} onChange={(v) => setParams({ ...params, categoryCode: v, page: 1 })}
            options={MEMBER_CATEGORIES.map((c) => ({ label: c.name, value: c.code }))} />
          <Select placeholder="状态" allowClear style={{ width: 100 }} onChange={(v) => setParams({ ...params, status: v, page: 1 })}
            options={Object.entries(MEMBER_STATUS).map(([k, v]) => ({ label: v, value: k }))} />
          <Select placeholder="到期状态" allowClear style={{ width: 120 }} onChange={(v) => setParams({ ...params, expiryStatus: v, page: 1 })}
            options={[{ label: '即将到期', value: 'EXPIRING' }, { label: '已到期', value: 'EXPIRED' }]} />
        </Space>
      </Card>

      <Table
        loading={loading}
        dataSource={data.list}
        rowKey="id"
        pagination={{ current: params.page, pageSize: params.pageSize, total: data.total, onChange: (page, pageSize) => setParams({ ...params, page, pageSize }) }}
        onRow={(r) => ({ onClick: () => navigate(`/members/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: '姓名', dataIndex: 'name', key: 'name' },
          { title: '手机号', dataIndex: 'phone', key: 'phone' },
          { title: '会员分类', key: 'tags', render: (_, r) => (r.tags || []).map((t) => <Tag key={t} color="blue">{memberCategoryName(t)}</Tag>) },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{MEMBER_STATUS[v]}</Tag> },
          { title: '建档销售', dataIndex: 'creator_name', key: 'creator_name' },
          { title: '建档时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleDateString() },
        ]}
      />

      <Modal title="新建会员" open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, pattern: /^\d{11}$/, message: '请输入11位手机号' }]}><Input /></Form.Item>
          <Form.Item name="gender" label="性别"><Select options={GENDERS.map((g) => ({ label: g.name, value: g.code }))} /></Form.Item>
          <Form.Item name="birthDate" label="出生年月"><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="categoryCode" label="会员分类" rules={[{ required: true }]}>
            <Select options={MEMBER_CATEGORIES.map((c) => ({ label: c.name, value: c.code }))} />
          </Form.Item>
          <Form.Item name="channelId" label="渠道来源">
            <Select allowClear placeholder="选择渠道" options={channels.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
