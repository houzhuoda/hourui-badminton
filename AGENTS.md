# 侯瑞羽毛球场馆管理系统 — 项目规范

## 项目概述
基于 PRD（final_draft.md）开发的四端羽毛球场馆管理系统：管理端（Web）+ 销售端/教练端/会员端（微信小程序，本期模拟登录）。

## 技术栈
- **后端**：Node.js 20+ / Express / SQLite (better-sqlite3) / JWT
- **管理端**：React 18 + Vite + Ant Design
- **三端小程序**：uni-app (Vue 3) — 销售/教练/会员
- **测试**：Vitest + Supertest + @testing-library/react
- **共享常量**：shared/constants.js（业务类型、会员分类、收费模式等枚举）

## 目录结构
```
侯瑞羽毛球系统/
├── backend/          # Node.js + Express + SQLite API
│   ├── src/
│   │   ├── db/       # 数据库初始化、迁移、种子
│   │   ├── middleware/  # 鉴权、错误处理、审计日志
│   │   ├── models/   # 数据访问层
│   │   ├── routes/   # API 路由
│   │   ├── services/ # 业务逻辑（开单、核销、提成计算等）
│   │   ├── utils/    # 工具函数
│   │   └── app.js    # Express 应用入口
│   └── tests/        # unit/integration/smoke/regression
├── admin/            # React + Vite 管理端
├── miniapps/         # uni-app 三端小程序
│   ├── sales/        # 销售端
│   ├── coach/        # 教练端
│   └── member/       # 会员端
├── shared/           # 跨端共享常量
├── docs/             # 项目文档
└── scripts/          # 脚本（覆盖率检查等）
```

## 开发命令
```bash
# 后端
cd backend && npm install
cd backend && npm run dev        # 开发模式（nodemon，端口 3100）
cd backend && npm test           # 运行测试
cd backend && npm run predeploy  # 测试 + 覆盖率检查

# 管理端
cd admin && npm install
cd admin && npm run dev          # Vite 开发（端口 5174）
cd admin && npm run build

# 小程序（各端独立）
cd miniapps/sales && npm run dev:h5   # H5 调试
```

## 测试规范（硬规则）
1. 先写失败测试 → 实现功能 → 测试通过
2. 覆盖率：行 ≥ 80% / 分支 ≥ 75% / 函数 ≥ 70%
3. 外部依赖必须 mock
4. Bug 修复必须附带回归测试
5. `npm test` 全部通过后才允许 commit
6. 测试目录：backend/tests/{unit,integration,smoke,regression}

## 关键业务规则（来自 PRD）
- **七类业务类型**：私教/陪练/成人大课/儿童大课/健身/体能课/群活动
- **七类会员分类**（多标签制）：随购买业务自动累积
- **三种收费模式**：预存赠送（先扣本金后扣赠送）/ 次卡（有效期 1 年）/ 月卡（不结转）
- **群活动**：单次付费 + 群活动多次卡
- **扣费顺序**：先进先出，先本金后赠送
- **退费**：次卡按剩余节数 × 单次原价；预存按剩余本金退；赠送不退
- **折扣**：不叠加，取最优
- **销售提成**：业务类型 × 新客/续费 矩阵；教练开单同规则
- **核销唯一入口**：教练端出勤登记（及管理端代录）
- **会员端**：仅自助查看 + 约课 + 请假，无支付

## API 约定
- BASE: `/api`
- 鉴权：`Authorization: Bearer <jwt>`
- 角色claim：`{ role: 'admin'|'sales'|'coach'|'member', id, name }`
- 响应格式：`{ code: 0, data, message }` 成功；`{ code: <!=0>, message }` 失败
- 分页：`?page=1&pageSize=20` → `{ list, total, page, pageSize }`

## 端口分配（本地开发）
- 后端 API：3100
- 管理端：5174
- 销售端 H5：5175
- 教练端 H5：5176
- 会员端 H5：5177
