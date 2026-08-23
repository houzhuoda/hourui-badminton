// 课程与定价管理
import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tabs, Tag, Space, Popconfirm, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api';
import { useMessage } from '../utils/useMessage';
import { BUSINESS_TYPES, AUDIENCE_TYPES, businessTypeName } from '../utils/constants';

export default function Courses() {
  const message = useMessage();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [form] = Form.useForm();
  const [spModal, setSpModal] = useState(false);
  const [spForm] = Form.useForm();
  const [spEditing, setSpEditing] = useState(null);
  const [mpModal, setMpModal] = useState(false);
  const [mpForm] = Form.useForm();
  const [mpEditing, setMpEditing] = useState(null);

  const loadCourses = async () => {
    setLoading(true);
    try { setCourses(await api.get('/courses')); } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editCourse) {
        await api.put(`/courses/${editCourse.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/courses', values);
        message.success('新增成功');
      }
      setModal(false); form.resetFields(); setEditCourse(null); loadCourses();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveSp = async (courseId) => {
    try {
      const values = await spForm.validateFields();
      if (spEditing) {
        await api.put(`/courses/${courseId}/session-pricing/${spEditing.id}`, values);
        message.success('定价已修改');
      } else {
        await api.post(`/courses/${courseId}/session-pricing`, values);
        message.success('定价已添加');
      }
      spForm.resetFields(); setSpEditing(null); loadCourses();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  const handleSaveMp = async (courseId) => {
    try {
      const values = await mpForm.validateFields();
      if (mpEditing) {
        await api.put(`/courses/${courseId}/monthly-pricing/${mpEditing.id}`, values);
        message.success('月卡定价已修改');
      } else {
        await api.post(`/courses/${courseId}/monthly-pricing`, values);
        message.success('月卡定价已添加');
      }
      mpForm.resetFields(); setMpEditing(null); loadCourses();
    } catch (e) { if (e.message) message.error(e.message); }
  };

  return (
    <div className="page-container">
      <h2>课程与定价管理</h2>
      <Tabs items={[
        { key: 'courses', label: '课程列表', children: (
          <>
            <Button type="primary" icon={<PlusOutlined />} className="mb-16" onClick={() => { form.resetFields(); setEditCourse(null); setModal(true); }}>新增课程</Button>
            <Table loading={loading} dataSource={courses} rowKey="id" size="small" columns={[
              { title: '课程名称', dataIndex: 'name', key: 'name' },
              { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => <Tag color="blue">{businessTypeName(v)}</Tag> },
              { title: '适用对象', dataIndex: 'audience', key: 'audience' },
              { title: '时长(分)', dataIndex: 'duration_min', key: 'duration_min' },
              { title: '标准单价', dataIndex: 'standard_price', key: 'standard_price', render: (v) => `￥${v}` },
              { title: '状态', dataIndex: 'status', key: 'status', render: (v) => v === 'ACTIVE' ? <Tag color="green">启用</Tag> : <Tag color="red">已停用</Tag> },
              { title: '次卡档位', key: 'sp', render: (_, r) => <Button size="small" type="link" onClick={() => { spForm.resetFields(); setSpEditing(null); setSpModal(r.id); }}>{r.sessionPricing?.length || 0}档</Button> },
              { title: '月卡档位', key: 'mp', render: (_, r) => <Button size="small" type="link" onClick={() => { mpForm.resetFields(); setMpEditing(null); setMpModal(r.id); }}>{r.monthlyPricing?.length || 0}档</Button> },
              { title: '操作', key: 'action', width: 340, render: (_, r) => (
                <Space>
                  <Button size="small" type="link" onClick={() => {
                    form.setFieldsValue({
                      name: r.name,
                      businessType: r.business_type,
                      audience: r.audience,
                      durationMin: r.duration_min,
                      standardPrice: r.standard_price,
                    });
                    setEditCourse(r);
                    setModal(true);
                  }}>编辑</Button>
                  {r.status === 'ACTIVE' ? (
                    <>
                      <Popconfirm
                        title="确认停课？"
                        description="停课后会员端不再显示该课程，已有课包和排课保留，可随时恢复"
                        onConfirm={async () => {
                          try {
                            await api.put(`/courses/${r.id}/suspend`);
                            message.success('已停课，会员端不再显示');
                            loadCourses();
                          } catch (e) { message.error(e.message); }
                        }}
                        okText="确认停课"
                        cancelText="取消"
                      >
                        <Button size="small" type="link" danger>停课</Button>
                      </Popconfirm>
                      <Popconfirm
                        title="确认删除该课程？"
                        description="删除后会员端将不再显示此课程，历史数据保留，可随时恢复"
                        onConfirm={async () => {
                          try {
                            await api.delete(`/courses/${r.id}`);
                            message.success('已删除，会员端将不再显示');
                            loadCourses();
                          } catch (e) { message.error(e.message); }
                        }}
                        okText="确认删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" type="link" danger>删除</Button>
                      </Popconfirm>
                    </>
                  ) : (
                    <Popconfirm
                      title="确认恢复该课程？"
                      description="恢复后会员端将重新显示此课程"
                      onConfirm={async () => {
                        try {
                          await api.put(`/courses/${r.id}/restore`);
                          message.success('已恢复');
                          loadCourses();
                        } catch (e) { message.error(e.message); }
                      }}
                      okText="确认恢复"
                      cancelText="取消"
                    >
                      <Button size="small" type="link">恢复</Button>
                    </Popconfirm>
                  )}
                </Space>
              )},
            ]} />
          </>
        )},
      ]} />

      <Modal title={editCourse ? '编辑课程' : '新增课程'} open={modal} onOk={handleSave} onCancel={() => setModal(false)} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="课程名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="businessType" label="业务类型" rules={[{ required: true }]}>
            <Select options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))} />
          </Form.Item>
          <Form.Item name="audience" label="适用对象"><Select options={AUDIENCE_TYPES.map((a) => ({ label: a.name, value: a.code }))} /></Form.Item>
          <Form.Item name="durationMin" label="单节时长(分钟)"><InputNumber min={30} max={180} /></Form.Item>
          <Form.Item name="standardPrice" label="标准单价(元)"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={spModal ? `次卡定价管理 - ${courses.find((c) => c.id === spModal)?.name || ''}` : ''}
        open={!!spModal}
        onCancel={() => { setSpModal(false); spForm.resetFields(); setSpEditing(null); }}
        footer={null}
        width={620}
      >
        {spModal && (() => {
          const course = courses.find((c) => c.id === spModal);
          const list = course?.sessionPricing || [];
          return (
            <>
              <Table
                dataSource={list}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '节数', dataIndex: 'sessions', key: 'sessions' },
                  { title: '价格(元)', dataIndex: 'price', key: 'price' },
                  { title: '赠送节数', dataIndex: 'gift_sessions', key: 'gift_sessions' },
                  { title: '额外赠送', key: 'extra_gift', render: (_, r) => {
                    if (!r.extra_gift_business_type || !r.extra_gift_sessions) return '-';
                    const bt = BUSINESS_TYPES.find((b) => b.code === r.extra_gift_business_type);
                    return <Tag color="purple">{bt?.name || r.extra_gift_business_type} ×{r.extra_gift_sessions}</Tag>;
                  } },
                  { title: '操作', key: 'action', render: (_, r) => (
                    <Space>
                      <Button size="small" type="link" onClick={() => {
                        setSpEditing(r);
                        spForm.setFieldsValue({
                          sessions: r.sessions,
                          price: r.price,
                          giftSessions: r.gift_sessions,
                          extraGiftBusinessType: r.extra_gift_business_type || undefined,
                          extraGiftSessions: r.extra_gift_sessions || 0,
                        });
                      }}>编辑</Button>
                      <Popconfirm title="确认删除该档位？" onConfirm={async () => {
                        await api.delete(`/courses/${spModal}/session-pricing/${r.id}`);
                        message.success('已删除'); loadCourses();
                      }}>
                        <Button size="small" type="link" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )},
                ]}
              />
              <Divider style={{ margin: '12px 0' }} />
              <h4>{spEditing ? '编辑档位' : '新增档位'}</h4>
              <Form form={spForm} layout="vertical">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="sessions" label="节数" rules={[{ required: true }]} style={{ width: '30%', marginRight: 8 }}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="price" label="价格(元)" rules={[{ required: true }]} style={{ width: '35%', marginRight: 8 }}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="giftSessions" label="赠送节数" style={{ width: '35%' }}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Space.Compact>
                <div style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>额外赠送（可选，跨业务类型赠送课时）</div>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="extraGiftBusinessType" label="赠送业务类型" style={{ width: '55%', marginRight: 8 }}>
                      <Select
                        allowClear
                        placeholder="不赠送其他业务"
                        options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))}
                      />
                    </Form.Item>
                    <Form.Item name="extraGiftSessions" label="赠送节数" style={{ width: '45%' }}>
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                    </Form.Item>
                  </Space.Compact>
                </div>
                <Space>
                  <Button type="primary" onClick={() => handleSaveSp(spModal)}>{spEditing ? '保存修改' : '添加档位'}</Button>
                  {spEditing && <Button onClick={() => { spForm.resetFields(); setSpEditing(null); }}>取消编辑</Button>}
                </Space>
              </Form>
            </>
          );
        })()}
      </Modal>

      <Modal
        title={mpModal ? `月卡定价管理 - ${courses.find((c) => c.id === mpModal)?.name || ''}` : ''}
        open={!!mpModal}
        onCancel={() => { setMpModal(false); mpForm.resetFields(); setMpEditing(null); }}
        footer={null}
        width={620}
      >
        {mpModal && (() => {
          const course = courses.find((c) => c.id === mpModal);
          const list = course?.monthlyPricing || [];
          return (
            <>
              <Table
                dataSource={list}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '月费(元)', dataIndex: 'monthly_fee', key: 'monthly_fee' },
                  { title: '周频次', dataIndex: 'weekly_frequency', key: 'weekly_frequency' },
                  { title: '月额度', dataIndex: 'monthly_quota', key: 'monthly_quota' },
                  { title: '额外赠送', key: 'extra_gift', render: (_, r) => {
                    if (!r.extra_gift_business_type || !r.extra_gift_sessions) return '-';
                    const bt = BUSINESS_TYPES.find((b) => b.code === r.extra_gift_business_type);
                    return <Tag color="purple">{bt?.name || r.extra_gift_business_type} ×{r.extra_gift_sessions}</Tag>;
                  } },
                  { title: '操作', key: 'action', render: (_, r) => (
                    <Space>
                      <Button size="small" type="link" onClick={() => {
                        setMpEditing(r);
                        mpForm.setFieldsValue({
                          monthlyFee: r.monthly_fee,
                          weeklyFrequency: r.weekly_frequency,
                          monthlyQuota: r.monthly_quota,
                          extraGiftBusinessType: r.extra_gift_business_type || undefined,
                          extraGiftSessions: r.extra_gift_sessions || 0,
                        });
                      }}>编辑</Button>
                      <Popconfirm title="确认删除该档位？" onConfirm={async () => {
                        await api.delete(`/courses/${mpModal}/monthly-pricing/${r.id}`);
                        message.success('已删除'); loadCourses();
                      }}>
                        <Button size="small" type="link" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )},
                ]}
              />
              <Divider style={{ margin: '12px 0' }} />
              <h4>{mpEditing ? '编辑档位' : '新增档位'}</h4>
              <Form form={mpForm} layout="vertical">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="monthlyFee" label="月费(元)" rules={[{ required: true }]} style={{ width: '34%', marginRight: 8 }}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="weeklyFrequency" label="周频次" rules={[{ required: true }]} style={{ width: '33%', marginRight: 8 }}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="monthlyQuota" label="月额度次数" rules={[{ required: true }]} style={{ width: '33%' }}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Space.Compact>
                <div style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>额外赠送（可选，跨业务类型赠送课时）</div>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="extraGiftBusinessType" label="赠送业务类型" style={{ width: '55%', marginRight: 8 }}>
                      <Select
                        allowClear
                        placeholder="不赠送其他业务"
                        options={BUSINESS_TYPES.map((b) => ({ label: b.name, value: b.code }))}
                      />
                    </Form.Item>
                    <Form.Item name="extraGiftSessions" label="赠送节数" style={{ width: '45%' }}>
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                    </Form.Item>
                  </Space.Compact>
                </div>
                <Space>
                  <Button type="primary" onClick={() => handleSaveMp(mpModal)}>{mpEditing ? '保存修改' : '添加档位'}</Button>
                  {mpEditing && <Button onClick={() => { mpForm.resetFields(); setMpEditing(null); }}>取消编辑</Button>}
                </Space>
              </Form>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
