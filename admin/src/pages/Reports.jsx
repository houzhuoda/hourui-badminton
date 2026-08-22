// 统计报表
import { useEffect, useState } from 'react';
import { Card, Tabs, Table, DatePicker, Button, Tag, Select, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, businessTypeName, COMMISSION_TYPES } from '../utils/constants';

const { RangePicker } = DatePicker;

export default function Reports() {
  const message = useMessage();
  const [tab, setTab] = useState('coach');
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { startDate: range[0].format('YYYY-MM-DD'), endDate: range[1].format('YYYY-MM-DD') };
      const d = await api.get(`/reports/${tab}`, { params });
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [tab, range]);

  const renderCoach = () => (
    <Table loading={loading} dataSource={data?.list || []} rowKey="coach_id" size="small" pagination={false} columns={[
      { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
      { title: '上课节数', dataIndex: 'session_count', key: 'session_count' },
      { title: '出勤人次', dataIndex: 'present_count', key: 'present_count' },
      { title: '课时费合计', dataIndex: 'total_lesson_fee', key: 'total_lesson_fee', render: (v) => `￥${v}` },
      { title: '分成金额', dataIndex: 'total_share', key: 'total_share', render: (v) => `￥${v}` },
      { title: '销售提成', dataIndex: 'sales_commission', key: 'sales_commission', render: (v) => v ? `￥${v}` : '-' },
    ]} />
  );

  const renderSales = () => (
    <Table loading={loading} dataSource={data?.list || []} rowKey="sales_id" size="small" pagination={false} columns={[
      { title: '销售', dataIndex: 'sales_name', key: 'sales_name' },
      { title: '新客单数', dataIndex: 'new_count', key: 'new_count' },
      { title: '续费单数', dataIndex: 'renew_count', key: 'renew_count' },
      { title: '新客金额', dataIndex: 'new_amount', key: 'new_amount', render: (v) => `￥${v}` },
      { title: '续费金额', dataIndex: 'renew_amount', key: 'renew_amount', render: (v) => `￥${v}` },
      { title: '合计金额', dataIndex: 'total_amount', key: 'total_amount', render: (v) => `￥${v}` },
      { title: '提成合计', dataIndex: 'total_commission', key: 'total_commission', render: (v) => `￥${v}` },
    ]} />
  );

  const renderConsumption = () => (
    <>
      <Table loading={loading} dataSource={data?.byBusiness || []} rowKey="business_type" size="small" pagination={false} className="mb-24" columns={[
        { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => businessTypeName(v) },
        { title: '核销节数', dataIndex: 'sessions', key: 'sessions' },
        { title: '核销金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
      ]} />
      <Card title="课消趋势">
        {data?.trend && <ReactECharts option={{ tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: data.trend.map((t) => t.date) }, yAxis: { type: 'value' }, series: [{ name: '课消节数', type: 'bar', data: data.trend.map((t) => t.sessions) }] }} style={{ height: 300 }} />}
      </Card>
    </>
  );

  const renderChannel = () => (
    <>
      <Table loading={loading} dataSource={data?.firstLevel || []} rowKey="channel_id" size="small" pagination={false} className="mb-24" columns={[
        { title: '一级渠道', dataIndex: 'channel_name', key: 'channel_name' },
        { title: '会员数', dataIndex: 'member_count', key: 'member_count' },
        { title: '总收入', dataIndex: 'total_income', key: 'total_income', render: (v) => `￥${v}` },
        { title: '占比', dataIndex: 'percentage', key: 'percentage', render: (v) => `${v}%` },
      ]} />
      <Card title="二级渠道明细">
        <Table loading={loading} dataSource={data?.secondLevel || []} rowKey="sub_channel_id" size="small" pagination={false} columns={[
          { title: '一级渠道', dataIndex: 'channel_name', key: 'channel_name' },
          { title: '二级渠道', dataIndex: 'sub_channel_name', key: 'sub_channel_name' },
          { title: '会员数', dataIndex: 'member_count', key: 'member_count' },
          { title: '总收入', dataIndex: 'total_income', key: 'total_income', render: (v) => `￥${v}` },
        ]} />
      </Card>
    </>
  );

  return (
    <div className="page-container">
      <div className="flex-between mb-16">
        <h2>统计报表</h2>
        <RangePicker value={range} onChange={(v) => v && setRange(v)} />
      </div>

      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'coach', label: '教练上课报表', children: renderCoach() },
        { key: 'sales', label: '销售业绩报表', children: renderSales() },
        { key: 'consumption', label: '课消报表', children: renderConsumption() },
        { key: 'channel', label: '渠道获客报表', children: renderChannel() },
      ]} />
    </div>
  );
}
