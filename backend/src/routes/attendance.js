// 出勤路由
import { Router } from 'express';
import { authRole } from '../middleware/auth.js';
import { success } from '../utils/helpers.js';
import { operatorFromReq } from '../services/audit.js';
import { submitAttendance, updateAttendance, getSessionAttendance, getCoachStats } from '../services/attendance.js';
import { getDb } from '../db/index.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 提交出勤（教练）
router.post('/:sessionId/submit', authRole(['coach', 'admin']), (req, res, next) => {
  try {
    const { attendance } = req.body || {};
    if (!Array.isArray(attendance)) throw new BizError('attendance 必须为数组');
    // 教练只能提交本人课次
    if (req.user.role === 'coach') {
      const db = getDb();
      const s = db.prepare('SELECT coach_id FROM sessions WHERE id = ?').get(req.params.sessionId);
      if (!s) throw new BizError('课次不存在', 404);
      if (s.coach_id !== req.user.id) throw new BizError('无权操作他人课次', 403);
    }
    const result = submitAttendance(req.params.sessionId, attendance, operatorFromReq(req));
    res.json(success(result, '出勤提交成功'));
  } catch (e) { next(e); }
});

// 修改出勤
router.patch('/:sessionId/attendance/:memberId', authRole(['coach', 'admin']), (req, res, next) => {
  try {
    const { status, reason } = req.body || {};
    if (req.user.role === 'coach') {
      const db = getDb();
      const s = db.prepare('SELECT coach_id FROM sessions WHERE id = ?').get(req.params.sessionId);
      if (!s) throw new BizError('课次不存在', 404);
      if (s.coach_id !== req.user.id) throw new BizError('无权操作', 403);
    }
    const result = updateAttendance(req.params.sessionId, req.params.memberId, status, operatorFromReq(req), reason);
    res.json(success(result));
  } catch (e) { next(e); }
});

// 查询课次出勤
router.get('/:sessionId/attendance', authRole(['admin', 'coach']), (req, res, next) => {
  try {
    if (req.user.role === 'coach') {
      const db = getDb();
      const s = db.prepare('SELECT coach_id FROM sessions WHERE id = ?').get(req.params.sessionId);
      if (!s || s.coach_id !== req.user.id) throw new BizError('无权查看', 403);
    }
    const list = getSessionAttendance(req.params.sessionId);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 教练上课统计
router.get('/stats/coach', authRole(['coach', 'admin']), (req, res, next) => {
  try {
    const coachId = req.user.role === 'coach' ? req.user.id : req.query.coachId;
    if (!coachId) throw new BizError('coachId 必填');
    const stats = getCoachStats(coachId, req.query.startDate, req.query.endDate);
    res.json(success(stats));
  } catch (e) { next(e); }
});

export default router;
