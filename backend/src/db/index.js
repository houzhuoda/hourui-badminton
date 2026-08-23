// 数据库连接与初始化
import Database from 'better-sqlite3';
import { config } from '../utils/config.js';
import { SCHEMA_SQL } from './schema.js';
import fs from 'fs';
import path from 'path';

let dbInstance = null;

// 初始化数据库（可指定路径，用于测试隔离）
// 设置为单例（供 getDb 使用）
export function initDb(dbPath) {
  const targetPath = dbPath || config.dbPath;
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = new Database(targetPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.exec(SCHEMA_SQL);
  // 迁移：为 course_session_pricing 添加额外赠送字段
  try {
    dbInstance.prepare('SELECT extra_gift_business_type FROM course_session_pricing LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE course_session_pricing ADD COLUMN extra_gift_business_type TEXT');
    dbInstance.exec('ALTER TABLE course_session_pricing ADD COLUMN extra_gift_sessions INTEGER DEFAULT 0');
  }
  // 迁移：为 course_monthly_pricing 添加额外赠送字段
  try {
    dbInstance.prepare('SELECT extra_gift_business_type FROM course_monthly_pricing LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE course_monthly_pricing ADD COLUMN extra_gift_business_type TEXT');
    dbInstance.exec('ALTER TABLE course_monthly_pricing ADD COLUMN extra_gift_sessions INTEGER DEFAULT 0');
  }
  // 迁移：为 coach_rates 添加赠送课程是否提成字段
  try {
    dbInstance.prepare('SELECT gift_commission FROM coach_rates LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE coach_rates ADD COLUMN gift_commission INTEGER DEFAULT 0');
  }
  // 迁移：为 commission_records 添加 session_id 字段
  try {
    dbInstance.prepare('SELECT session_id FROM commission_records LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE commission_records ADD COLUMN session_id TEXT');
  }
  // 迁移：为 members 添加渠道字段
  try {
    dbInstance.prepare('SELECT channel_id FROM members LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE members ADD COLUMN channel_id TEXT');
    dbInstance.exec('ALTER TABLE members ADD COLUMN sub_channel_id TEXT');
  }
  // 迁移：为 members 添加密码字段（会员自助注册时使用）
  try {
    dbInstance.prepare('SELECT password_hash FROM members LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE members ADD COLUMN password_hash TEXT');
  }
  // 迁移：创建教练特定日期排班表（如果不存在）
  try {
    dbInstance.prepare('SELECT id FROM coach_date_slots LIMIT 1').get();
  } catch {
    dbInstance.exec(`CREATE TABLE IF NOT EXISTS coach_date_slots (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      business_types TEXT DEFAULT 'PRIVATE,PRACTICE',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(coach_id, date, start_hour),
      FOREIGN KEY (coach_id) REFERENCES coaches(id)
    )`);
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_coach_date_slots_coach ON coach_date_slots(coach_id, date)');
  }
  // 迁移：为 member_end_config 添加客服微信字段
  try {
    dbInstance.prepare('SELECT service_wechat FROM member_end_config LIMIT 1').get();
  } catch {
    dbInstance.exec('ALTER TABLE member_end_config ADD COLUMN service_wechat TEXT DEFAULT ""');
    dbInstance.exec('ALTER TABLE member_end_config ADD COLUMN service_wechat_qr TEXT DEFAULT ""');
  }
  // 迁移：bookings 表去除旧的 UNIQUE(session_id, member_id) 约束，改为部分唯一索引
  // SQLite 无法直接删除表级 UNIQUE 约束，通过重建表实现
  try {
    // 检查是否有旧的表级 UNIQUE 约束（通过尝试插入取消记录后重新预约来检测）
    const hasOldConstraint = dbInstance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").get();
    if (hasOldConstraint && hasOldConstraint.sql && hasOldConstraint.sql.includes('UNIQUE(session_id, member_id)')) {
      // 重建 bookings 表
      dbInstance.exec(`CREATE TABLE IF NOT EXISTS bookings_new (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        status TEXT DEFAULT 'BOOKED',
        cancelled_at TEXT,
        cancel_reason TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      )`);
      dbInstance.exec('INSERT OR IGNORE INTO bookings_new SELECT * FROM bookings');
      dbInstance.exec('DROP TABLE bookings');
      dbInstance.exec('ALTER TABLE bookings_new RENAME TO bookings');
    }
  } catch (e) {
    console.error('[db] bookings 迁移失败:', e.message);
  }
  // 创建部分唯一索引（允许取消后重新预约）
  dbInstance.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_unique ON bookings(session_id, member_id) WHERE status IN ('BOOKED', 'ATTENDED')");

  // 迁移：private_bookings 表去除旧的 UNIQUE(coach_id, date, start_time) 约束
  try {
    const hasOldPrivateConstraint = dbInstance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='private_bookings'").get();
    if (hasOldPrivateConstraint && hasOldPrivateConstraint.sql && hasOldPrivateConstraint.sql.includes('UNIQUE(coach_id, date, start_time)')) {
      dbInstance.exec(`CREATE TABLE IF NOT EXISTS private_bookings_new (
        id TEXT PRIMARY KEY,
        coach_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        business_type TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT DEFAULT 'BOOKED',
        cancelled_at TEXT,
        cancel_reason TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (coach_id) REFERENCES coaches(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      )`);
      dbInstance.exec('INSERT OR IGNORE INTO private_bookings_new SELECT * FROM private_bookings');
      dbInstance.exec('DROP TABLE private_bookings');
      dbInstance.exec('ALTER TABLE private_bookings_new RENAME TO private_bookings');
    }
  } catch (e) {
    console.error('[db] private_bookings 迁移失败:', e.message);
  }
  dbInstance.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_private_bookings_active_unique ON private_bookings(coach_id, date, start_time) WHERE status IN ('BOOKED', 'COMPLETED')");

  // 迁移：pack_consumptions 表去除 pack_id NOT NULL 约束（预存核销时 pack_id 为空）
  try {
    const pcSchema = dbInstance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pack_consumptions'").get();
    if (pcSchema && pcSchema.sql && pcSchema.sql.includes('pack_id TEXT NOT NULL')) {
      dbInstance.exec(`CREATE TABLE IF NOT EXISTS pack_consumptions_new (
        id TEXT PRIMARY KEY,
        pack_id TEXT,
        member_id TEXT NOT NULL,
        session_id TEXT,
        order_id TEXT,
        sessions_used INTEGER DEFAULT 1,
        amount INTEGER DEFAULT 0,
        principal_part INTEGER DEFAULT 0,
        gift_part INTEGER DEFAULT 0,
        charge_mode TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (pack_id) REFERENCES packs(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      )`);
      dbInstance.exec('INSERT OR IGNORE INTO pack_consumptions_new SELECT * FROM pack_consumptions');
      dbInstance.exec('DROP TABLE pack_consumptions');
      dbInstance.exec('ALTER TABLE pack_consumptions_new RENAME TO pack_consumptions');
    }
  } catch (e) {
    console.error('[db] pack_consumptions 迁移失败:', e.message);
  }
  // 迁移：创建提成发放记录表
  try {
    dbInstance.prepare('SELECT id FROM commission_payouts LIMIT 1').get();
  } catch {
    dbInstance.exec(`CREATE TABLE IF NOT EXISTS commission_payouts (
      id TEXT PRIMARY KEY,
      beneficiary_id TEXT NOT NULL,
      beneficiary_type TEXT NOT NULL,
      beneficiary_name TEXT,
      amount INTEGER NOT NULL,
      period_start TEXT,
      period_end TEXT,
      note TEXT,
      operator_id TEXT,
      operator_name TEXT,
      status TEXT DEFAULT 'PAID',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_payouts_beneficiary ON commission_payouts(beneficiary_id, beneficiary_type)');
  }

  // 迁移：清理 attendance 表中的 ATTENDED 脏状态（应为 PRESENT）
  try {
    const dirtyCount = dbInstance.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE status = 'ATTENDED'").get().cnt;
    if (dirtyCount > 0) {
      dbInstance.exec("UPDATE attendance SET status = 'PRESENT' WHERE status = 'ATTENDED'");
      console.log(`[db] 已修复 ${dirtyCount} 条 ATTENDED 状态的出勤记录为 PRESENT`);
    }
  } catch (e) {
    console.error('[db] 清理 ATTENDED 状态失败:', e.message);
  }

  return dbInstance;
}

// 获取单例数据库连接
export function getDb() {
  if (!dbInstance) {
    dbInstance = initDb();
  }
  return dbInstance;
}

// 重置单例（测试用）
export function resetDbInstance() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// 关闭数据库
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
