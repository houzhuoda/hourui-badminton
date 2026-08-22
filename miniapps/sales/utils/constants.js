// 共享常量
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

export const CHARGE_MODES = [
  { code: 'PREPAID', name: '预存赠送' },
  { code: 'SESSION_PACK', name: '次卡' },
  { code: 'MONTHLY', name: '月卡' },
  { code: 'SINGLE', name: '单次付费' },
];

export const GENDERS = [
  { code: 'M', name: '男' },
  { code: 'F', name: '女' },
  { code: 'U', name: '未知' },
];

export function businessTypeName(code) {
  return BUSINESS_TYPES.find((b) => b.code === code)?.name || code;
}
export function memberCategoryName(code) {
  return MEMBER_CATEGORIES.find((c) => c.code === code)?.name || code;
}
export function chargeModeName(code) {
  return CHARGE_MODES.find((m) => m.code === code)?.name || code;
}
