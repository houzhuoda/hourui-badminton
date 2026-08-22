// 数据库 Schema — 侯瑞羽毛球场馆管理系统
// SQLite (better-sqlite3)
// 所有表均带 created_at / updated_at；逻辑删除用 status 字段控制

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============ 场馆/场地（多门店预留） ============
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courts (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  business_type TEXT,  -- 适用业务类型，NULL 表示通用（健身场地独立）
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- ============ 用户（管理员/销售/教练） ============
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  status TEXT DEFAULT 'ACTIVE',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coaches (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  primary_business_type TEXT,       -- 主教业务类型
  hourly_rate INTEGER DEFAULT 0,    -- 课时费（每节固定，兼容字段，详细按 coach_rates）
  share_rate INTEGER DEFAULT 0,     -- 分成比例（百分比，详细按 coach_rates）
  sales_enabled INTEGER DEFAULT 0,  -- 销售能力开关 0/1
  status TEXT DEFAULT 'ACTIVE',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 教练课时费/分成（按业务类型维度配置，Q-06）
CREATE TABLE IF NOT EXISTS coach_rates (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  business_type TEXT NOT NULL,
  lesson_fee INTEGER DEFAULT 0,     -- 课时费（元/节）
  share_rate INTEGER DEFAULT 0,     -- 分成比例（百分比）
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(coach_id, business_type),
  FOREIGN KEY (coach_id) REFERENCES coaches(id)
);

-- ============ 会员 ============
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,              -- 加密存储（应用层加密）
  phone_hash TEXT UNIQUE NOT NULL,  -- 用于唯一校验与查询
  gender TEXT DEFAULT 'U',
  birth_date TEXT,
  status TEXT DEFAULT 'ACTIVE',     -- ACTIVE / DISABLED
  creator_id TEXT,                  -- 建档人 id
  creator_type TEXT,                -- sales / coach / admin
  creator_name TEXT,                -- 冗余建档人姓名
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 会员分类标签（多标签，Q-16）
CREATE TABLE IF NOT EXISTS member_tags (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  category_code TEXT NOT NULL,      -- M_PRIVATE 等
  source TEXT DEFAULT 'AUTO',       -- AUTO（系统自动累积）/ MANUAL（人工调整）
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(member_id, category_code),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 标签变更历史（留痕）
CREATE TABLE IF NOT EXISTS member_tag_history (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  category_code TEXT NOT NULL,
  action TEXT NOT NULL,             -- ADD / REMOVE
  source TEXT NOT NULL,             -- AUTO / MANUAL
  operator_id TEXT,
  operator_type TEXT,
  operator_name TEXT,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============ 渠道来源（二级，Q-14） ============
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,               -- OFFLINE / ONLINE / REFERRAL / OTHER
  parent_id TEXT,                   -- NULL 表示一级
  level INTEGER NOT NULL,           -- 1 / 2
  status TEXT DEFAULT 'ACTIVE',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES channels(id)
);

-- ============ 课程与定价 ============
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  audience TEXT DEFAULT 'ANY',      -- ADULT / KID / ANY
  duration_min INTEGER DEFAULT 60,  -- 单节时长（分钟）
  standard_price INTEGER NOT NULL,  -- 标准单价（元）
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 次卡定价档位（多档）
CREATE TABLE IF NOT EXISTS course_session_pricing (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  sessions INTEGER NOT NULL,        -- 购买节数
  price INTEGER NOT NULL,           -- 价格
  gift_sessions INTEGER DEFAULT 0,  -- 赠送节数
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- 月卡定价
CREATE TABLE IF NOT EXISTS course_monthly_pricing (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  monthly_fee INTEGER NOT NULL,     -- 月费
  weekly_frequency INTEGER NOT NULL,-- 周频次
  monthly_quota INTEGER NOT NULL,   -- 月额度次数
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- 预存赠送规则（多档，Q-05 配置项之一）
CREATE TABLE IF NOT EXISTS prepaid_rules (
  id TEXT PRIMARY KEY,
  deposit_amount INTEGER NOT NULL,  -- 预存金额
  gift_amount INTEGER NOT NULL,     -- 赠送金额
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 折扣规则
CREATE TABLE IF NOT EXISTS discount_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_type TEXT,               -- 适用业务类型，NULL 表示全部
  course_id TEXT,                   -- 适用课程，NULL 表示全部
  discount_type TEXT NOT NULL,      -- RATE（比例）/ FIXED（优惠价）
  discount_value INTEGER NOT NULL,  -- 比例（百分比）或优惠价
  target TEXT DEFAULT 'ALL',        -- NEW（新客）/ ALL / 指定群体
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ============ 课次（排课） ============
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  business_type TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  court_id TEXT,
  venue_id TEXT,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  start_time TEXT NOT NULL,         -- HH:mm
  end_time TEXT NOT NULL,           -- HH:mm
  capacity INTEGER DEFAULT 1,       -- 学员容量上限
  booked_count INTEGER DEFAULT 0,   -- 已约课人数
  status TEXT DEFAULT 'SCHEDULED',  -- SCHEDULED / COMPLETED / CANCELLED
  booking_open INTEGER DEFAULT 0,   -- 是否开放约课 0/1
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (coach_id) REFERENCES coaches(id),
  FOREIGN KEY (court_id) REFERENCES courts(id)
);

-- 课次学员（排课时绑定 + 约课加入）
CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  source TEXT DEFAULT 'ASSIGNED',   -- ASSIGNED（排课指定）/ BOOKED（约课）
  status TEXT DEFAULT 'ENROLLED',   -- ENROLLED / REMOVED
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, member_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============ 订单 ============
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  member_id TEXT NOT NULL,
  sales_id TEXT,                    -- 开单人（销售或教练）
  sales_type TEXT,                  -- sales / coach
  sales_name TEXT,
  business_type TEXT NOT NULL,
  course_id TEXT,
  charge_mode TEXT NOT NULL,        -- PREPAID / SESSION_PACK / MONTHLY / SINGLE
  amount INTEGER NOT NULL,          -- 实付金额
  original_amount INTEGER DEFAULT 0,-- 原价
  discount_amount INTEGER DEFAULT 0, -- 折扣优惠
  gift_value INTEGER DEFAULT 0,     -- 赠送价值（赠送金额或赠送节数对应价值）
  commission_type TEXT,             -- NEW / RENEW
  commission_rate INTEGER DEFAULT 0, -- 提成比例（百分比）
  commission_amount INTEGER DEFAULT 0, -- 提成金额
  status TEXT DEFAULT 'PAID',       -- PAID / REFUNDED / PARTIAL_REFUND
  refund_amount INTEGER DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============ 课包（次卡/月卡/群活动多次卡） ============
CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  course_id TEXT,
  business_type TEXT NOT NULL,
  pack_type TEXT NOT NULL,          -- SESSION_PACK / MONTHLY / COMMUNITY_PACK
  total_sessions INTEGER DEFAULT 0, -- 总节数（次卡）
  used_sessions INTEGER DEFAULT 0,  -- 已用节数
  remaining_sessions INTEGER DEFAULT 0, -- 剩余节数
  gift_sessions INTEGER DEFAULT 0,  -- 赠送节数
  unit_price INTEGER DEFAULT 0,     -- 单次原价（用于退费计算）
  monthly_quota INTEGER DEFAULT 0,  -- 月卡月额度
  monthly_used INTEGER DEFAULT 0,   -- 月卡当月已用
  monthly_remaining INTEGER DEFAULT 0, -- 月卡当月剩余
  monthly_period TEXT,              -- 月卡当前周期 YYYY-MM
  valid_from TEXT NOT NULL,         -- 生效日
  valid_until TEXT NOT NULL,        -- 到期日
  status TEXT DEFAULT 'ACTIVE',     -- ACTIVE / EXPIRED / CONSUMED / REFUNDED
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ============ 预存账户 ============
CREATE TABLE IF NOT EXISTS prepaid_accounts (
  id TEXT PRIMARY KEY,
  member_id TEXT UNIQUE NOT NULL,
  principal_balance INTEGER DEFAULT 0,  -- 本金余额
  gift_balance INTEGER DEFAULT 0,       -- 赠送余额
  total_balance INTEGER DEFAULT 0,      -- 可用余额（本金+赠送）
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 预存账户流水
CREATE TABLE IF NOT EXISTS prepaid_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  order_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,               -- DEPOSIT / CONSUME / REFUND
  principal_delta INTEGER DEFAULT 0, -- 本金变动（正为入账，负为扣减）
  gift_delta INTEGER DEFAULT 0,     -- 赠送变动
  amount INTEGER DEFAULT 0,         -- 总金额（用于展示）
  balance_after INTEGER DEFAULT 0,  -- 操作后总余额
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES prepaid_accounts(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============ 核销记录（课包扣减） ============
CREATE TABLE IF NOT EXISTS pack_consumptions (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  session_id TEXT,
  order_id TEXT,
  sessions_used INTEGER DEFAULT 1,  -- 本次扣减节数
  amount INTEGER DEFAULT 0,         -- 本次扣减金额（预存模式）
  principal_part INTEGER DEFAULT 0, -- 本金部分
  gift_part INTEGER DEFAULT 0,      -- 赠送部分
  charge_mode TEXT NOT NULL,        -- SESSION_PACK / PREPAID / MONTHLY
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (pack_id) REFERENCES packs(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============ 出勤记录 ============
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  status TEXT NOT NULL,             -- PRESENT / ABSENT / LEAVE / PENDING_PAY
  pack_id TEXT,                     -- 核销的课包（出勤时）
  consumption_id TEXT,              -- 关联核销记录
  lesson_fee INTEGER DEFAULT 0,     -- 课时费（教练）
  share_amount INTEGER DEFAULT 0,   -- 分成金额（教练）
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, member_id),    -- 幂等：同一课次同一学员唯一
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (coach_id) REFERENCES coaches(id)
);

-- 出勤修改日志
CREATE TABLE IF NOT EXISTS attendance_change_logs (
  id TEXT PRIMARY KEY,
  attendance_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  operator_id TEXT,
  operator_type TEXT,
  operator_name TEXT,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (attendance_id) REFERENCES attendance(id)
);

-- ============ 提成规则 ============
-- 销售提成：业务类型 × 新客/续费 矩阵（Q-05）
CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY,
  business_type TEXT NOT NULL,
  commission_type TEXT NOT NULL,    -- NEW / RENEW
  rate INTEGER NOT NULL,            -- 提成比例（百分比）
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(business_type, commission_type)
);

-- 提成记录（销售/教练开单提成）
CREATE TABLE IF NOT EXISTS commission_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  beneficiary_id TEXT NOT NULL,     -- 提成受益人 id
  beneficiary_type TEXT NOT NULL,   -- sales / coach
  beneficiary_name TEXT,
  commission_type TEXT,             -- NEW / RENEW
  business_type TEXT,
  rate INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',     -- ACTIVE / REVERSED（退款回滚）
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ============ 约课记录（会员端） ============
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT DEFAULT 'BOOKED',     -- BOOKED / CANCELLED / NOSHOW / ATTENDED
  cancelled_at TEXT,
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, member_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============ 审计日志 ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,             -- member / order / course / ...
  entity_id TEXT,
  action TEXT NOT NULL,             -- CREATE / UPDATE / DELETE / ...
  operator_id TEXT,
  operator_type TEXT,
  operator_name TEXT,
  detail TEXT,                      -- JSON 字符串，变更详情
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============ 会员端配置 ============
CREATE TABLE IF NOT EXISTS member_end_config (
  id TEXT PRIMARY KEY,
  booking_cancel_hours INTEGER DEFAULT 2,
  noshow_action TEXT DEFAULT 'RECORD_ONLY', -- RECORD_ONLY / DEDUCT
  booking_open_default INTEGER DEFAULT 0,
  expiry_remind_days INTEGER DEFAULT 7,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============ 索引 ============
CREATE INDEX IF NOT EXISTS idx_members_phone_hash ON members(phone_hash);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_member_tags_member ON member_tags(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_coach ON sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales ON orders(sales_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_packs_member ON packs(member_id);
CREATE INDEX IF NOT EXISTS idx_packs_status ON packs(status);
CREATE INDEX IF NOT EXISTS idx_packs_valid_until ON packs(valid_until);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_coach ON attendance(coach_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_channels_parent ON channels(parent_id);

-- ============ 教练可用时间模板（私教/陪练） ============
CREATE TABLE IF NOT EXISTS coach_availability_templates (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,          -- 1=周一 ... 7=周日
  start_hour INTEGER NOT NULL,           -- 开始小时 0-23
  end_hour INTEGER NOT NULL,             -- 结束小时 1-24
  business_types TEXT DEFAULT 'PRIVATE,PRACTICE', -- 适用业务类型
  status TEXT DEFAULT 'ACTIVE',          -- ACTIVE / INACTIVE
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (coach_id) REFERENCES coaches(id)
);

-- ============ 教练请假/不可用时段 ============
CREATE TABLE IF NOT EXISTS coach_time_off (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  date TEXT NOT NULL,                    -- 日期 YYYY-MM-DD
  start_time TEXT NOT NULL,              -- 开始时间 HH:mm
  end_time TEXT NOT NULL,                -- 结束时间 HH:mm
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (coach_id) REFERENCES coaches(id)
);

-- ============ 私教/陪练预约记录 ============
CREATE TABLE IF NOT EXISTS private_bookings (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  business_type TEXT NOT NULL,           -- PRIVATE / PRACTICE
  date TEXT NOT NULL,                    -- 日期 YYYY-MM-DD
  start_time TEXT NOT NULL,              -- 开始时间 HH:mm
  end_time TEXT NOT NULL,                -- 结束时间 HH:mm
  status TEXT DEFAULT 'BOOKED',          -- BOOKED / CANCELLED / COMPLETED
  cancelled_at TEXT,
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(coach_id, date, start_time),    -- 同一教练同一时段只能约1人
  FOREIGN KEY (coach_id) REFERENCES coaches(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_coach_avail_coach ON coach_availability_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_timeoff_coach ON coach_time_off(coach_id, date);
CREATE INDEX IF NOT EXISTS idx_private_bookings_coach ON private_bookings(coach_id, date);
CREATE INDEX IF NOT EXISTS idx_private_bookings_member ON private_bookings(member_id);
`;
