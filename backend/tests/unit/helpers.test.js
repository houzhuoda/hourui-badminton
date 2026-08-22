// 单元测试：工具函数
import { describe, it, expect } from 'vitest';
import {
  encryptPhone, decryptPhone, maskPhone, hashPhone,
  uuid, generateOrderNo, formatDate, addDays, addMonths, currentMonth,
  parsePagination, success, fail, hashPassword, verifyPassword,
} from '../../src/utils/helpers.js';

describe('手机号加密/解密/脱敏', () => {
  it('加密后解密应还原', () => {
    const phone = '13812345678';
    const encrypted = encryptPhone(phone);
    expect(encrypted).not.toBe(phone);
    expect(decryptPhone(encrypted)).toBe(phone);
  });

  it('脱敏应隐藏中间4位', () => {
    expect(maskPhone('13812345678')).toBe('138****5678');
    expect(maskPhone('123')).toBe('123');
  });

  it('相同手机号 hash 应一致', () => {
    expect(hashPhone('13812345678')).toBe(hashPhone('13812345678'));
    expect(hashPhone('13812345678')).not.toBe(hashPhone('13812345679'));
  });

  it('空值处理', () => {
    expect(encryptPhone(null)).toBeNull();
    expect(decryptPhone(null)).toBeNull();
    expect(maskPhone(null)).toBeNull();
  });
});

describe('UUID 与订单号', () => {
  it('uuid 应生成唯一值', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it('订单号格式正确', () => {
    const no = generateOrderNo();
    expect(no).toMatch(/^ORD-\d{8}-\d{4}$/);
  });
});

describe('日期工具', () => {
  it('formatDate 返回 YYYY-MM-DD', () => {
    expect(formatDate('2026-08-22T10:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('addDays 正确加天数', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('addMonths 正确加月数', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('currentMonth 返回 YYYY-MM', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('分页工具', () => {
  it('默认分页', () => {
    const r = parsePagination({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
    expect(r.offset).toBe(0);
  });

  it('自定义分页', () => {
    const r = parsePagination({ page: 3, pageSize: 50 });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(50);
    expect(r.offset).toBe(100);
  });

  it('上限保护', () => {
    const r = parsePagination({ page: 0, pageSize: 200 });
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(100);
  });
});

describe('响应工具', () => {
  it('success 格式', () => {
    const r = success({ a: 1 }, 'ok');
    expect(r.code).toBe(0);
    expect(r.data.a).toBe(1);
    expect(r.message).toBe('ok');
  });

  it('fail 格式', () => {
    const r = fail('错误', 400);
    expect(r.code).toBe(400);
    expect(r.message).toBe('错误');
    expect(r.data).toBeNull();
  });
});

describe('密码哈希', () => {
  it('哈希与验证', () => {
    const hash = hashPassword('mypassword');
    expect(hash).not.toBe('mypassword');
    expect(verifyPassword('mypassword', hash)).toBe(true);
    expect(verifyPassword('wrongpassword', hash)).toBe(false);
  });
});
