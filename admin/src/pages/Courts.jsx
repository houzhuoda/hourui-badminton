// 场地管理
import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Card, Tabs, Tag, Popconfirm, Checkbox } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api, { createApi } from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES } from '../utils/constants';

const venueApi = createApi('/courts/venues');
const courtApi = createApi('/courts/courts');

export default function Courts() {
  const message = useMessage();
  const [venues, setVenues] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('courts');
  const [venueModal, setVenueModal] = useState(false);
  const [courtModal, setCourtModal] = useState(false);
  const [editVenue, setEditVenue] = useState(null);
  const [editCourt, setEditCourt] = useState(null);
  const [venueForm] = Form.useForm();
  const [courtForm] = Form.useForm();

  const loadVenues = async () => { try { setVenues(await venueApi.list()); } catch (e) { message.error(e.message); } };
  const loadCourts = async () => { try { setCourts(await courtApi.list()); } catch (e) { message.error(e.message); } };

  const loadData = () => { setLoading(true); Promise.all([loadVenues(), loadCourts()]).finally(() => setLoading(false)); };
  useEffect(() => { loadData(); }, []);

  const handleSaveVenue = async () => {
    try {
      const values = await venueForm.validateFields();
      if (editVenue) { await venueApi.update(editVenue.id, values); message.success('已更新'); }
      else { await venueApi.create(values); message.success('已新增'); }
      setVenueModal(false); venueForm.resetFields(); setEditVenue(null); loadVenues();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveCourt = async () => {
    try {
      const values = await courtForm.validateFields();
      const payload = { ...values, businessType: Array.isArray(values.businessType) ? values.businessType.join(',') : values.businessType };
      if (editCourt) { await courtApi.update(editCourt.id, payload); message.success('已更新'); }
      else { await courtApi.create(payload); message.success('已新增'); }
      setCourtModal(false); courtForm.resetFields(); setEditCourt(null); loadCourts();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleDeleteVenue = async (id) => {
    try { await venueApi.remove(id); message.success('已删除'); loadVenues(); }
    catch (e) { message.error(e.message); }
  };

  const handleDeleteCourt = async (id) => {
    try { await courtApi.remove(id); message.success('已删除'); loadCourts(); }
    catch (e) { message.error(e.message); }
  };

  const bizName = (code) => { const b = BUSINESS_TYPES.find((x) => x.code === code); return b ? b.name : code; };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'courts', label: '场地管理', children: (
          <Card>
            <Button type="primary" icon={<PlusOutlined />} className="mb-16" onClick={() => { courtForm.resetFields(); setEditCourt(null); setCourtModal(true); }}>新增场地</Button>
            <Table loading={loading} dataSource={courts} rowKey="id" size="small" columns={[
              { title: '场地名称', dataIndex: 'name', key: 'name' },
              { title: '所属场馆', dataIndex: 'venue_name', key: 'venue_name' },
              { title: '适用业务', dataIndex: 'business_type', key: 'business_type', render: (v) => v ? v.split(',').filter(Boolean).map((t) => <Tag color="blue" key={t}>{bizName(t)}</Tag>) : <span>通用</span> },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '启用' : '停用'}</Tag> },
              { title: '操作', key: 'action', render: (_, r) => (
                <Space>
                  <Button size="small" type="link" onClick={() => { setEditCourt(r); courtForm.setFieldsValue({ ...r, businessType: r.business_type ? r.business_type.split(',').filter(Boolean) : [] }); setCourtModal(true); }}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => handleDeleteCourt(r.id)}>
                    <Button size="small" type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
              )},
            ]} />
          </Card>
        )},
        { key: 'venues', label: '场馆管理', children: (
          <Card>
            <Button type="primary" icon={<PlusOutlined />} className="mb-16" onClick={() => { venueForm.resetFields(); setEditVenue(null); setVenueModal(true); }}>新增场馆</Button>
            <Table loading={loading} dataSource={venues} rowKey="id" size="small" columns={[
              { title: '场馆名称', dataIndex: 'name', key: 'name' },
              { title: '编码', dataIndex: 'code', key: 'code' },
              { title: '地址', dataIndex: 'address', key: 'address', render: (v) => v || '-' },
              { title: '默认', dataIndex: 'is_default', key: 'is_default', render: (v) => v ? <Tag color="green">默认</Tag> : '-' },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '启用' : '停用'}</Tag> },
              { title: '操作', key: 'action', render: (_, r) => (
                <Space>
                  <Button size="small" type="link" onClick={() => { setEditVenue(r); venueForm.setFieldsValue(r); setVenueModal(true); }}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => handleDeleteVenue(r.id)}>
                    <Button size="small" type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
              )},
            ]} />
          </Card>
        )},
      ]} />

      <Modal title={editVenue ? '编辑场馆' : '新增场馆'} open={venueModal} onOk={handleSaveVenue} onCancel={() => { setVenueModal(false); setEditVenue(null); }}>
        <Form form={venueForm} layout="vertical">
          <Form.Item name="name" label="场馆名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="场馆编码"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="isDefault" label="设为默认场馆" valuePropName="checked"><Checkbox /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editCourt ? '编辑场地' : '新增场地'} open={courtModal} onOk={handleSaveCourt} onCancel={() => { setCourtModal(false); setEditCourt(null); }}>
        <Form form={courtForm} layout="vertical">
          <Form.Item name="venueId" label="所属场馆" rules={[{ required: true }]}>
            <Select options={venues.map((v) => ({ label: v.name, value: v.id }))} />
          </Form.Item>
          <Form.Item name="name" label="场地名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="businessType" label="适用业务类型（留空=通用）">
            <Select mode="multiple" allowClear options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
