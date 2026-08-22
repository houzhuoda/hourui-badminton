# 侯瑞羽毛球场馆管理系统

基于 PRD（`final_draft.md`）开发的四端羽毛球场馆管理系统。

## 技术栈

- 后端：Node.js 20+ / Express / SQLite（better-sqlite3）/ JWT
- 管理端：React 18 + Vite + Ant Design + ECharts
- 三端小程序：uni-app（Vue 3）— 销售 / 教练 / 会员
- 测试：Vitest + Supertest

## 项目结构

```
侯瑞羽毛球系统/
├── backend/           # Express API
├── admin/             # React 管理端
├── miniapps/          # uni-app 三端小程序
│   ├── sales/         # 销售端
│   ├── coach/         # 教练端
│   └── member/        # 会员端
├── shared/            # 跨端常量
├── docs/              # 项目文档
└── scripts/           # 工具脚本
```

## 快速启动

```bash
# 后端
nvm use 20
cd backend && npm install && npm run seed && npm run dev
# 默认端口：3100

# 管理端
cd admin && npm install && npm run dev
# 默认端口：5174
```

## 默认测试账号

- 管理员：admin / admin123
- 销售：13800000001 / 123456
- 教练：13800000002 / 123456
- 会员：任意已建档手机号 / 验证码 1234

## 测试

```bash
cd backend
npm test          # 功能测试（199 个用例通过）
npm run test:coverage  # 覆盖率检查
```

> 当前分支覆盖率约 58%，未达项目硬规则 75%，需后续补充测试。详见 `docs/COVERAGE-GAP.md`。

## 核心流程验证

1. 管理端：登录 → 经营看板 → 会员/课程/课表/教练/渠道/订单/报表
2. 销售端：登录 → 新建会员 → 购课开单 → 查看业绩
3. 教练端：登录 → 查看课表 → 出勤核销 → 查看统计
4. 会员端：登录 → 查看资产 → 约课 → 取消/请假 → 查看消费记录
