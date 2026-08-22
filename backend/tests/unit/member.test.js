// 单元测试：会员服务（多标签、建档、查询）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getAdminToken } from '../helpers.js';
import { createMember, getMemberDetail, addTag, removeTag, listMembers, autoAddTagOnPurchase } from '../../src/services/member.js';
import { BUSINESS_TO_CATEGORY } from '../../../shared/constants.js';

let adminToken;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('会员建档', () => {
  it('应成功建档并设置初始标签', () => {
    const member = createMember({
      name: '张三',
      phone: '13800001111',
      gender: 'M',
      birthDate: '1990-01-01',
      categoryCode: 'M_PRIVATE',
    }, { id: 'test-admin', type: 'admin', name: '管理员' });

    expect(member.name).toBe('张三');
    expect(member.tags).toContain('M_PRIVATE');
    expect(member.status).toBe('ACTIVE');
  });

  it('重复手机号应拦截', () => {
    expect(() => {
      createMember({
        name: '李四',
        phone: '13800001111',
        categoryCode: 'M_PRACTICE',
      }, { id: 'test-admin', type: 'admin', name: '管理员' });
    }).toThrow();
  });

  it('缺少必填字段应报错', () => {
    expect(() => createMember({ name: '王五' }, {})).toThrow();
    expect(() => createMember({ phone: '13800002222' }, {})).toThrow();
  });

  it('手机号格式校验', () => {
    expect(() => createMember({
      name: '赵六', phone: '123', categoryCode: 'M_PRIVATE',
    }, {})).toThrow();
  });
});

describe('会员分类多标签（Q-16）', () => {
  it('购买新业务应自动累积标签', () => {
    const member = createMember({
      name: '多标签会员',
      phone: '13800003333',
      categoryCode: 'M_PRIVATE',
    }, { id: 'test-admin', type: 'admin', name: '管理员' });

    // 初始只有私教标签
    expect(member.tags).toEqual(['M_PRIVATE']);

    // 购买健身业务 → 自动累积健身标签
    autoAddTagOnPurchase(member.id, 'GYM', { id: 'test-admin', type: 'admin', name: '管理员' });
    const updated = getMemberDetail(member.id);
    expect(updated.tags).toContain('M_PRIVATE');
    expect(updated.tags).toContain('M_GYM');
  });

  it('重复购买同业务不应重复添加标签', () => {
    const member = createMember({
      name: '重复标签测试',
      phone: '13800004444',
      categoryCode: 'M_PRIVATE',
    }, {});

    // 建档时已添加 M_PRIVATE，autoAddTagOnPurchase 对同业务应跳过
    const r1 = autoAddTagOnPurchase(member.id, 'PRIVATE', {});
    const r2 = autoAddTagOnPurchase(member.id, 'PRIVATE', {});
    expect(r1).toBe(false); // 建档时已有，跳过
    expect(r2).toBe(false); // 仍然跳过
  });

  it('管理员可手动增删标签', () => {
    const member = createMember({
      name: '手动标签测试',
      phone: '13800005555',
      categoryCode: 'M_PRIVATE',
    }, {});

    addTag(member.id, 'M_GYM', { id: 'admin', type: 'admin', name: '管理员' }, '测试添加');
    expect(getMemberDetail(member.id).tags).toContain('M_GYM');

    removeTag(member.id, 'M_GYM', { id: 'admin', type: 'admin', name: '管理员' }, '测试移除');
    expect(getMemberDetail(member.id).tags).not.toContain('M_GYM');
  });

  it('标签变更历史可查询', () => {
    const member = createMember({
      name: '历史测试',
      phone: '13800006666',
      categoryCode: 'M_PRIVATE',
    }, {});

    addTag(member.id, 'M_GYM', {}, '历史测试添加');
    removeTag(member.id, 'M_GYM', {}, '历史测试移除');

    const detail = getMemberDetail(member.id);
    expect(detail.tagHistory.length).toBeGreaterThanOrEqual(3); // 初始 + 添加 + 移除
  });
});

describe('会员查询', () => {
  it('按姓名搜索', () => {
    createMember({ name: '搜索测试人', phone: '13800007777', categoryCode: 'M_PRIVATE' }, {});
    const result = listMembers({ keyword: '搜索测试' });
    expect(result.list.length).toBeGreaterThan(0);
    expect(result.list[0].name).toContain('搜索测试');
  });

  it('按手机号搜索（精确匹配）', () => {
    createMember({ name: '手机搜索', phone: '13800008888', categoryCode: 'M_PRIVATE' }, {});
    const result = listMembers({ keyword: '13800008888' });
    expect(result.list.length).toBe(1);
  });

  it('按会员分类筛选', () => {
    createMember({ name: '分类筛选', phone: '13800009999', categoryCode: 'M_GYM' }, {});
    const result = listMembers({ categoryCode: 'M_GYM' });
    expect(result.list.every((m) => m.tags.includes('M_GYM'))).toBe(true);
  });

  it('分页', () => {
    const result = listMembers({ page: 1, pageSize: 2 });
    expect(result.list.length).toBeLessThanOrEqual(2);
    expect(result.pageSize).toBe(2);
  });
});

describe('会员详情', () => {
  it('应返回完整详情含 alerts', () => {
    const member = createMember({
      name: '详情测试',
      phone: '13800010000',
      categoryCode: 'M_PRIVATE',
    }, {});
    const detail = getMemberDetail(member.id);
    expect(detail.name).toBe('详情测试');
    expect(detail.packs).toBeDefined();
    expect(detail.orders).toBeDefined();
    expect(detail.alerts).toBeDefined();
    expect(Array.isArray(detail.alerts)).toBe(true);
  });

  it('不存在会员应报错', () => {
    expect(() => getMemberDetail('nonexistent-id')).toThrow();
  });
});
