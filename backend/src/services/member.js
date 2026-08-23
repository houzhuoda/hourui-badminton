// 会员服务：建档、查询、详情、续费、标签管理
import { getDb } from '../db/index.js';
import {
  uuid, now, encryptPhone, decryptPhone, maskPhone, hashPhone,
  formatDate, addDays, parsePagination, success, fail,
} from '../utils/helpers.js';
import { BUSINESS_TO_CATEGORY, MEMBER_CATEGORIES, MEMBER_STATUS, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { writeAudit, operatorFromReq } from './audit.js';
import { BizError } from '../middleware/error.js';

// ============ 建档 ============
export function createMember(data, operator) {
  const { name, phone, gender, birthDate, categoryCode, channelId, subChannelId } = data;
  if (!name || !phone) throw new BizError('姓名和手机号必填');
  if (!/^\d{11}$/.test(phone)) throw new BizError('手机号格式错误');
  if (!categoryCode) throw new BizError('会员分类必填');

  const db = getDb();
  const phoneH = hashPhone(phone);

  // 重复建档校验（MEM-002 / SAL-003）
  const existing = db.prepare('SELECT id, name FROM members WHERE phone_hash = ?').get(phoneH);
  if (existing) {
    throw new BizError(`手机号已存在会员档案：${existing.name}，请选择已有会员`, 409);
  }

  const id = uuid();
  const encryptedPhone = encryptPhone(phone);

  const member = db.transaction(() => {
    db.prepare(`
      INSERT INTO members (id, name, phone, phone_hash, gender, birth_date, status, creator_id, creator_type, creator_name, channel_id, sub_channel_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, encryptedPhone, phoneH, gender || 'U', birthDate || null,
      operator?.id || null, operator?.type || null, operator?.name || null,
      channelId || null, subChannelId || null,
      now(), now()
    );

    // 初始标签（MEM-001：建档时单选初始标签）
    addTagInternal(id, categoryCode, 'MANUAL', operator, '建档初始分类');

    // 渠道来源（存入审计，渠道关联通过审计/统计查询；为方便统计，记录到 audit_logs）
    if (channelId) {
      writeAudit({
        entity: 'member', entityId: id, action: 'CHANNEL_ASSIGN',
        operator, detail: { channelId, subChannelId },
      });
    }

    return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  })();

  writeAudit({
    entity: 'member', entityId: id, action: AUDIT_ACTIONS.CREATE,
    operator, detail: { name, phone: maskPhone(phone), gender, birthDate, categoryCode, channelId, subChannelId },
  });

  return getMemberDetail(id);
}

// ============ 标签管理（内部） ============
function addTagInternal(memberId, categoryCode, source, operator, reason) {
  const db = getDb();
  // 已存在则跳过
  const exists = db.prepare('SELECT id FROM member_tags WHERE member_id = ? AND category_code = ?').get(memberId, categoryCode);
  if (exists) return false;
  db.prepare('INSERT INTO member_tags (id, member_id, category_code, source, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), memberId, categoryCode, source, now());
  db.prepare(`INSERT INTO member_tag_history (id, member_id, category_code, action, source, operator_id, operator_type, operator_name, reason, created_at)
    VALUES (?, ?, ?, 'ADD', ?, ?, ?, ?, ?, ?)`)
    .run(uuid(), memberId, categoryCode, source, operator?.id, operator?.type, operator?.name, reason, now());
  return true;
}

function removeTagInternal(memberId, categoryCode, operator, reason) {
  const db = getDb();
  const tag = db.prepare('SELECT id FROM member_tags WHERE member_id = ? AND category_code = ?').get(memberId, categoryCode);
  if (!tag) return false;
  db.prepare('DELETE FROM member_tags WHERE id = ?').run(tag.id);
  db.prepare(`INSERT INTO member_tag_history (id, member_id, category_code, action, source, operator_id, operator_type, operator_name, reason, created_at)
    VALUES (?, ?, ?, 'REMOVE', 'MANUAL', ?, ?, ?, ?, ?)`)
    .run(uuid(), memberId, categoryCode, operator?.id, operator?.type, operator?.name, reason, now());
  return true;
}

// 购买业务时自动累积标签（MEM-009）
export function autoAddTagOnPurchase(memberId, businessType, operator) {
  const categoryCode = BUSINESS_TO_CATEGORY[businessType];
  if (!categoryCode) return false;
  return addTagInternal(memberId, categoryCode, 'AUTO', operator, `购买 ${businessType} 业务自动累积`);
}

// 手动增删标签（MEM-010）
export function addTag(memberId, categoryCode, operator, reason) {
  const valid = MEMBER_CATEGORIES.find((c) => c.code === categoryCode);
  if (!valid) throw new BizError('无效的会员分类');
  const result = addTagInternal(memberId, categoryCode, 'MANUAL', operator, reason || '人工添加');
  if (result) {
    writeAudit({ entity: 'member', entityId: memberId, action: AUDIT_ACTIONS.TAG_ADD, operator, detail: { categoryCode, reason } });
  }
  return result;
}

export function removeTag(memberId, categoryCode, operator, reason) {
  const result = removeTagInternal(memberId, categoryCode, operator, reason || '人工移除');
  if (result) {
    writeAudit({ entity: 'member', entityId: memberId, action: AUDIT_ACTIONS.TAG_REMOVE, operator, detail: { categoryCode, reason } });
  }
  return result;
}

// ============ 查询列表 ============
export function listMembers(query) {
  const db = getDb();
  const { page, pageSize, offset } = parsePagination(query);
  const where = [`m.status != 'DELETED'`];
  const params = [];

  if (query.keyword) {
    const kw = query.keyword;
    // 姓名模糊匹配
    const conditions = [`m.name LIKE ?`];
    const kwParams = [`%${kw}%`];
    // 电话包含匹配（解密后比对，限制扫描数量）
    const baseWhere = where.join(' AND ');
    const baseParams = [...params];
    const phoneRows = db.prepare(`SELECT m.id, m.phone FROM members m WHERE ${baseWhere} ORDER BY m.created_at DESC LIMIT 1000`).all(...baseParams);
    const matchingIds = phoneRows.filter((r) => {
      const phone = decryptPhone(r.phone);
      return phone && phone.includes(kw);
    }).map((r) => r.id);
    if (matchingIds.length > 0) {
      conditions.push(`m.id IN (${matchingIds.map(() => '?').join(',')})`);
      kwParams.push(...matchingIds);
    }
    where.push(`(${conditions.join(' OR ')})`);
    params.push(...kwParams);
  }
  if (query.status) {
    where.push(`m.status = ?`);
    params.push(query.status);
  }
  if (query.creatorId) {
    where.push(`m.creator_id = ?`);
    params.push(query.creatorId);
  }
  // 会员分类筛选（多标签，命中任一即召回）
  if (query.categoryCode) {
    where.push(`EXISTS (SELECT 1 FROM member_tags t WHERE t.member_id = m.id AND t.category_code = ?)`);
    params.push(query.categoryCode);
  }
  // 业务类型筛选（转换为对应会员分类）
  if (query.businessType) {
    const cat = BUSINESS_TO_CATEGORY[query.businessType];
    if (cat) {
      where.push(`EXISTS (SELECT 1 FROM member_tags t WHERE t.member_id = m.id AND t.category_code = ?)`);
      params.push(cat);
    }
  }
  // 到期状态筛选
  if (query.expiryStatus === 'EXPIRING') {
    where.push(`EXISTS (SELECT 1 FROM packs p WHERE p.member_id = m.id AND p.status = 'ACTIVE' AND p.valid_until <= date('now', '+7 days'))`);
  } else if (query.expiryStatus === 'EXPIRED') {
    where.push(`EXISTS (SELECT 1 FROM packs p WHERE p.member_id = m.id AND p.status = 'EXPIRED')`);
  }

  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM members m WHERE ${whereSql}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT m.*, 
      (SELECT GROUP_CONCAT(t.category_code, ',') FROM member_tags t WHERE t.member_id = m.id) as tags
    FROM members m
    WHERE ${whereSql}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  const result = list.map((m) => ({
    ...m,
    phone: maskPhone(decryptPhone(m.phone)),
    tags: m.tags ? m.tags.split(',') : [],
  }));

  return { list: result, total, page, pageSize };
}

// ============ 会员详情 ============
export function getMemberDetail(id) {
  const db = getDb();
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!m) throw new BizError('会员不存在', 404);

  const tags = db.prepare('SELECT category_code, source, created_at FROM member_tags WHERE member_id = ?').all(id);
  const packs = db.prepare(`
    SELECT p.*, c.name as course_name 
    FROM packs p LEFT JOIN courses c ON p.course_id = c.id 
    WHERE p.member_id = ? AND p.status IN ('ACTIVE', 'EXPIRED') 
    ORDER BY p.created_at DESC
  `).all(id);
  const orders = db.prepare(`
    SELECT o.*, c.name as course_name 
    FROM orders o LEFT JOIN courses c ON o.course_id = c.id 
    WHERE o.member_id = ? ORDER BY o.created_at DESC LIMIT 50
  `).all(id);
  const consumptions = db.prepare(`
    SELECT pc.*, c.name as course_name, s.date, s.start_time
    FROM pack_consumptions pc 
    LEFT JOIN sessions s ON pc.session_id = s.id
    LEFT JOIN courses c ON pc.order_id IS NOT NULL AND c.id = (SELECT course_id FROM orders WHERE id = pc.order_id)
    WHERE pc.member_id = ? ORDER BY pc.created_at DESC LIMIT 50
  `).all(id);
  const attendance = db.prepare(`
    SELECT a.*, s.date, s.start_time, s.end_time, c.name as course_name, co.name as coach_name
    FROM attendance a 
    JOIN sessions s ON a.session_id = s.id
    LEFT JOIN courses c ON s.course_id = c.id
    LEFT JOIN coaches co ON a.coach_id = co.id
    WHERE a.member_id = ? ORDER BY a.created_at DESC LIMIT 50
  `).all(id);
  const tagHistory = db.prepare('SELECT * FROM member_tag_history WHERE member_id = ? ORDER BY created_at DESC').all(id);

  // 渠道来源（从审计日志取）
  const channelAudit = db.prepare(`SELECT detail FROM audit_logs WHERE entity = 'member' AND entity_id = ? AND action = 'CHANNEL_ASSIGN' ORDER BY created_at DESC LIMIT 1`).get(id);
  let channelInfo = null;
  if (channelAudit?.detail) {
    try {
      const d = JSON.parse(channelAudit.detail);
      if (d.channelId) {
        const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(d.channelId);
        const sub = d.subChannelId ? db.prepare('SELECT * FROM channels WHERE id = ?').get(d.subChannelId) : null;
        channelInfo = { channel: ch, subChannel: sub };
      }
    } catch {}
  }

  // 到期/余额不足提示（MEM-005）
  const alerts = [];
  for (const p of packs) {
    if (p.status === 'ACTIVE' && p.valid_until <= addDays(new Date(), 7)) {
      alerts.push({ type: 'PACK_EXPIRING', packId: p.id, message: `课包 ${p.course_name || ''} 将于 ${p.valid_until} 到期` });
    }
    if (p.status === 'EXPIRED') {
      alerts.push({ type: 'PACK_EXPIRED', packId: p.id, message: `课包 ${p.course_name || ''} 已到期` });
    }
  }

  return {
    ...m,
    phone: maskPhone(decryptPhone(m.phone)),
    tags: tags.map((t) => t.category_code),
    tagDetails: tags,
    tagHistory,
    channel: channelInfo,
    packs,
    orders,
    consumptions,
    attendance,
    alerts,
  };
}

// ============ 更新会员 ============
export function updateMember(id, data, operator) {
  const db = getDb();
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!m) throw new BizError('会员不存在', 404);

  const updates = {};
  if (data.name) updates.name = data.name;
  if (data.gender) updates.gender = data.gender;
  if (data.birthDate !== undefined) updates.birth_date = data.birthDate;
  if (data.status) {
    if (!Object.values(MEMBER_STATUS).includes(data.status)) throw new BizError('无效状态');
    updates.status = data.status;
  }

  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE members SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), id);
    writeAudit({ entity: 'member', entityId: id, action: AUDIT_ACTIONS.UPDATE, operator, detail: updates });
  }
  return getMemberDetail(id);
}

// ============ 停用/启用 ============
export function setMemberStatus(id, status, operator) {
  const db = getDb();
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!m) throw new BizError('会员不存在', 404);
  db.prepare('UPDATE members SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id);
  writeAudit({
    entity: 'member', entityId: id,
    action: status === MEMBER_STATUS.DISABLED ? AUDIT_ACTIONS.DISABLE : AUDIT_ACTIONS.ENABLE,
    operator, detail: { status },
  });
  return getMemberDetail(id);
}

// ============ 标签历史查询 ============
export function getTagHistory(memberId) {
  const db = getDb();
  return db.prepare('SELECT * FROM member_tag_history WHERE member_id = ? ORDER BY created_at DESC').all(memberId);
}

// ============ 审计日志查询 ============
export function getMemberAuditLogs(memberId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM audit_logs WHERE entity = 'member' AND entity_id = ? ORDER BY created_at DESC`).all(memberId);
}
