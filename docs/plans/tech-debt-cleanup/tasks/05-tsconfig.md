# T05: tsconfig 收紧

## 目标

开启编译器严格检查，让类型系统真正参与兜底（安全敏感项目的基本要求）。

## 上下文

- context.md 第 1 节范围、第 2 节方案概要第 5 条、第 3 节已知坑（当前代码开启后各仅 1 处错误及位置）。
- 文件：`packages/frontend/tsconfig.json`（`strict: true`、`target` es5→ES2020）、`packages/backend/tsconfig.json`（`noImplicitAny: true`）。
- 若开启后出现已知坑之外的新错误：逐个修复但不重构，保持行为不变；不动 `skipLibCheck`、模块解析等无关选项。

## 边界

只允许改动两个 tsconfig.json、以及为修类型错误所必需的最小源码改动。

## 验收

`pnpm --filter backend build && pnpm --filter frontend build` 通过；`pnpm lint && pnpm --filter backend test && pnpm --filter frontend test` 全绿。

## 依赖

T01、T02（app-config 类型错误在 T02 顺带修复）。
