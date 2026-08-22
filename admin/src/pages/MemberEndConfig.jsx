// 会员端配置
import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Select, Switch, Button, Descriptions, Tag } from 'antd';
import api from '../api';
import { useMessage } from '../utils/useMessage';
export default function MemberEndConfig() {
  const message = useMessage();
  const [config, setConfig] = useState(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get('/member-end/config');
      setConfig(d);
      form.setFieldsValue({
        booking_open_default: d.booking_open_default === 1,
        booking_cancel_hours: d.booking_cancel_hours,
        noshow_action: d.noshow_action,
        expiry_remind_days: d.expiry_remind_days,
      });
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        booking_open_default: values.booking_open_default ? 1 : 0,
        booking_cancel_hours: values.booking_cancel_hours,
        noshow_action: values.noshow_action,
        expiry_remind_days: values.expiry_remind_days,
      };
      await api.put('/member-end/config', payload);
      message.success('配置已保存'); loadData();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const noshowName = (v) => {
    const map = { RECORD_ONLY: '仅记录', DEDUCT_SESSION: '扣除课时', BLOCK_BOOKING: '限制约课' };
    return map[v] || v || '-';
  };

  return (
    <div className="page-container">
      <h2 className="mb-24">会员端配置</h2>
      <Card loading={loading} style={{ maxWidth: 600 }}>
        {config && (
          <Descriptions column={1} bordered size="small" className="mb-24" title="当前配置">
            <Descriptions.Item label="开放约课">
              <Tag color={config.booking_open_default === 1 ? 'green' : 'default'}>
                {config.booking_open_default === 1 ? '已开放' : '未开放'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="取消提前小时数">{config.booking_cancel_hours} 小时</Descriptions.Item>
            <Descriptions.Item label="爽约处理">{noshowName(config.noshow_action)}</Descriptions.Item>
            <Descriptions.Item label="到期提醒天数">{config.expiry_remind_days} 天</Descriptions.Item>
            <Descriptions.Item label="最后更新">{config.updated_at ? new Date(config.updated_at).toLocaleString() : '-'}</Descriptions.Item>
          </Descriptions>
        )}

        <Form form={form} layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item name="booking_open_default" label="开放约课" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="booking_cancel_hours" label="约课取消提前小时数" rules={[{ required: true }]}>
            <InputNumber min={0} max={168} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="noshow_action" label="爽约处理" rules={[{ required: true }]}>
            <Select options={[
              { label: '仅记录', value: 'RECORD_ONLY' },
              { label: '扣除课时', value: 'DEDUCT_SESSION' },
              { label: '限制约课', value: 'BLOCK_BOOKING' },
            ]} />
          </Form.Item>
          <Form.Item name="expiry_remind_days" label="课包到期提醒天数" rules={[{ required: true }]}>
            <InputNumber min={0} max={90} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item><Button type="primary" onClick={handleSave}>保存配置</Button></Form.Item>
        </Form>
      </Card>
    </div>
  );
}
