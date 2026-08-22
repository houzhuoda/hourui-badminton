// 课表路由
import { Router } from 'express';
import { authRole } from '../middleware/auth.js';
import { success } from '../utils/helpers.js';
import { operatorFromReq } from '../services/audit.js';
import {
  createSession, getSessionDetail, listSessions, updateSession,
  cancelSession, batchCreateSessions, addParticipant, removeParticipant,
} from '../services/session.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 课表列表
router.get('/', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const query = { ...req.query };
    // 教练只看本人课表
    if (req.user.role === 'coach') query.coachId = req.user.id;
    // 会员只看开放约课的课次
    if (req.user.role === 'member') query.bookingOpen = 1;
    const list = listSessions(query);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 课次详情
router.get('/:id', authRole(['admin', 'coach', 'member']), (req, res, next) => {
  try {
    const s = getSessionDetail(req.params.id);
    // 教练只能看本人课次
    if (req.user.role === 'coach' && s.coach_id !== req.user.id) throw new BizError('无权查看', 403);
    res.json(success(s));
  } catch (e) { next(e); }
});

// 排课
router.post('/', authRole(['admin']), (req, res, next) => {
  try {
    const s = createSession(req.body, operatorFromReq(req));
    res.status(201).json(success(s, '排课成功'));
  } catch (e) { next(e); }
});

// 批量排课（模板化）
router.post('/batch', authRole(['admin']), (req, res, next) => {
  try {
    const result = batchCreateSessions(req.body, operatorFromReq(req));
    res.status(201).json(success(result, `批量排课完成，成功 ${result.created} 节`));
  } catch (e) { next(e); }
});

// 修改课次
router.put('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const s = updateSession(req.params.id, req.body, operatorFromReq(req));
    res.json(success(s));
  } catch (e) { next(e); }
});

// 取消课次
router.delete('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const result = cancelSession(req.params.id, operatorFromReq(req), req.body.reason);
    res.json(success(result, '课次已取消'));
  } catch (e) { next(e); }
});

// 添加学员
router.post('/:id/participants', authRole(['admin']), (req, res, next) => {
  try {
    const s = addParticipant(req.params.id, req.body.memberId, operatorFromReq(req));
    res.json(success(s));
  } catch (e) { next(e); }
});

// 移除学员
router.delete('/:id/participants/:memberId', authRole(['admin']), (req, res, next) => {
  try {
    const result = removeParticipant(req.params.id, req.params.memberId, operatorFromReq(req));
    res.json(success(result));
  } catch (e) { next(e); }
});

export default router;
