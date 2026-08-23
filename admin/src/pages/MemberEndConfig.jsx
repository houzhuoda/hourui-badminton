// 会员端配置
import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Select, Switch, Button, Descriptions, Tag, Input, Upload, Image } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
export default function MemberEndConfig() {
  const message = useMessage();
  const [config, setConfig] = useState(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [qrImage, setQrImage] = useState('');

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
        service_wechat: d.service_wechat || '',
        service_phone: d.service_phone || '',
      });
      setQrImage(d.service_wechat_qr || '');
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) { message.error('只能上传图片文件'); return false; }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) { message.error('图片大小不能超过 2MB'); return false; }
    const reader = new FileReader();
    reader.onload = (e) => { setQrImage(e.target.result); };
    reader.readAsDataURL(file);
    return false; // 阻止自动上传
  };

  const handleRemoveQr = () => { setQrImage(''); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        booking_open_default: values.booking_open_default ? 1 : 0,
        booking_cancel_hours: values.booking_cancel_hours,
        noshow_action: values.noshow_action,
        expiry_remind_days: values.expiry_remind_days,
        service_wechat: values.service_wechat || '',
        service_wechat_qr: qrImage || '',
        service_phone: values.service_phone || '',
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
            <Descriptions.Item label="客服微信">{config.service_wechat || '-'}</Descriptions.Item>
            <Descriptions.Item label="客服电话">{config.service_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="客服二维码">
              {config.service_wechat_qr ? <Image width={120} src={config.service_wechat_qr} /> : '-'}
            </Descriptions.Item>
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
          <Form.Item name="service_wechat" label="客服微信号" extra="会员约课无权益时引导添加此微信开卡">
            <Input placeholder="如：hourui_kefu 或 kefu123" />
          </Form.Item>
          <Form.Item name="service_phone" label="客服电话" extra="会员端客服按钮显示的联系电话">
            <Input placeholder="如：010-12345678 或 13800001234" />
          </Form.Item>
          <Form.Item label="客服微信二维码" extra="上传二维码图片，会员约课无权益时弹窗显示">
            {qrImage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Image width={120} src={qrImage} />
                <Button danger icon={<DeleteOutlined />} onClick={handleRemoveQr}>删除</Button>
              </div>
            ) : (
              <Upload
                listType="picture-card"
                showUploadList={false}
                beforeUpload={handleUpload}
                maxCount={1}
              >
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传二维码</div>
                </div>
              </Upload>
            )}
          </Form.Item>
          <Form.Item><Button type="primary" onClick={handleSave}>保存配置</Button></Form.Item>
        </Form>
      </Card>
    </div>
  );
}
