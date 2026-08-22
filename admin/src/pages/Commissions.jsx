// 销售提成设置
import { useEffect, useState } from 'react';
import { Card, Table, InputNumber, Button, Tabs, Tag } from 'antd';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, COMMISSION_TYPES, businessTypeName } from '../utils/constants';

export default function Commissions() {
  const message = useMessage();
  const [rules, setRules] = useState({ matrix: {}, records: [] });
  const [loading, setLoading] = useState(true);
  const [editMatrix, setEditMatrix] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get('/commissions/rules');
      setRules(d);
      setEditMatrix(d.matrix || {});
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      const ruleList = [];
      Object.entries(editMatrix).forEach(([bt, types]) => {
        Object.entries(types).forEach(([ct, rate]) => {
          ruleList.push({ businessType: bt, commissionType: ct, rate });
        });
      });
      await api.put('/commissions/rules', { rules: ruleList });
      message.success('销售提成设置已保存');
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => businessTypeName(v) },
    { title: '新客提成(%)', key: 'new', render: (_, r) => (
      <InputNumber min={0} max={100} value={editMatrix[r.business_type]?.NEW ?? 0}
        onChange={(v) => setEditMatrix({ ...editMatrix, [r.business_type]: { ...editMatrix[r.business_type], NEW: v } })} />
    )},
    { title: '续费提成(%)', key: 'renew', render: (_, r) => (
      <InputNumber min={0} max={100} value={editMatrix[r.business_type]?.RENEW ?? 0}
        onChange={(v) => setEditMatrix({ ...editMatrix, [r.business_type]: { ...editMatrix[r.business_type], RENEW: v } })} />
    )},
  ];

  return (
    <div className="page-container">
      <h2>销售提成设置</h2>
      <Tabs items={[
        { key: 'rules', label: '提成矩阵', children: (
          <>
            <Button type="primary" className="mb-16" onClick={handleSave}>保存设置</Button>
            <Table loading={loading} dataSource={BUSINESS_TYPES.map((b) => ({ business_type: b.code, key: b.code }))} columns={columns} pagination={false} size="small" />
            <div style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
              说明：新客首单提成与续费提成可分别设置。教练开启销售能力后同样适用此矩阵。
            </div>
          </>
        )},
        { key: 'records', label: '提成记录', children: (
          <Table dataSource={rules.records} rowKey="id" size="small" pagination={{ pageSize: 20 }} columns={[
            { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
            { title: '受益人', dataIndex: 'beneficiary_name', key: 'beneficiary_name' },
            { title: '受益人类型', dataIndex: 'beneficiary_type', key: 'beneficiary_type', render: (v) => v === 'sales' ? '销售' : v === 'coach' ? '教练' : v },
            { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => businessTypeName(v) },
            { title: '提成类型', dataIndex: 'commission_type', key: 'commission_type', render: (v) => COMMISSION_TYPES[v] },
            { title: '比例', dataIndex: 'rate', key: 'rate', render: (v) => `${v}%` },
            { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
            { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? '有效' : '已撤销'}</Tag> },
            { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleString() },
          ]} />
        )},
      ]} />
    </div>
  );
}
