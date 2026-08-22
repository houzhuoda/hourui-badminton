// 渠道来源管理
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Tree, Space, Tabs, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { CHANNEL_TYPES } from '../utils/constants';

export default function Channels() {
  const message = useMessage();
  const [data, setData] = useState({ tree: [], stats: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('tree');

  const loadData = async () => {
    setLoading(true);
    try {
      const treeRes = await api.get('/channels');
      let stats = [];
      try { const statsRes = await api.get('/channels/stats/summary'); stats = (statsRes && statsRes.channels) || []; } catch {}
      setData({ tree: treeRes && treeRes.tree ? treeRes.tree : [], stats });
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/channels', values);
      message.success('新增成功'); setModal(false); form.resetFields(); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleStatus = async (id, status) => {
    try { await api.patch(`/channels/${id}/status`, { status }); message.success('已更新'); loadData(); }
    catch (e) { message.error(e.message); }
  };

  const treeData = data.tree.map((c) => ({
    key: c.id,
    title: <Space><span>{c.name}</span><Tag>{CHANNEL_TYPES.find((t) => t.code === c.type)?.name}</Tag>
      <Tag color={c.status === 'ACTIVE' ? 'green' : 'red'}>{c.status === 'ACTIVE' ? '启用' : '停用'}</Tag>
      <span style={{ color: '#999' }}>会员 {c.member_count || 0}</span>
    </Space>,
    children: (c.subChannels || []).map((s) => ({
      key: s.id,
      title: <Space><span>{s.name}</span><Tag color={s.status === 'ACTIVE' ? 'green' : 'red'}>{s.status === 'ACTIVE' ? '启用' : '停用'}</Tag>
        <span style={{ color: '#999' }}>会员 {s.member_count || 0}</span>
      </Space>,
    })),
  }));

  return (
    <div className="page-container">
      <div className="flex-between mb-16">
        <h2>渠道来源管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>新增渠道</Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'tree', label: '渠道树形结构', children: (
          <Card loading={loading}>
            <Tree treeData={treeData} defaultExpandAll showLine={{ showLeafIcon: false }} />
          </Card>
        )},
        { key: 'stats', label: '获客统计', children: (
          <Table loading={loading} dataSource={data.stats} rowKey="id" size="small" pagination={false} columns={[
            { title: '一级渠道', dataIndex: 'name', key: 'name' },
            { title: '二级渠道', dataIndex: 'sub_channel_name', key: 'sub_channel_name', render: (v) => v || '-' },
            { title: '会员数', dataIndex: ['stats', 'newMembers'], key: 'newMembers', render: (_, r) => r.stats?.newMembers ?? 0 },
            { title: '总收入', dataIndex: ['stats', 'orderAmount'], key: 'orderAmount', render: (_, r) => r.stats?.orderAmount ? `￥${r.stats.orderAmount}` : '-' },
          ]} />
        )},
      ]} />

      <Modal title="新增渠道" open={modal} onOk={handleSave} onCancel={() => setModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="渠道名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="渠道类型" rules={[{ required: true }]}>
            <Select options={CHANNEL_TYPES.map((c) => ({ label: c.name, value: c.code }))} />
          </Form.Item>
          <Form.Item name="parentId" label="父渠道（留空为一级）">
            <Select allowClear placeholder="选择父渠道" options={data.tree.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
