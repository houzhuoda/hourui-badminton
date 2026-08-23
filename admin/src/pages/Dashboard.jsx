// 经营看板
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, DatePicker, Button, Modal, Spin } from 'antd';
import { DollarOutlined, TeamOutlined, UserAddOutlined, ClockCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../api';
import { useMessage } from '../utils/useMessage';
const { RangePicker } = DatePicker;

const METRIC_CONFIG = [
  { key: 'todayIncome', title: '今日收入', prefix: '￥', icon: null, color: null },
  { key: 'monthIncome', title: '本月收入', prefix: '￥', icon: null, color: '#1890ff' },
  { key: 'monthConsumption', title: '本月课消', suffix: '节', icon: null, color: null },
  { key: 'consumedAmount', title: '已消课金额', prefix: '￥', icon: null, color: '#52c41a' },
  { key: 'pendingConsumption', title: '待消课', suffix: '节', icon: null, color: '#faad14' },
  { key: 'pendingAmount', title: '待消课金额', prefix: '￥', icon: null, color: '#faad14' },
  { key: 'activeMembers', title: '在籍会员', icon: <TeamOutlined />, color: null },
  { key: 'newMembers', title: '本月新增', icon: <UserAddOutlined />, color: '#52c41a' },
  { key: 'expiringMembers', title: '本月到期', icon: <ClockCircleOutlined />, color: '#faad14' },
  { key: 'activeCoaches', title: '活跃教练', icon: <TrophyOutlined />, color: null },
];

const METRIC_TITLES = {
  todayIncome: '今日收入明细',
  monthIncome: '本月收入明细',
  monthConsumption: '本月课消明细',
  consumedAmount: '已消课金额明细',
  pendingConsumption: '待消课明细',
  pendingAmount: '待消课金额明细',
  activeMembers: '在籍会员明细',
  newMembers: '本月新增会员明细',
  expiringMembers: '本月到期会员明细',
  activeCoaches: '活跃教练明细',
};

export default function Dashboard() {
  const message = useMessage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('month');
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = async (r) => {
    setLoading(true);
    try {
      const d = await api.get('/dashboard', { params: { range: r } });
      setData(d);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(range); }, [range]);

  const handleCardClick = async (type) => {
    setDetailModal(type);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const d = await api.get('/dashboard/detail', { params: { type } });
      setDetailData(d);
    } catch (e) { message.error(e.message); }
    setDetailLoading(false);
  };

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

  const renderMetricCard = (cfg) => {
    const value = data?.metrics?.[cfg.key] ?? 0;
    return (
      <Col span={3} key={cfg.key}>
        <Card
          hoverable
          style={{ cursor: 'pointer' }}
          onClick={() => handleCardClick(cfg.key)}
        >
          <Statistic
            title={<span style={{ color: '#1890ff' }}>{cfg.title} <span style={{ fontSize: 10, color: '#bbb' }}>▾</span></span>}
            prefix={cfg.prefix === '￥' ? '￥' : cfg.icon}
            value={value}
            suffix={cfg.suffix}
            valueStyle={cfg.color ? { color: cfg.color } : undefined}
          />
        </Card>
      </Col>
    );
  };

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
            {METRIC_CONFIG.slice(0, 8).map(renderMetricCard)}
          </Row>
          <Row gutter={16} className="mb-24">
            {METRIC_CONFIG.slice(8).map(renderMetricCard)}
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
                { title: '操作', key: 'action', render: () => <Button size="small" type="link">提醒续费</Button> },
              ]}
            />
          </Card>
        </>
      )}

      <Modal
        title={METRIC_TITLES[detailModal] || '明细'}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={900}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : detailData ? (
          <Table
            dataSource={detailData.rows || []}
            columns={detailData.columns || []}
            rowKey={(r, i) => r.id || r.pack_id || i}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
