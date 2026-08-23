// 会员路由
import { Router } from 'express';
import { authRole, authMiddleware } from '../middleware/auth.js';
import { success, fail, decryptPhone, maskPhone, verifyPassword, hashPassword, now } from '../utils/helpers.js';
import { getDb } from '../db/index.js';
import { operatorFromReq } from '../services/audit.js';
import {
  createMember, listMembers, getMemberDetail, updateMember,
  setMemberStatus, addTag, removeTag, getTagHistory, getMemberAuditLogs,
} from '../services/member.js';
import { MEMBER_STATUS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 自动完成搜索（边输入边查询，支持姓名模糊+电话包含匹配）
router.get('/search', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const keyword = (req.query.keyword || '').trim();
    if (!keyword || keyword.length < 1) return res.json(success([]));
    const isAdmin = req.user.role === 'admin';
    // 销售/教练只能搜索本人建档的会员
    let where = `m.status != 'DELETED'`;
    const params = [];
    if (req.user.role === 'sales' || req.user.role === 'coach') {
      where += ` AND m.creator_id = ?`;
      params.push(req.user.id);
    }
    // 1. 姓名模糊匹配
    const rows = db.prepare(`SELECT m.id, m.name, m.phone, m.gender, m.status FROM members m WHERE ${where} AND m.name LIKE ? ORDER BY m.created_at DESC LIMIT 20`)
      .all(...params, `%${keyword}%`);
    // 2. 电话包含匹配（解密后比对，限制扫描数量）
    const allPhoneRows = db.prepare(`SELECT m.id, m.name, m.phone, m.gender, m.status FROM members m WHERE ${where} ORDER BY m.created_at DESC LIMIT 500`).all(...params);
    for (const r of allPhoneRows) {
      if (rows.length >= 20) break;
      const phone = decryptPhone(r.phone);
      if (phone && phone.includes(keyword) && !rows.find((x) => x.id === r.id)) {
        rows.push(r);
      }
    }
    // admin 返回完整电话，sales/coach 返回脱敏电话
    const result = rows.map((r) => {
      const phone = decryptPhone(r.phone);
      return { ...r, phone: isAdmin ? phone : maskPhone(phone) };
    });
    res.json(success(result));
  } catch (e) { next(e); }
});

// 建档（管理员/销售/教练均可，教练需销售能力开关在 service 层或前置校验）
router.post('/', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    // 教练需开启销售能力
    if (req.user.role === 'coach' && !req.user.salesEnabled) {
      throw new BizError('未开启销售能力', 403);
    }
    const member = createMember(req.body, operatorFromReq(req));
    res.status(201).json(success(member, '建档成功'));
  } catch (e) { next(e); }
});

// 列表
router.get('/', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    // 销售/教练只能看本人建档的会员
    const query = { ...req.query };
    if (req.user.role === 'sales' || req.user.role === 'coach') {
      query.creatorId = req.user.id;
    }
    const result = listMembers(query);
    res.json(success(result));
  } catch (e) { next(e); }
});

// 详情
router.get('/:id', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    // 会员只能看本人
    if (req.user.role === 'member' && req.user.memberId !== req.params.id) {
      throw new BizError('无权查看他人档案', 403);
    }
    const member = getMemberDetail(req.params.id);
    res.json(success(member));
  } catch (e) { next(e); }
});

// 查看会员完整电话（需管理员密码验证）
router.post('/:id/view-phone', authRole(['admin']), (req, res, next) => {
  try {
    const { adminPassword } = req.body || {};
    if (!adminPassword) throw new BizError('请输入管理员密码', 400);
    const db = getDb();
    const admin = db.prepare('SELECT password_hash FROM admins WHERE id = ? AND status = ?').get(req.user.id, 'ACTIVE');
    if (!admin || !verifyPassword(adminPassword, admin.password_hash)) {
      throw new BizError('管理员密码错误', 403);
    }
    const member = db.prepare('SELECT phone FROM members WHERE id = ?').get(req.params.id);
    if (!member) throw new BizError('会员不存在', 404);
    const phone = decryptPhone(member.phone);
    res.json(success({ phone }));
  } catch (e) { next(e); }
});

// 更新
router.put('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const member = updateMember(req.params.id, req.body, operatorFromReq(req));
    res.json(success(member));
  } catch (e) { next(e); }
});

// 停用/启用
router.patch('/:id/status', authRole(['admin']), (req, res, next) => {
  try {
    const { status } = req.body;
    if (!Object.values(MEMBER_STATUS).includes(status)) throw new BizError('无效状态');
    const member = setMemberStatus(req.params.id, status, operatorFromReq(req));
    res.json(success(member));
  } catch (e) { next(e); }
});

// 手动添加标签
router.post('/:id/tags', authRole(['admin']), (req, res, next) => {
  try {
    const { categoryCode, reason } = req.body;
    const result = addTag(req.params.id, categoryCode, operatorFromReq(req), reason);
    res.json(success({ added: result }));
  } catch (e) { next(e); }
});

// 手动移除标签
router.delete('/:id/tags/:categoryCode', authRole(['admin']), (req, res, next) => {
  try {
    const result = removeTag(req.params.id, req.params.categoryCode, operatorFromReq(req), req.body.reason);
    res.json(success({ removed: result }));
  } catch (e) { next(e); }
});

// 标签历史
router.get('/:id/tag-history', authRole(['admin']), (req, res, next) => {
  try {
    const list = getTagHistory(req.params.id);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 审计日志
router.get('/:id/audit-logs', authRole(['admin']), (req, res, next) => {
  try {
    const list = getMemberAuditLogs(req.params.id);
    res.json(success(list));
  } catch (e) { next(e); }
});

export default router;
