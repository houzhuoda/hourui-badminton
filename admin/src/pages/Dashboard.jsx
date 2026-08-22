// 经营看板
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, DatePicker, Button } from 'antd';
import { DollarOutlined, TeamOutlined, UserAddOutlined, ClockCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import api from '../api';
import { useMessage } from '../utils/useMessage';
const { RangePicker } = DatePicker;

export default function Dashboard() {
  const message = useMessage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('month');

  const loadData = async (r) => {
    setLoading(true);
    try {
      const d = await api.get('/dashboard', { params: { range: r } });
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(range); }, [range]);

  const trendOption = data?.trend ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增购课', '续费', '合计'] },
    xAxis: { type: 'category', data: data.trend.map((t) => t.date) },
    yAxis: { type: 'value' },
    series: [
      { name: '新增购课', type: 'line', data: data.trend.map((t) => t.new_income), smooth: true },
      { name: '续费', type: 'line', data: data.trend.map((t) => t.renew_income), smooth: true },
      { name: '合计', type: 'line', data: data.trend.map((t) => t.total_income), smooth: true },
    ],
  } : null;

  const businessOption = data?.businessIncome ? {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: data.businessIncome.filter((b) => b.income > 0).map((b) => ({ name: b.name, value: b.income })),
    }],
  } : null;

  return (
    <div className="page-container">
      <div className="flex-between mb-24">
        <h2>经营看板</h2>
        <Button.Group>
          {['today', '7d', '30d', 'month'].map((r) => (
            <Button key={r} type={range === r ? 'primary' : 'default'} onClick={() => setRange(r)}>
              {r === 'today' ? '今日' : r === '7d' ? '近7天' : r === '30d' ? '近30天' : '本月'}
            </Button>
          ))}
        </Button.Group>
      </div>

      {data && (
        <>
          <Row gutter={16} className="mb-24">
            <Col span={3}><Card><Statistic title="今日收入" prefix="￥" value={data.metrics.todayIncome} /></Card></Col>
            <Col span={3}><Card><Statistic title="本月收入" prefix="￥" value={data.metrics.monthIncome} valueStyle={{ color: '#1890ff' }} /></Card></Col>
            <Col span={3}><Card><Statistic title="本月课消" value={data.metrics.monthConsumption} suffix="节" /></Card></Col>
            <Col span={3}><Card><Statistic title="在籍会员" value={data.metrics.activeMembers} prefix={<TeamOutlined />} /></Card></Col>
            <Col span={3}><Card><Statistic title="本月新增" value={data.metrics.newMembers} prefix={<UserAddOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={3}><Card><Statistic title="本月到期" value={data.metrics.expiringMembers} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
            <Col span={3}><Card><Statistic title="活跃教练" value={data.metrics.activeCoaches} prefix={<TrophyOutlined />} /></Card></Col>
          </Row>

          <Row gutter={16} className="mb-24">
            <Col span={16}>
              <Card title="近30天收入趋势" loading={loading}>
                {trendOption && <ReactECharts option={trendOption} style={{ height: 300 }} />}
              </Card>
            </Col>
            <Col span={8}>
              <Card title="业务类型收入构成" loading={loading}>
                {businessOption && <ReactECharts option={businessOption} style={{ height: 300 }} />}
              </Card>
            </Col>
          </Row>

          <Card title="未来7天到期会员" loading={loading}>
            <Table
              dataSource={data.expiringList}
              rowKey="pack_id"
              size="small"
              pagination={false}
              columns={[
                { title: '会员', dataIndex: 'member_name', key: 'member_name' },
                { title: '课程', dataIndex: 'course_name', key: 'course_name' },
                { title: '到期日', dataIndex: 'valid_until', key: 'valid_until', render: (v) => <Tag color="orange">{v}</Tag> },
                { title: '剩余', key: 'remaining', render: (_, r) => r.pack_type === 'SESSION_PACK' ? `${r.remaining_sessions}节` : `${r.monthly_remaining}次` },
                { title: '预存余额', dataIndex: 'total_balance', key: 'total_balance', render: (v) => v ? `￥${v}` : '-' },
                { title: '操作', key: 'action', render: () => <Button size="small" type="link">提醒续费</Button> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
