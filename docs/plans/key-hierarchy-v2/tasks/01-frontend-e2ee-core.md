# T01: 前端 e2ee 核心模块

## 目标

新建 `packages/frontend/src/lib/e2ee/` 纯函数模块（kdf / cipher / format / random），并引入 vitest 配齐单测。这是后续所有前端改造与迁移脚本的地基。不改任何现有业务代码。

## 上下文

- context.md 第 2、3 节；实施方案第 2、4、5 节。
- 参考现有代码风格：`packages/frontend/src/utils/crypto.ts`。
- 前端目前没有测试 runner，需引入 vitest（devDependency）并在 package.json 加 `test` script；vite 配置如需要可补 `test` 字段。

## 边界

只允许改动：

- `packages/frontend/src/lib/e2ee/**`（新建）
- `packages/frontend/package.json`（加 `hash-wasm` 依赖 + vitest 相关 devDependencies 与 test script）
- `packages/frontend/vite.config.ts` / 新增 `vitest.config.ts`（如需要）

## 验收

- `pnpm --filter frontend test` 全绿，覆盖：argon2id 输出 64B 且 KEK/V 拆分正确、v2 格式 round-trip、nonce 每次随机、AEAD tag 篡改必抛错、非法格式抛错、`wrapDek`/`unwrapDek` round-trip。
- `pnpm --filter frontend build` 通过。

## 依赖

无。
