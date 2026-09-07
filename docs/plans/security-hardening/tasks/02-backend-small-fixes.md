# T02: 后端小改合集（lockType 枚举 / P2003 / 全 POST）

## 目标

三个后端局部修复：lockType 入参加枚举校验且 unlock 拒绝未知类型（防"非法锁类型=
一碰就开的假锁"）；Prisma P2003 外键约束错误从 500 改映射 400；challenge/global/
config-version 三个 GET 接口改 POST，对齐 AGENTS.md「全 POST」原则。

## 上下文

- context.md 第 2.3、2.6、2.7 条。
- 必读源码：`backend/src/types/group.ts`（lockType 定义在 :24 与 :61 两处 schema）、
  `backend/src/modules/group/service.ts:116-181`（unlock 的 if 链结构，fall-through
  在末尾 addUnlockedGroup）、`backend/src/lib/unify-response/index.ts:12-27`、
  `backend/src/modules/{auth,app-config}/controller.ts`（GET 路由）。

## 边界

- `backend/src/types/group.ts`
- `backend/src/modules/group/service.ts`（仅 unlock 函数）
- `backend/src/lib/unify-response/index.ts`（仅 PrismaErrorFeedback）
- `backend/src/modules/auth/controller.ts`、`backend/src/modules/app-config/controller.ts`（仅 method）
- 注意：GET→POST 的前端与 e2e 适配在 T04 一并做，本任务只改后端（改完 e2e 会红，
  属预期，T04 收口）。

## 验收

- `pnpm --filter backend test` 全绿；新增单测：unlock 对 lockType="banana" 的存量
  group 抛错不放行；addGroup/updateConfig 传非法 lockType 返回 400。
- P2003 场景（可单测 mock 或 e2e）：update/move 到不存在的 groupId 返回 400 而非 500。
- 三个路由注册为 post，`grep -rn "server.get(" backend/src/modules/` 仅剩 0 个业务路由
  （swagger 内部路由除外）。

## 依赖

无（与 T01 并行安全，无文件交集）。
