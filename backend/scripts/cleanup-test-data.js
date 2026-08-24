// 清理测试残留数据：AUTOTEST_ 会员及其关联数据
// 用法: node scripts/cleanup-test-data.js
import { initDb, closeDb } from '../src/db/index.js';

const db = initDb();

console.log('[cleanup] 开始清理测试残留数据...');

// 统计待清理数据
const testMembers = db.prepare("SELECT id, name FROM members WHERE name LIKE 'AUTOTEST_%'").all();
console.log(`[cleanup] 找到 ${testMembers.length} 个 AUTOTEST_ 会员`);

if (testMembers.length === 0) {
  console.log('[cleanup] 无需清理');
  closeDb();
  process.exit(0);
}

const memberIds = testMembers.map((m) => m.id);
const placeholders = memberIds.map(() => '?').join(',');

// 按依赖顺序清理
const steps = [
  { name: 'pack_consumptions', sql: `DELETE FROM pack_consumptions WHERE member_id IN (${placeholders})` },
  { name: 'attendance', sql: `DELETE FROM attendance WHERE member_id IN (${placeholders})` },
  { name: 'bookings', sql: `DELETE FROM bookings WHERE member_id IN (${placeholders})` },
  { name: 'private_bookings', sql: `DELETE FROM private_bookings WHERE member_id IN (${placeholders})` },
  { name: 'member_tags', sql: `DELETE FROM member_tags WHERE member_id IN (${placeholders})` },
  { name: 'member_tag_history', sql: `DELETE FROM member_tag_history WHERE member_id IN (${placeholders})` },
  { name: 'commission_records', sql: `DELETE FROM commission_records WHERE order_id IN (SELECT id FROM orders WHERE member_id IN (${placeholders}))` },
  { name: 'packs', sql: `DELETE FROM packs WHERE member_id IN (${placeholders})` },
  { name: 'orders', sql: `DELETE FROM orders WHERE member_id IN (${placeholders})` },
  { name: 'members', sql: `DELETE FROM members WHERE id IN (${placeholders})` },
];

const result = db.transaction(() => {
  for (const step of steps) {
    const r = db.prepare(step.sql).run(...memberIds);
    console.log(`[cleanup] ${step.name}: 删除 ${r.changes} 条`);
  }
})();

console.log('[cleanup] 清理完成');
closeDb();
