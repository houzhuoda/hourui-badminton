// 会员路由
import { Router } from 'express';
import { authRole } from '../middleware/auth.js';
import { success, fail } from '../utils/helpers.js';
import { operatorFromReq } from '../services/audit.js';
import {
  createMember, listMembers, getMemberDetail, updateMember,
  setMemberStatus, addTag, removeTag, getTagHistory, getMemberAuditLogs,
} from '../services/member.js';
import { MEMBER_STATUS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

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
