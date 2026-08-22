// 共享常量（从 shared/constants.js 复制关键部分供前端使用）
export const BUSINESS_TYPES = [
  { code: 'PRIVATE', name: '私教课', memberCategory: 'M_PRIVATE' },
  { code: 'PRACTICE', name: '陪练课', memberCategory: 'M_PRACTICE' },
  { code: 'ADULT_GROUP', name: '成人大课', memberCategory: 'M_ADULT_GROUP' },
  { code: 'KID_GROUP', name: '儿童大课', memberCategory: 'M_KID_GROUP' },
  { code: 'GYM', name: '健身', memberCategory: 'M_GYM' },
  { code: 'FITNESS', name: '体能课', memberCategory: 'M_FITNESS' },
  { code: 'COMMUNITY', name: '群活动', memberCategory: 'M_COMMUNITY' },
];

export const MEMBER_CATEGORIES = [
  { code: 'M_PRIVATE', name: '私教会员' },
  { code: 'M_PRACTICE', name: '陪练会员' },
  { code: 'M_ADULT_GROUP', name: '成人大课会员' },
  { code: 'M_KID_GROUP', name: '儿童大课会员' },
  { code: 'M_GYM', name: '健身会员' },
  { code: 'M_FITNESS', name: '体能课会员' },
  { code: 'M_COMMUNITY', name: '群活动会员' },
];

export const BUSINESS_TO_CATEGORY = BUSINESS_TYPES.reduce((m, b) => { m[b.code] = b.memberCategory; return m; }, {});
export const CATEGORY_TO_BUSINESS = MEMBER_CATEGORIES.reduce((m, c) => { m[c.code] = BUSINESS_TYPES.find(b => b.memberCategory === c.code)?.code; return m; }, {});

export const CHARGE_MODES = [
  { code: 'PREPAID', name: '预存赠送' },
  { code: 'SESSION_PACK', name: '次卡' },
  { code: 'MONTHLY', name: '月卡' },
  { code: 'SINGLE', name: '单次付费' },
];

export const AUDIENCE_TYPES = [
  { code: 'ADULT', name: '成人' },
  { code: 'KID', name: '儿童' },
  { code: 'ANY', name: '不限' },
];

export const GENDERS = [
  { code: 'M', name: '男' },
  { code: 'F', name: '女' },
  { code: 'U', name: '未知' },
];

export const MEMBER_STATUS = { ACTIVE: '正常', DISABLED: '停用' };
export const ORDER_STATUS = { PAID: '已支付', REFUNDED: '已退款', PARTIAL_REFUND: '部分退款' };
export const PACK_STATUS = { ACTIVE: '有效', EXPIRED: '已到期', CONSUMED: '已用完', REFUNDED: '已退款' };
export const SESSION_STATUS = { SCHEDULED: '已排课', COMPLETED: '已完成', CANCELLED: '已取消' };
export const ATTENDANCE_STATUS = { PRESENT: '出勤', ABSENT: '缺勤', LEAVE: '请假', PENDING_PAY: '待补费' };
export const BOOKING_STATUS = { BOOKED: '已预约', CANCELLED: '已取消', NOSHOW: '爽约', ATTENDED: '已出勤' };
export const CHANNEL_TYPES = [
  { code: 'OFFLINE', name: '线下' },
  { code: 'ONLINE', name: '线上' },
  { code: 'REFERRAL', name: '转介绍' },
  { code: 'OTHER', name: '其他' },
];
export const COMMISSION_TYPES = { NEW: '新客', RENEW: '续费' };

export function businessTypeName(code) {
  return BUSINESS_TYPES.find((b) => b.code === code)?.name || code;
}
export function memberCategoryName(code) {
  return MEMBER_CATEGORIES.find((c) => c.code === code)?.name || code;
}
export function chargeModeName(code) {
  return CHARGE_MODES.find((m) => m.code === code)?.name || code;
}
