// 私教/陪练排班 — 教练日历网格
import { useEffect, useState } from 'react';
import { Card, Select, DatePicker, Button, Space, Row, Col, Tag, Tabs, Alert, message } from 'antd';
import { LeftOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import dayjs from 'dayjs';

const HOUR_RANGE = Array.from({ length: 14 }, (_, i) => i + 8); // 8-21

const STATUS_CONFIG = {
  AVAILABLE: { label: '可预约', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  REST: { label: '休息', color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7' },
  BOOKED: { label: '已预约', color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff' },
  CONFLICT: { label: '有课程', color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' },
  UNSCHEDULED: { label: '未排班', color: '#999', bg: '#fafafa', border: '#d9d9d9' },
};

export default function SchedulePrivate() {
  const messageApi = useMessage();
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [gridDate, setGridDate] = useState(dayjs());
  const [slots, setSlots] = useState([]);
  const [originalSlots, setOriginalSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchWeekStart, setBatchWeekStart] = useState(dayjs().startOf('week'));
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedHours, setSelectedHours] = useState([]);

  const loadCoaches = async () => {
    try {
      const list = await api.get('/coaches');
      const active = list.filter((c) => c.status === 'ACTIVE');
      setCoaches(active);
      if (active.length > 0 && !selectedCoach) setSelectedCoach(active[0].id);
    } catch (e) { messageApi.error(e.message); }
  };

  const loadGrid = async () => {
    if (!selectedCoach) return;
    setLoading(true);
    setDirty(false);
    try {
      const data = await api.get(`/private-bookings/${selectedCoach}/daily-grid`, { params: { date: gridDate.format('YYYY-MM-DD') } });
      const gridSlots = data.slots || [];
      setSlots(gridSlots);
      setOriginalSlots(JSON.parse(JSON.stringify(gridSlots)));
    } catch (e) { messageApi.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadCoaches(); }, []);
  useEffect(() => { if (selectedCoach) loadGrid(); }, [selectedCoach, gridDate]);

  // 单日模式：本地编辑，不立即保存
  const toggleSlotLocal = (slot) => {
    if (slot.status === 'BOOKED' || slot.status === 'CONFLICT') return;
    const newStatus = slot.status === 'AVAILABLE' ? 'REST' : 'AVAILABLE';
    setSlots((prev) => prev.map((s) => s.hour === slot.hour ? { ...s, status: newStatus } : s));
    setDirty(true);
  };

  // 保存单日排班
  const saveSchedule = async () => {
    if (!dirty || !selectedCoach) return;
    setSaving(true);
    try {
      const dateStr = gridDate.format('YYYY-MM-DD');
      // 找出有变化的时段
      const changes = [];
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].status !== originalSlots[i]?.status) {
          changes.push({ startHour: slots[i].hour, status: slots[i].status });
        }
      }
      // 逐个提交变化
      for (const c of changes) {
        await api.put(`/private-bookings/${selectedCoach}/toggle-slot`, {
          date: dateStr,
          startHour: c.startHour,
          status: c.status,
        });
      }
      messageApi.success(`已保存 ${changes.length} 个时段变更，会员端立即可见`);
      setDirty(false);
      await loadGrid();
    } catch (e) { messageApi.error(e.message); }
    setSaving(false);
  };

  // 放弃修改
  const discardChanges = () => {
    setSlots(JSON.parse(JSON.stringify(originalSlots)));
    setDirty(false);
  };

  const batchSetAllLocal = (status) => {
    setSlots((prev) => prev.map((s) => {
      if (s.status === 'BOOKED' || s.status === 'CONFLICT') return s;
      if (s.status === 'UNSCHEDULED' && status === 'AVAILABLE') return s;
      if (s.status === status) return s;
      return { ...s, status };
    }));
    setDirty(true);
  };

  // 批量模式
  const weekDates = Array.from({ length: 7 }, (_, i) => batchWeekStart.add(i, 'day'));
  const toggleBatchDate = (dateStr) => {
    setSelectedDates((prev) => prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort());
  };
  const toggleBatchHour = (h) => {
    setSelectedHours((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  };

  const submitBatch = async (status) => {
    if (selectedDates.length === 0) { messageApi.warning('请选择日期'); return; }
    if (selectedHours.length === 0) { messageApi.warning('请选择时段'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/private-bookings/${selectedCoach}/batch-schedule`, {
        dates: selectedDates, hours: selectedHours, status,
      });
      messageApi.success(`已保存 ${res.count} 个时段，会员端立即可见`);
      setBatchMode(false); setSelectedDates([]); setSelectedHours([]);
      await loadGrid();
    } catch (e) { messageApi.error(e.message); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>私教/陪练排班</h2>
        <Space>
          {dirty && !batchMode && (
            <>
              <Button icon={<SaveOutlined />} type="primary" loading={saving} onClick={saveSchedule}>
                保存排班
              </Button>
              <Button onClick={discardChanges}>放弃</Button>
            </>
          )}
          <Button type={batchMode ? 'primary' : 'default'} onClick={() => { setBatchMode(!batchMode); setDirty(false); }}>
            {batchMode ? '返回单日模式' : '批量排班'}
          </Button>
        </Space>
      </div>

      <Alert type="info" showIcon message="选择教练和日期，在网格中点击时段切换「上班/休息」。绿色=可预约，红色=休息，蓝色=已约，橙色=有其他课程冲突。修改后点击「保存排班」生效。" className="mb-16" />

      {!batchMode ? (
        <>
          <Card className="mb-16">
            <Space wrap>
              <span>教练：</span>
              <Select style={{ width: 200 }} value={selectedCoach} onChange={setSelectedCoach}
                options={coaches.map((c) => ({ label: c.name, value: c.id }))} />
              <span>日期：</span>
              <DatePicker value={gridDate} onChange={(v) => { if (dirty) { messageApi.warning('请先保存或放弃当前修改'); return; } if (v) setGridDate(v); }} />
              <Button onClick={() => batchSetAllLocal('AVAILABLE')}>全部上班</Button>
              <Button onClick={() => batchSetAllLocal('REST')}>全部休息</Button>
              {dirty && <Tag color="orange">未保存</Tag>}
            </Space>
          </Card>

          <Row gutter={[12, 12]}>
            {HOUR_RANGE.map((h) => {
              const slot = slots.find((s) => s.hour === h) || { hour: h, start_time: `${String(h).padStart(2,'0')}:00`, end_time: `${String(h+1).padStart(2,'0')}:00`, status: 'UNSCHEDULED' };
              const cfg = STATUS_CONFIG[slot.status];
              const clickable = slot.status === 'AVAILABLE' || slot.status === 'REST' || slot.status === 'UNSCHEDULED';
              const isChanged = originalSlots.find((s) => s.hour === h)?.status !== slot.status;
              return (
                <Col key={h} span={4}>
                  <div onClick={() => clickable && toggleSlotLocal(slot)}
                    style={{
                      border: `2px solid ${cfg.border}`, background: cfg.bg, borderRadius: 12, padding: '16px 8px', textAlign: 'center',
                      cursor: clickable ? 'pointer' : 'default', transition: 'all 0.2s',
                      outline: isChanged ? '3px solid #FF4D28' : 'none',
                      outlineOffset: '2px',
                    }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{slot.start_time}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>- {slot.end_time}</div>
                    <Tag color={cfg.color} style={{ marginTop: 8, margin: 0 }}>{cfg.label}</Tag>
                    {clickable && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{slot.status === 'AVAILABLE' ? '点击休息' : '点击上班'}</div>}
                    {isChanged && <div style={{ fontSize: 10, color: '#FF4D28', marginTop: 2 }}>已修改</div>}
                  </div>
                </Col>
              );
            })}
          </Row>

          <div style={{ marginTop: 16, display: 'flex', gap: 24, fontSize: 12, color: '#999' }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: v.bg, border: `2px solid ${v.border}` }} />
                {v.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h3 style={{ marginBottom: 16 }}>批量排班 — 教练：{coaches.find((c) => c.id === selectedCoach)?.name}</h3>

          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <span>选择日期（可多选）：</span>
              <Button size="small" icon={<LeftOutlined />} onClick={() => setBatchWeekStart(batchWeekStart.subtract(7, 'day'))} />
              <span>{batchWeekStart.format('MM/DD')} - {batchWeekStart.add(6, 'day').format('MM/DD')}</span>
              <Button size="small" icon={<RightOutlined />} onClick={() => setBatchWeekStart(batchWeekStart.add(7, 'day'))} />
            </Space>
            <Row gutter={[8, 8]}>
              {weekDates.map((d) => {
                const dateStr = d.format('YYYY-MM-DD');
                const isSelected = selectedDates.includes(dateStr);
                const wd = ['日','一','二','三','四','五','六'][d.day()];
                return (
                  <Col key={dateStr} span={3}>
                    <div onClick={() => toggleBatchDate(dateStr)}
                      style={{
                        border: `2px solid ${isSelected ? '#FF4D28' : '#d9d9d9'}`, background: isSelected ? '#fff2f0' : '#fff',
                        borderRadius: 8, padding: '12px 4px', textAlign: 'center', cursor: 'pointer',
                      }}>
                      <div style={{ fontSize: 11, color: '#999' }}>周{wd}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? '#FF4D28' : '#333' }}>{d.format('MM/DD')}</div>
                    </div>
                  </Col>
                );
              })}
            </Row>
            {selectedDates.length > 0 && <div style={{ fontSize: 12, color: '#FF4D28', marginTop: 8 }}>已选 {selectedDates.length} 天</div>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <span>选择时段（可多选）：</span>
              <Button size="small" type="link" onClick={() => setSelectedHours(HOUR_RANGE)}>全选</Button>
              <Button size="small" type="link" onClick={() => setSelectedHours([])}>清空</Button>
            </Space>
            <Row gutter={[8, 8]}>
              {HOUR_RANGE.map((h) => {
                const isSelected = selectedHours.includes(h);
                return (
                  <Col key={h} span={3}>
                    <div onClick={() => toggleBatchHour(h)}
                      style={{
                        border: `2px solid ${isSelected ? '#52c41a' : '#d9d9d9'}`, background: isSelected ? '#f6ffed' : '#fff',
                        borderRadius: 8, padding: '8px 4px', textAlign: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        color: isSelected ? '#52c41a' : '#999',
                      }}>
                      {String(h).padStart(2,'0')}:00
                    </div>
                  </Col>
                );
              })}
            </Row>
            {selectedHours.length > 0 && <div style={{ fontSize: 12, color: '#52c41a', marginTop: 8 }}>已选 {selectedHours.length} 个时段</div>}
          </div>

          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => submitBatch('AVAILABLE')}>
              保存排班（{selectedDates.length}天 × {selectedHours.length}时段）
            </Button>
            <Button loading={saving} onClick={() => submitBatch('REST')}>批量休息</Button>
          </Space>
        </Card>
      )}
    </div>
  );
}
