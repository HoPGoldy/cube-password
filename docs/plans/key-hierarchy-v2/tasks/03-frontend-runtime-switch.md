# T03: 前端运行时切换 e2ee

## 目标

前端全链路切到 e2ee：`utils/crypto.ts` 重写（删旧派生、sha512 换 `@noble/hashes`）、`store/user.ts` 的 `stateMainPwd` 换成 `stateVault`、init/login/change-password 三页按实施方案 2.2/2.3/2.4 重写、凭证加解密调用点切换到 DEK、接入 zxcvbn 懒加载强度提示、移除 crypto-js。完成后前端不再存在任何 v1 密码学路径。

## 上下文

- context.md 第 2、3 节；实施方案第 2、5、7 节。
- T01 产出的 `src/lib/e2ee/` 接口；T02 产出的 `backend/src/types/` 新 schema。
- 源码：`pages/{login,init,change-password}/`、`store/user.ts`、`utils/crypto.ts`、`pages/certificate-list/components/certificate-detail.tsx`、`services/auth.ts`。
- 改密码后不跳转重新登录（保持 session）；KDF 期间给 loading 反馈。

## 边界

只允许改动：`packages/frontend/**`。

## 验收

- `pnpm --filter frontend build`（含 tsc typecheck）通过、`pnpm lint` 无新增错误。
- `pnpm --filter frontend test` 全绿。
- package.json 中 `crypto-js` / `@types/crypto-js` 已移除，全仓 grep 不到 `crypto-js`、`getAesMeta`、`validateAesMeta`、`stateMainPwd`。

## 依赖

T01（e2ee 模块接口）、T02（shared types）。
