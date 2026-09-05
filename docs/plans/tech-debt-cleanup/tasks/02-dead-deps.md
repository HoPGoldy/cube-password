# T02: 死依赖与 NodeCache 删除

## 目标

删除代码零 import 的 npm 依赖与 AppConfig 的内存缓存层。依赖清单与保留项见 context.md 第 1、2 节（`mockjs` 与 `/certificate/rand-name` 端点明确保留）。

## 上下文

- context.md 第 1 节范围、第 2 节方案概要第 2 条。
- 源码：`packages/backend/package.json`、`packages/frontend/package.json`、`packages/backend/src/modules/app-config/service.ts`（NodeCache 层：`cache` 字段、`getAll` 缓存读、`setConfigValues` 缓存失效）。
- 删除依赖后须全量构建，防止类型 / css 等隐式引用漏删。
- context.md 第 3 节已知坑：`getAll` 中 `const configs = {}` 的隐式 any 在本任务顺带改为显式 `Record<string, string>`（T05 开启 noImplicitAny 的前置）。

## 边界

只允许改动两个 package.json、lockfile、`app-config/service.ts`；不改 app-config 的接口 schema 与响应。

## 验收

`pnpm --filter backend build && pnpm --filter frontend build` 通过；`pnpm --filter backend test` 全绿；`pnpm test:e2e` 中 config 用例通过。

## 依赖

T01。
