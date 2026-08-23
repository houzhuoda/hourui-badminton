// 种子数据：初始化默认管理员、渠道、会员端配置、提成规则默认值
import { initDb } from './index.js';
import { uuid, hashPassword, now } from '../utils/helpers.js';
import { config } from '../utils/config.js';
import { BUSINESS_TYPE_CODES, COMMISSION_TYPES } from '../../../shared/constants.js';

export function seed(db) {
  // 默认场馆
  const venueId = uuid();
  db.prepare(`INSERT OR IGNORE INTO venues (id, name, code, is_default, status) VALUES (?, ?, ?, 1, 'ACTIVE')`)
    .run(venueId, '侯瑞羽毛球馆', 'MAIN');

  // 默认场地（羽毛球 + 健身独立）
  const court1 = uuid();
  const court2 = uuid();
  const courtGym = uuid();
  db.prepare(`INSERT OR IGNORE INTO courts (id, venue_id, name, business_type, status) VALUES (?, ?, ?, NULL, 'ACTIVE')`).run(court1, venueId, '1号场');
  db.prepare(`INSERT OR IGNORE INTO courts (id, venue_id, name, business_type, status) VALUES (?, ?, ?, NULL, 'ACTIVE')`).run(court2, venueId, '2号场');
  db.prepare(`INSERT OR IGNORE INTO courts (id, venue_id, name, business_type, status) VALUES (?, ?, ?, 'GYM', 'ACTIVE')`).run(courtGym, venueId, '健身区');

  // 默认管理员
  const adminId = uuid();
  db.prepare(`INSERT OR IGNORE INTO admins (id, username, password_hash, name, role, status) VALUES (?, ?, ?, ?, 'admin', 'ACTIVE')`)
    .run(adminId, config.defaultAdmin.username, hashPassword(config.defaultAdmin.password), config.defaultAdmin.name);

  // 默认销售
  const salesId = uuid();
  db.prepare(`INSERT OR IGNORE INTO sales (id, phone, password_hash, name, status) VALUES (?, ?, ?, ?, 'ACTIVE')`)
    .run(salesId, '13800000001', hashPassword('123456'), '张销售');

  // 默认教练
  const coachId = uuid();
  db.prepare(`INSERT OR IGNORE INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status) VALUES (?, ?, ?, ?, 'PRIVATE', 1, 'ACTIVE')`)
    .run(coachId, '13800000002', hashPassword('123456'), '李教练');

  // 默认渠道（一级）
  const channels = [
    { name: '到店', type: 'OFFLINE' },
    { name: '老客转介绍', type: 'REFERRAL' },
    { name: '线上广告', type: 'ONLINE' },
    { name: '其他', type: 'OTHER' },
  ];
  const channelIds = {};
  for (const ch of channels) {
    const id = uuid();
    channelIds[ch.name] = id;
    db.prepare(`INSERT OR IGNORE INTO channels (id, name, type, level, status, sort_order) VALUES (?, ?, ?, 1, 'ACTIVE', 0)`)
      .run(id, ch.name, ch.type);
  }
  // 二级渠道示例（线上广告下）
  const subChannels = ['抖音', '朋友圈', '小红书'];
  for (const name of subChannels) {
    const id = uuid();
    db.prepare(`INSERT OR IGNORE INTO channels (id, name, type, parent_id, level, status, sort_order) VALUES (?, ?, 'ONLINE', ?, 2, 'ACTIVE', 0)`)
      .run(id, name, channelIds['线上广告']);
  }

  // 默认提成规则（业务类型 × 新客/续费，初始 10%）
  for (const bt of BUSINESS_TYPE_CODES) {
    for (const ct of [COMMISSION_TYPES.NEW, COMMISSION_TYPES.RENEW]) {
      db.prepare(`INSERT OR IGNORE INTO commission_rules (id, business_type, commission_type, rate, status) VALUES (?, ?, ?, 10, 'ACTIVE')`)
        .run(uuid(), bt, ct);
    }
  }

  // 默认教练费率
  for (const bt of BUSINESS_TYPE_CODES) {
    db.prepare(`INSERT OR IGNORE INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate) VALUES (?, ?, ?, 100, 0)`)
      .run(uuid(), coachId, bt);
  }

  // 默认课程（每种业务类型一个示例）
  const courses = [
    { name: '私教课', business_type: 'PRIVATE', audience: 'ANY', duration: 60, price: 300 },
    { name: '陪练课', business_type: 'PRACTICE', audience: 'ADULT', duration: 60, price: 200 },
    { name: '成人大课', business_type: 'ADULT_GROUP', audience: 'ADULT', duration: 90, price: 100 },
    { name: '儿童大课', business_type: 'KID_GROUP', audience: 'KID', duration: 90, price: 120 },
    { name: '健身指导', business_type: 'GYM', audience: 'ADULT', duration: 60, price: 150 },
    { name: '体能课', business_type: 'FITNESS', audience: 'ANY', duration: 60, price: 150 },
    { name: '群活动', business_type: 'COMMUNITY', audience: 'ANY', duration: 120, price: 50 },
  ];
  for (const c of courses) {
    const cid = uuid();
    db.prepare(`INSERT OR IGNORE INTO courses (id, name, business_type, audience, duration_min, standard_price, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`)
      .run(cid, c.name, c.business_type, c.audience, c.duration, c.price);
    // 次卡定价档位
    if (c.business_type !== 'COMMUNITY') {
      db.prepare(`INSERT OR IGNORE INTO course_session_pricing (id, course_id, sessions, price, gift_sessions, status, sort_order) VALUES (?, ?, 10, ?, 2, 'ACTIVE', 10)`)
        .run(uuid(), cid, Math.round(c.price * 10 * 0.9));
      db.prepare(`INSERT OR IGNORE INTO course_session_pricing (id, course_id, sessions, price, gift_sessions, status, sort_order) VALUES (?, ?, 20, ?, 4, 'ACTIVE', 20)`)
        .run(uuid(), cid, Math.round(c.price * 20 * 0.85));
    } else {
      // 群活动多次卡
      db.prepare(`INSERT OR IGNORE INTO course_session_pricing (id, course_id, sessions, price, gift_sessions, status, sort_order) VALUES (?, ?, 10, ?, 0, 'ACTIVE', 10)`)
        .run(uuid(), cid, c.price * 9); // 10 次卡 9 折
    }
    // 月卡定价（大课类）
    if (['ADULT_GROUP', 'KID_GROUP', 'FITNESS'].includes(c.business_type)) {
      db.prepare(`INSERT OR IGNORE INTO course_monthly_pricing (id, course_id, monthly_fee, weekly_frequency, monthly_quota, status, sort_order) VALUES (?, ?, 700, 2, 8, 'ACTIVE', 1)`)
        .run(uuid(), cid);
    }
  }

  // 会员端配置
  db.prepare(`INSERT OR IGNORE INTO member_end_config (id, booking_cancel_hours, noshow_action, booking_open_default, expiry_remind_days) VALUES (?, 2, 'RECORD_ONLY', 0, 7)`)
    .run(uuid());

  console.log('[seed] 默认数据已初始化');
  console.log(`[seed] 管理员: ${config.defaultAdmin.username} / ${config.defaultAdmin.password}`);
  console.log('[seed] 销售: 13800000001 / 123456');
  console.log('[seed] 教练: 13800000002 / 123456');
  console.log('[seed] 会员登录: 任意已建档手机号 + 验证码 1234');
}

// 直接运行时执行种子
if (process.env.NODE_ENV !== 'test') {
  const db = initDb();
  seed(db);
  db.close();
}

export { seed as default };
