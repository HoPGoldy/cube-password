# T08: 最终回归验收

## 目标
对 master...HEAD 全量改动做集成验收（配合 reviewer 的 ship review）：跑通 context.md 第 4 节的全部命令，并做生产模式冒烟。任何失败回退到对应 Ticket 的修复循环。

## 上下文
context.md 第 4 节（端到端验收）；`packages/e2e/playwright.config.ts`；`packages/backend/entrypoint.sh`（理解生产启动序列）。

## 边界
- 允许修改：修复过程中确需改动的、此前 Ticket 范围内的文件。
- 禁止触碰：引入任何新依赖、新配置面。

## 验收
即 context.md 第 4 节全文：lint、双端 tsc、backend vitest、双端 build、`E2E_LOGIN_PASSWORD=admin123 pnpm test:e2e` 全量、生产模式 curl 冒烟（HTML 200 + no-cache 头 + basename 已替换 + 幂等）。

## 依赖
T01-T07
