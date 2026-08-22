// 会员详情
import { useEffect, useState } from 'react';
import { Card, Descriptions, Tabs, Table, Tag, Button, Space, Modal, Form, Input, Select, Alert } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { MEMBER_CATEGORIES, MEMBER_STATUS, PACK_STATUS, ORDER_STATUS, CHARGE_MODES, memberCategoryName, chargeModeName } from '../utils/constants';

export default function MemberDetail() {
  const message = useMessage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tagModal, setTagModal] = useState(false);
  const [tagForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get(`/members/${id}`);
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const handleStatus = async (status) => {
    try {
      await api.patch(`/members/${id}/status`, { status });
      message.success(status === 'ACTIVE' ? '已启用' : '已停用');
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleAddTag = async () => {
    try {
      const values = await tagForm.validateFields();
      await api.post(`/members/${id}/tags`, values);
      message.success('标签已添加');
      setTagModal(false);
      tagForm.resetFields();
      loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  if (!data) return <div className="page-container">加载中...</div>;

  return (
    <div className="page-container">
      <Space className="mb-16">
        <Button onClick={() => navigate('/members')}>返回列表</Button>
        <Button type="primary" onClick={() => navigate(`/orders?memberId=${id}`)}>购课开单</Button>
        <Button onClick={() => setTagModal(true)}>管理标签</Button>
        {data.status === 'ACTIVE' ? (
          <Button danger onClick={() => handleStatus('DISABLED')}>停用</Button>
        ) : (
          <Button type="primary" onClick={() => handleStatus('ACTIVE')}>启用</Button>
        )}
      </Space>

      {data.alerts?.length > 0 && (
        <Alert className="mb-16" type="warning" showIcon
          message="提醒" description={data.alerts.map((a, i) => <div key={i}>{a.message}</div>)} />
      )}

      <Card className="mb-16">
        <Descriptions title="基本信息" column={3}>
          <Descriptions.Item label="姓名">{data.name}</Descriptions.Item>
          <Descriptions.Item label="手机号">{data.phone}</Descriptions.Item>
          <Descriptions.Item label="性别">{data.gender}</Descriptions.Item>
          <Descriptions.Item label="出生年月">{data.birth_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={data.status === 'ACTIVE' ? 'green' : 'red'}>{MEMBER_STATUS[data.status]}</Tag></Descriptions.Item>
          <Descriptions.Item label="建档人">{data.creator_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="会员分类" span={3}>
            {data.tags?.map((t) => <Tag key={t} color="blue">{memberCategoryName(t)}</Tag>)}
          </Descriptions.Item>
          <Descriptions.Item label="渠道来源" span={3}>
            {data.channel ? `${data.channel.channel?.name || ''} ${data.channel.subChannel ? ' / ' + data.channel.subChannel.name : ''}` : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs items={[
          { key: 'prepaid', label: '预存账户', children: (
            <Descriptions column={3}>
              <Descriptions.Item label="本金余额">￥{data.prepaid.principal_balance}</Descriptions.Item>
              <Descriptions.Item label="赠送余额">￥{data.prepaid.gift_balance}</Descriptions.Item>
              <Descriptions.Item label="可用余额">￥{data.prepaid.total_balance}</Descriptions.Item>
            </Descriptions>
          )},
          { key: 'packs', label: '课包列表', children: (
            <Table dataSource={data.packs} rowKey="id" size="small" pagination={false} columns={[
              { title: '课程', dataIndex: 'course_name', key: 'course_name' },
              { title: '类型', dataIndex: 'pack_type', key: 'pack_type', render: (v) => v === 'SESSION_PACK' ? '次卡' : v === 'MONTHLY' ? '月卡' : v },
              { title: '总节数', dataIndex: 'total_sessions', key: 'total_sessions' },
              { title: '剩余', key: 'remaining', render: (_, r) => r.pack_type === 'MONTHLY' ? `${r.monthly_remaining}/${r.monthly_quota}` : r.remaining_sessions },
              { title: '有效期', key: 'valid', render: (_, r) => `${r.valid_from} ~ ${r.valid_until}` },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : v === 'EXPIRED' ? 'orange' : 'red'}>{PACK_STATUS[v]}</Tag> },
            ]} />
          )},
          { key: 'orders', label: '购课历史', children: (
            <Table dataSource={data.orders} rowKey="id" size="small" pagination={false} columns={[
              { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
              { title: '业务类型', dataIndex: 'business_type', key: 'business_type' },
              { title: '收费模式', dataIndex: 'charge_mode', key: 'charge_mode', render: (v) => chargeModeName(v) },
              { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag>{ORDER_STATUS[v]}</Tag> },
              { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleString() },
            ]} />
          )},
          { key: 'consumption', label: '消费记录', children: (
            <Table dataSource={data.consumptions} rowKey="id" size="small" pagination={false} columns={[
              { title: '课程', dataIndex: 'course_name', key: 'course_name' },
              { title: '日期', dataIndex: 'date', key: 'date' },
              { title: '时间', dataIndex: 'start_time', key: 'start_time' },
              { title: '扣减类型', dataIndex: 'charge_mode', key: 'charge_mode', render: (v) => chargeModeName(v) },
              { title: '节数', dataIndex: 'sessions_used', key: 'sessions_used' },
              { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => v ? `￥${v}` : '-' },
            ]} />
          )},
          { key: 'attendance', label: '出勤记录', children: (
            <Table dataSource={data.attendance} rowKey="id" size="small" pagination={false} columns={[
              { title: '课程', dataIndex: 'course_name', key: 'course_name' },
              { title: '日期', dataIndex: 'date', key: 'date' },
              { title: '时间', dataIndex: 'start_time', key: 'start_time' },
              { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => {
                const colors = { PRESENT: 'green', ABSENT: 'red', LEAVE: 'orange', PENDING_PAY: 'volcano' };
                return <Tag color={colors[v]}>{({ PRESENT: '出勤', ABSENT: '缺勤', LEAVE: '请假', PENDING_PAY: '待补费' })[v]}</Tag>;
              }},
            ]} />
          )},
        ]} />
      </Card>

      <Modal title="管理标签" open={tagModal} onOk={handleAddTag} onCancel={() => setTagModal(false)}>
        <Form form={tagForm} layout="vertical">
          <Form.Item name="categoryCode" label="添加标签" rules={[{ required: true }]}>
            <Select options={MEMBER_CATEGORIES.map((c) => ({ label: c.name, value: c.code }))} />
          </Form.Item>
          <Form.Item name="reason" label="原因"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
