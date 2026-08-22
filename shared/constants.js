// 共享常量：业务类型、会员分类、收费模式、订单/课包/出勤状态等
// 后端、管理端、三端小程序共用

// ============ 业务类型 ============
export const BUSINESS_TYPES = [
  { code: 'PRIVATE', name: '私教课', memberCategory: 'M_PRIVATE' },
  { code: 'PRACTICE', name: '陪练课', memberCategory: 'M_PRACTICE' },
  { code: 'ADULT_GROUP', name: '成人大课', memberCategory: 'M_ADULT_GROUP' },
  { code: 'KID_GROUP', name: '儿童大课', memberCategory: 'M_KID_GROUP' },
  { code: 'GYM', name: '健身', memberCategory: 'M_GYM' },
  { code: 'FITNESS', name: '体能课', memberCategory: 'M_FITNESS' },
  { code: 'COMMUNITY', name: '群活动', memberCategory: 'M_COMMUNITY' },
];

export const BUSINESS_TYPE_CODES = BUSINESS_TYPES.map((b) => b.code);

// ============ 会员分类（多标签，与业务类型一一对应） ============
export const MEMBER_CATEGORIES = [
  { code: 'M_PRIVATE', name: '私教会员', businessType: 'PRIVATE' },
  { code: 'M_PRACTICE', name: '陪练会员', businessType: 'PRACTICE' },
  { code: 'M_ADULT_GROUP', name: '成人大课会员', businessType: 'ADULT_GROUP' },
  { code: 'M_KID_GROUP', name: '儿童大课会员', businessType: 'KID_GROUP' },
  { code: 'M_GYM', name: '健身会员', businessType: 'GYM' },
  { code: 'M_FITNESS', name: '体能课会员', businessType: 'FITNESS' },
  { code: 'M_COMMUNITY', name: '群活动会员', businessType: 'COMMUNITY' },
];

export const MEMBER_CATEGORY_CODES = MEMBER_CATEGORIES.map((c) => c.code);

// 业务类型 → 会员分类 映射
export const BUSINESS_TO_CATEGORY = BUSINESS_TYPES.reduce((m, b) => {
  m[b.code] = b.memberCategory;
  return m;
}, {});

// 会员分类 → 业务类型 映射
export const CATEGORY_TO_BUSINESS = MEMBER_CATEGORIES.reduce((m, c) => {
  m[c.code] = c.businessType;
  return m;
}, {});

// ============ 收费模式 ============
export const CHARGE_MODES = [
  { code: 'PREPAID', name: '预存赠送' },
  { code: 'SESSION_PACK', name: '按节数购买（次卡）' },
  { code: 'MONTHLY', name: '包月购买（月卡）' },
  // 群活动专用
  { code: 'SINGLE', name: '单次付费' },
];

// ============ 适用对象 ============
export const AUDIENCE_TYPES = [
  { code: 'ADULT', name: '成人' },
  { code: 'KID', name: '儿童' },
  { code: 'ANY', name: '不限' },
];

// ============ 性别 ============
export const GENDERS = [
  { code: 'M', name: '男' },
  { code: 'F', name: '女' },
  { code: 'U', name: '未知' },
];

// ============ 会员状态 ============
export const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',     // 正常
  DISABLED: 'DISABLED', // 停用
};

// ============ 订单状态 ============
export const ORDER_STATUS = {
  PAID: 'PAID',         // 已支付
  REFUNDED: 'REFUNDED', // 已退款
  PARTIAL_REFUND: 'PARTIAL_REFUND', // 部分退款
};

// ============ 课包状态 ============
export const PACK_STATUS = {
  ACTIVE: 'ACTIVE',     // 有效
  EXPIRED: 'EXPIRED',   // 已到期
  CONSUMED: 'CONSUMED', // 已用完
  REFUNDED: 'REFUNDED', // 已退款
};

// ============ 课次状态 ============
export const SESSION_STATUS = {
  SCHEDULED: 'SCHEDULED', // 已排课
  COMPLETED: 'COMPLETED', // 已完成（出勤已提交）
  CANCELLED: 'CANCELLED', // 已取消
};

// ============ 出勤状态 ============
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',     // 出勤
  ABSENT: 'ABSENT',       // 缺勤
  LEAVE: 'LEAVE',         // 请假
  PENDING_PAY: 'PENDING_PAY', // 待补费
};

// ============ 约课状态 ============
export const BOOKING_STATUS = {
  BOOKED: 'BOOKED',       // 已预约
  CANCELLED: 'CANCELLED', // 已取消
  NOSHOW: 'NOSHOW',       // 爽约
  ATTENDED: 'ATTENDED',   // 已出勤
};

// ============ 渠道类型 ============
export const CHANNEL_TYPES = [
  { code: 'OFFLINE', name: '线下' },
  { code: 'ONLINE', name: '线上' },
  { code: 'REFERRAL', name: '转介绍' },
  { code: 'OTHER', name: '其他' },
];

// ============ 角色 ============
export const ROLES = {
  ADMIN: 'admin',
  SALES: 'sales',
  COACH: 'coach',
  MEMBER: 'member',
};

// ============ 提成类型 ============
export const COMMISSION_TYPES = {
  NEW: 'NEW',       // 新客
  RENEW: 'RENEW',   // 续费
};

// ============ 默认配置 ============
export const DEFAULTS = {
  SESSION_PACK_VALIDITY_DAYS: 365, // 次卡有效期 1 年
  BOOKING_CANCEL_HOURS: 2,         // 约课可取消时限（小时）
  BOOKING_REMINDER_HOURS: 30 / 60, // 课前提醒（小时），30 分钟
  EXPIRY_REMIND_DAYS: 7,           // 到期前提醒天数
  LARGE_ORDER_THRESHOLD: 5000,     // 大额订单阈值
};

// ============ 审计动作 ============
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  DISABLE: 'DISABLE',
  ENABLE: 'ENABLE',
  TAG_ADD: 'TAG_ADD',
  TAG_REMOVE: 'TAG_REMOVE',
  REFUND: 'REFUND',
  ATTENDANCE_CHANGE: 'ATTENDANCE_CHANGE',
};

// 工具：根据业务类型 code 获取名称
export function businessTypeName(code) {
  const item = BUSINESS_TYPES.find((b) => b.code === code);
  return item ? item.name : code;
}

// 工具：根据会员分类 code 获取名称
export function memberCategoryName(code) {
  const item = MEMBER_CATEGORIES.find((c) => c.code === code);
  return item ? item.name : code;
}
