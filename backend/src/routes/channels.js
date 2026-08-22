// 渠道来源路由（二级分类，Q-14）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, fail, uuid, now } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { CHANNEL_TYPES, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 渠道列表（树形）
router.get('/', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { status, level } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (level) { where.push('level = ?'); params.push(level); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const list = db.prepare(`SELECT * FROM channels ${whereSql} ORDER BY level, sort_order, created_at`).all(...params);

    // 构建树
    const tree = list.filter((c) => c.level === 1).map((p) => ({
      ...p,
      children: list.filter((c) => c.parent_id === p.id),
    }));

    // 附带统计（本月新增会员、本月开单金额、本月续费金额）
    if (req.user.role === 'admin') {
      for (const node of tree) {
        node.stats = getChannelStats(db, node.id, true);
        for (const child of node.children) {
          child.stats = getChannelStats(db, child.id, false);
        }
      }
    }

    res.json(success({ tree, flat: list }));
  } catch (e) { next(e); }
});

function getChannelStats(db, channelId, isParent) {
  // 通过审计日志 CHANNEL_ASSIGN 关联会员，再统计会员的开单
  const targetIds = isParent
    ? db.prepare(`SELECT DISTINCT entity_id FROM audit_logs WHERE entity='member' AND action='CHANNEL_ASSIGN' AND json_extract(detail, '$.channelId') = ?`).all(channelId).map((r) => r.entity_id)
    : db.prepare(`SELECT DISTINCT entity_id FROM audit_logs WHERE entity='member' AND action='CHANNEL_ASSIGN' AND json_extract(detail, '$.subChannelId') = ?`).all(channelId).map((r) => r.entity_id);
  if (targetIds.length === 0) return { newMembers: 0, orderAmount: 0, renewAmount: 0 };
  const placeholders = targetIds.map(() => '?').join(',');
  const monthStart = new Date().toISOString().slice(0, 8) + '01';
  const newMembers = db.prepare(`SELECT COUNT(*) as cnt FROM members WHERE id IN (${placeholders}) AND created_at >= ?`).get(...targetIds, monthStart).cnt;
  const orderAmount = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${placeholders}) AND status='PAID' AND created_at >= ?`).get(...targetIds, monthStart).total;
  const renewAmount = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${placeholders}) AND status='PAID' AND commission_type='RENEW' AND created_at >= ?`).get(...targetIds, monthStart).total;
  return { newMembers, orderAmount, renewAmount };
}

// 新增渠道
router.post('/', authRole(['admin']), (req, res, next) => {
  try {
    const { name, type, parentId } = req.body || {};
    if (!name || !type) throw new BizError('渠道名称和类型必填');
    if (!CHANNEL_TYPES.find((t) => t.code === type)) throw new BizError('无效渠道类型');
    const db = getDb();
    let level = 1;
    let parentType = type;
    if (parentId) {
      const parent = db.prepare('SELECT * FROM channels WHERE id = ?').get(parentId);
      if (!parent) throw new BizError('父渠道不存在');
      if (parent.level !== 1) throw new BizError('只支持两级渠道');
      level = 2;
      parentType = parent.type; // 二级继承一级类型
    }
    const id = uuid();
    db.prepare(`INSERT INTO channels (id, name, type, parent_id, level, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)`)
      .run(id, name, parentType, parentId || null, level, now(), now());
    writeAudit({ entity: 'channel', entityId: id, action: AUDIT_ACTIONS.CREATE, operator: operatorFromReq(req), detail: { name, type, parentId } });
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    res.status(201).json(success(ch));
  } catch (e) { next(e); }
});

// 编辑渠道（CHN-005：改名/改类型同步历史档案展示名称）
router.put('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const { name, type, status, sortOrder } = req.body || {};
    const db = getDb();
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
    if (!ch) throw new BizError('渠道不存在', 404);
    const updates = {};
    if (name) updates.name = name;
    if (type && ch.level === 1) updates.type = type; // 仅一级可改类型，二级继承
    if (status) updates.status = status;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (Object.keys(updates).length === 0) return res.json(success(ch));
    const sets = Object.keys(updates).map((k) => `${k === 'sortOrder' ? 'sort_order' : k} = ?`).join(', ');
    db.prepare(`UPDATE channels SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), ch.id);
    // 二级渠道若改类型，继承父级
    if (ch.level === 2 && type) {
      const parent = db.prepare('SELECT type FROM channels WHERE id = ?').get(ch.parent_id);
      if (parent) db.prepare('UPDATE channels SET type = ? WHERE id = ?').run(parent.type, ch.id);
    }
    writeAudit({ entity: 'channel', entityId: ch.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: updates });
    res.json(success(db.prepare('SELECT * FROM channels WHERE id = ?').get(ch.id)));
  } catch (e) { next(e); }
});

// 停用/启用
router.patch('/:id/status', authRole(['admin']), (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'DISABLED'].includes(status)) throw new BizError('无效状态');
    const db = getDb();
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
    if (!ch) throw new BizError('渠道不存在', 404);
    db.prepare('UPDATE channels SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), ch.id);
    // 停用一级时同步停用二级
    if (ch.level === 1 && status === 'DISABLED') {
      db.prepare('UPDATE channels SET status = ?, updated_at = ? WHERE parent_id = ?').run(status, now(), ch.id);
    }
    writeAudit({ entity: 'channel', entityId: ch.id, action: status === 'DISABLED' ? AUDIT_ACTIONS.DISABLE : AUDIT_ACTIONS.ENABLE, operator: operatorFromReq(req), detail: { status } });
    res.json(success(db.prepare('SELECT * FROM channels WHERE id = ?').get(ch.id)));
  } catch (e) { next(e); }
});

// 渠道获客统计（CHN-004）
router.get('/stats/summary', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    const start = startDate || new Date().toISOString().slice(0, 8) + '01';
    const end = endDate || new Date().toISOString().slice(0, 10);
    const channels = db.prepare(`SELECT * FROM channels WHERE level = 1 ORDER BY sort_order`).all();
    const result = channels.map((ch) => {
      const stats = getChannelStats(db, ch.id, true);
      // 二级下钻
      const subs = db.prepare('SELECT * FROM channels WHERE parent_id = ? AND level = 2 ORDER BY sort_order').all(ch.id);
      const subStats = subs.map((s) => ({ ...s, stats: getChannelStats(db, s.id, false) }));
      return { ...ch, stats, subChannels: subStats };
    });
    res.json(success({ channels: result, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

export default router;
