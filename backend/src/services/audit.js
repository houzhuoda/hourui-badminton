// 审计日志服务
import { getDb } from '../db/index.js';
import { uuid, now } from '../utils/helpers.js';

export function writeAudit({ entity, entityId, action, operator, detail }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_logs (id, entity, entity_id, action, operator_id, operator_type, operator_name, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid(),
    entity,
    entityId || null,
    action,
    operator?.id || null,
    operator?.type || null,
    operator?.name || null,
    detail ? JSON.stringify(detail) : null,
    now()
  );
}

// 从 req.user 构造 operator
export function operatorFromReq(req) {
  if (!req.user) return null;
  return {
    id: req.user.id,
    type: req.user.role,
    name: req.user.name,
  };
}
