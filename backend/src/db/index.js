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
