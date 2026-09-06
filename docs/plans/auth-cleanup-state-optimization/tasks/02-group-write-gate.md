# T02: 锁定分组的写操作门禁

## 目标
`CertificateService` 的 `add`/`update`/`delete`/`move`/`sort` 补齐 `isGroupUnlocked` 校验，语义：锁定的分组 = 当前 session 完全碰不了（读已有校验，本次补写）。统一抛 `ErrorForbidden("分组未解锁")`（与现有 `listByGroup` 一致）。涉及多组的操作（move 的目标组、delete/sort 的每一组）须逐一校验，任一未解锁则整体拒绝。`search` 明确不加门禁（跨组分页，context.md 第 2 节第 2 条）。`detail`/`listByGroup` 已有校验不动。

## 上下文
context.md 第 2 节第 2 条；源码：`packages/backend/src/modules/certificate/service.ts`、`packages/backend/src/lib/session/index.ts`（`isGroupUnlocked`）、`packages/e2e/tests/api-group-certificate.spec.ts`（现有 e2e 风格参考）、`packages/e2e/fixtures/api.ts`（分组解锁 helper）。

## 边界
- 允许修改：`modules/certificate/service.ts`、`packages/e2e/tests/`（新增一个 spec 文件，如 `group-write-gate.spec.ts`，覆盖：未解锁分组 add/update/delete/move/sort 均被 403 拒绝、解锁后成功、move 目标组未解锁时拒绝）。
- 禁止触碰：group 模块、auth 模块、前端。

## 验收
- `pnpm --filter backend exec tsc --noEmit` 零错误。
- `E2E_LOGIN_PASSWORD=admin123 pnpm test:e2e`（packages/e2e 下）全绿，含新 spec。

## 依赖
无
