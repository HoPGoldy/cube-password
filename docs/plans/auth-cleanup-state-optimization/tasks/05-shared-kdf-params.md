# T05: 新建 packages/shared 合并 kdf-params 校验

## 目标
仓库内新建 pnpm workspace 包 `packages/shared`（name: `@cube-password/shared`，仅源码 export、type: module、不发布 npm），内容从前端 `lib/e2ee/kdf.ts` 抽出：`KdfParams` 接口、`DEFAULT_KDF_PARAMS`、`ErrorInvalidKdfParams`、`parseKdfParams`（含完整校验规则与错误文案，一字不改）。前端 `lib/e2ee/kdf.ts` 改为从 shared import 并 **re-export** 这四个符号（`@/lib/e2ee` 对外接口不变，所有组件与 e2e fixtures 零改动）；后端删除 `lib/kdf-params/index.ts` 内联版，`modules/group/service.ts` 改为 import shared 的 `parseKdfParams` 与 `KdfParams`（行为等价，注意后端原版少了 version===1 的显式校验，以 shared 版为准——更严格，属修复而非破坏）；后端 `lib/kdf-params/index.test.ts` 迁移为 `packages/shared` 的 vitest 测试。

## 上下文
context.md 第 2 节第 6 条、第 3 节「已知的坑」（paths 配置）；源码：`packages/frontend/src/lib/e2ee/kdf.ts` + `kdf-params.test.ts`、`packages/backend/src/lib/kdf-params/`、`packages/backend/src/modules/group/service.ts`、`packages/backend/package.json`、`packages/frontend/package.json`、根 `pnpm-workspace.yaml`。

## 边界
- 允许修改/新建：`packages/shared/**`（新建）、frontend `lib/e2ee/kdf.ts`（改 re-export）、backend `modules/group/service.ts`、backend 删 `lib/kdf-params/`、双端 `package.json`（加 `@cube-password/shared: workspace:*` 依赖）、双端 `tsconfig.json`（paths 增加 `"@cube-password/shared/*": ["../shared/src/*"]` 或等价单路径映射）、根 `pnpm-workspace.yaml`（如需）。
- 禁止触碰：`lib/e2ee/` 其余文件（cipher/format/random）、组件层、`@/lib/e2ee` 的 index.ts 导出清单。

## 验收
- `pnpm install` 成功（workspace 链接生效）。
- `pnpm --filter shared test`（shared 内配 vitest）+ 双端 `tsc --noEmit` 全绿；`pnpm --filter backend test` 全绿（group service 测试如有引用须过）。
- `E2E_LOGIN_PASSWORD=admin123 pnpm test:e2e`（packages/e2e 下，登录链路走 parseKdfParams）全绿。

## 依赖
无
