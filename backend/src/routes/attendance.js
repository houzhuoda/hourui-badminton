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

// 教练上课明细列表（支持按时间、课程种类查询）
router.get('/my-detail', authRole(['coach', 'admin']), (req, res, next) => {
  try {
    const db = getDb();
    const coachId = req.user.role === 'coach' ? req.user.id : req.query.coachId;
    if (!coachId) throw new BizError('coachId 必填');
    const coach = db.prepare('SELECT primary_business_type FROM coaches WHERE id = ?').get(coachId);
    const primaryBusinessTypes = coach && coach.primary_business_type
      ? coach.primary_business_type.split(',').filter(Boolean)
      : [];
    const { startDate, endDate, businessType, page, pageSize } = req.query;
    const p = parseInt(page) || 1;
    const ps = parseInt(pageSize) || 20;
    const where = ['a.coach_id = ?'];
    const params = [coachId];
    if (startDate) { where.push('s.date >= ?'); params.push(startDate); }
    if (endDate) { where.push('s.date <= ?'); params.push(endDate); }
    if (businessType) { where.push('s.business_type = ?'); params.push(businessType); }
    const whereSql = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE ${whereSql}`).get(...params).cnt;
    const list = db.prepare(`
      SELECT a.id, a.status, a.note, a.lesson_fee, a.share_amount, a.created_at,
        s.id as session_id, s.date, s.start_time, s.end_time, s.business_type,
        c.name as course_name, m.name as member_name, m.id as member_id,
        ct.name as court_name
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN members m ON a.member_id = m.id
      LEFT JOIN courts ct ON s.court_id = ct.id
      WHERE ${whereSql}
      ORDER BY s.date DESC, s.start_time DESC
      LIMIT ? OFFSET ?
    `).all(...params, ps, (p - 1) * ps);
    res.json(success({ list, total, page: p, pageSize: ps, primaryBusinessTypes }));
  } catch (e) { next(e); }
});

export default router;
