export const BUSINESS_TYPES = [
  { code: 'PRIVATE', name: '私教课' }, { code: 'PRACTICE', name: '陪练课' },
  { code: 'ADULT_GROUP', name: '成人大课' }, { code: 'KID_GROUP', name: '儿童大课' },
  { code: 'GYM', name: '健身' }, { code: 'FITNESS', name: '体能课' }, { code: 'COMMUNITY', name: '群活动' },
];
export const CHARGE_MODES = [
  { code: 'SESSION_PACK', name: '次卡' }, { code: 'MONTHLY', name: '月卡' },
  { code: 'PREPAID', name: '预存' },
];
export const ATTENDANCE_STATUS = {
  PRESENT: '出勤', ABSENT: '缺勤', LEAVE: '请假', PENDING_PAY: '待补费',
};
export const BOOKING_STATUS = {
  BOOKED: '已预约', CANCELLED: '已取消', NOSHOW: '爽约', ATTENDED: '已出勤',
};
export const PACK_STATUS = { ACTIVE: '有效', EXPIRED: '已到期', CONSUMED: '已用完' };
export function businessTypeName(c) { return BUSINESS_TYPES.find((b) => b.code === c)?.name || c; }
