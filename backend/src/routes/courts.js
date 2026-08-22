// 场地管理路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 场馆列表
router.get('/venues', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const list = db.prepare('SELECT * FROM venues ORDER BY is_default DESC, name').all();
    res.json(success(list));
  } catch (e) { next(e); }
});

// 新增场馆
router.post('/venues', authRole(['admin']), (req, res, next) => {
  try {
    const { name, code, address, isDefault } = req.body || {};
    if (!name) throw new BizError('场馆名称必填');
    const db = getDb();
    const id = uuid();
    db.prepare('INSERT INTO venues (id, name, code, address, is_default, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, code || null, address || null, isDefault ? 1 : 0, 'ACTIVE', now(), now());
    writeAudit({ entity: 'venue', entityId: id, action: 'CREATE', operator: operatorFromReq(req), detail: { name, code, address } });
    res.status(201).json(success(db.prepare('SELECT * FROM venues WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

// 修改场馆
router.put('/venues/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const v = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
    if (!v) throw new BizError('场馆不存在', 404);
    const { name, code, address, isDefault, status } = req.body || {};
    const updates = {};
    if (name) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (address !== undefined) updates.address = address;
    if (isDefault !== undefined) updates.is_default = isDefault ? 1 : 0;
    if (status) updates.status = status;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = now();
      const sets = Object.keys(updates).map((k) => `${k === 'isDefault' ? 'is_default' : k} = ?`).join(', ');
      db.prepare(`UPDATE venues SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
      writeAudit({ entity: 'venue', entityId: req.params.id, action: 'UPDATE', operator: operatorFromReq(req), detail: updates });
    }
    res.json(success(db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id)));
  } catch (e) { next(e); }
});

// 删除场馆
router.delete('/venues/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const courts = db.prepare('SELECT COUNT(*) as cnt FROM courts WHERE venue_id = ?').get(req.params.id);
    if (courts.cnt > 0) throw new BizError('场馆下有场地，无法删除');
    db.prepare('DELETE FROM venues WHERE id = ?').run(req.params.id);
    writeAudit({ entity: 'venue', entityId: req.params.id, action: 'DELETE', operator: operatorFromReq(req), detail: {} });
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

// 场地列表
router.get('/courts', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const { venueId, businessType, status } = req.query;
    let where = '1=1';
    const params = [];
    if (venueId) { where += ' AND venue_id = ?'; params.push(venueId); }
    if (businessType) { where += ` AND (business_type = ? OR business_type IS NULL)`; params.push(businessType); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    const list = db.prepare(`
      SELECT ct.*, v.name as venue_name
      FROM courts ct
      LEFT JOIN venues v ON ct.venue_id = v.id
      WHERE ${where} ORDER BY v.name, ct.name
    `).all(...params);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 新增场地
router.post('/courts', authRole(['admin']), (req, res, next) => {
  try {
    const { venueId, name, businessType, status } = req.body || {};
    if (!venueId || !name) throw new BizError('场馆和场地名称必填');
    const db = getDb();
    const venue = db.prepare('SELECT id FROM venues WHERE id = ?').get(venueId);
    if (!venue) throw new BizError('场馆不存在', 404);
    const id = uuid();
    db.prepare('INSERT INTO courts (id, venue_id, name, business_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, venueId, name, businessType || null, status || 'ACTIVE', now(), now());
    writeAudit({ entity: 'court', entityId: id, action: 'CREATE', operator: operatorFromReq(req), detail: { venueId, name, businessType } });
    res.status(201).json(success(db.prepare('SELECT * FROM courts WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

// 修改场地
router.put('/courts/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('场地不存在', 404);
    const { venueId, name, businessType, status } = req.body || {};
    const updates = {};
    if (venueId) updates.venue_id = venueId;
    if (name) updates.name = name;
    if (businessType !== undefined) updates.business_type = businessType;
    if (status) updates.status = status;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = now();
      const sets = Object.keys(updates).map((k) => `${k === 'venueId' ? 'venue_id' : k === 'businessType' ? 'business_type' : k} = ?`).join(', ');
      db.prepare(`UPDATE courts SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
      writeAudit({ entity: 'court', entityId: req.params.id, action: 'UPDATE', operator: operatorFromReq(req), detail: updates });
    }
    res.json(success(db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.id)));
  } catch (e) { next(e); }
});

// 删除场地
router.delete('/courts/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const sessions = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE court_id = ? AND status = 'SCHEDULED'").get(req.params.id);
    if (sessions.cnt > 0) throw new BizError('场地有排课，无法删除');
    db.prepare('DELETE FROM courts WHERE id = ?').run(req.params.id);
    writeAudit({ entity: 'court', entityId: req.params.id, action: 'DELETE', operator: operatorFromReq(req), detail: {} });
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

export default router;
