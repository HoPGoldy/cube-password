# T06: 前端分组状态拆分（react-query + jotai 解锁集）

## 目标
按 context.md 第 2 节第 5 条把分组状态按数据归属拆分：

1. 服务端数据走 react-query：复活 `services/group.ts` 的 `useGroupList`（queryKey `["groupList"]`），登录成功后 `queryClient.invalidateQueries({ queryKey: ["groupList"] })` 触发拉取；`useAddGroup`/`useDeleteGroup`/`useUpdateGroupName`/`useUpdateGroupConfig` 的 onSuccess 已有 invalidate 不动。
2. 解锁态：`store/user.ts` 删 `stateGroupList` atom 与 `GroupInfo`，新增 `stateUnlockedGroupIds = atom<Set<number>>(new Set())`；`login()` 里把 `lockType === "None"` 的组 id 加入；`logout()` 清空；组件内派生 `group.lockType === "None" || ids.has(group.id)`。
3. 组件改造（4 处手动 `setGroups` 全部删除）：`layouts/sidebar/index.tsx`（改 `useGroupList` + 解锁集）、`pages/certificate-list/index.tsx`（`currentGroup`/`isUnlocked` 改从 query 数据派生）、`components/group-unlock.tsx`（unlock 成功改为往 `stateUnlockedGroupIds` 加 id）、`pages/certificate-list/components/group-config-modal.tsx` 与 `group-sidebar.tsx`（同规则）；`layouts/app-container/use-page-title.tsx` 的 group 读取改 query 数据。
4. 后端 `addGroup` 只返回 `{ newId }`（`modules/group/service.ts` 删 `newList`，`types/group.ts` 的 `SchemaGroupAddResponse` 同步删 `newList` 字段）。
5. 前端 `types/auth.ts` 手写 `LockDetail`/`LoginFailRecord` 删除，改 `import type { ... } from "@shared-types/auth"`（T03 已删 ip 字段，此处对齐）。
6. **T03 挂账（必须一并处理）**：`pages/login/page.tsx` 的 `renderLoginFailure` 仍在拼 `item.ip`（T03 后运行时为 undefined，登录页显示「于 undefined 登录失败」）——切共享类型后该项变 tsc 错误，渲染文案删去 `" 于 " + item.ip` 段，仅保留时间；同批修正 e2e 过期注释：`fixtures/api.ts` 约 180-184 行、`tests/auth.spec.ts` 约 12 行、`tests/api-auth.spec.ts` 约 85-86 与 99 行、`tests/api-change-password.spec.ts` 约 194-195 行的「同一 IP / IP 锁定」表述改为全局锁定语义（保护逻辑本身不动）。

## 上下文
context.md 第 2 节第 5 条；TanStack Query 官方立场（server-state 归 query，剩余 client state 极小）；源码：上述 5 个组件 + `store/user.ts` + `services/group.ts` + `services/auth.ts`（login 成功处理）+ 后端 group service/types。

## 边界
- 允许修改：上述前端文件与后端 group 的 service/types 两文件。
- 禁止触碰：certificate 模块、vault/kek/dek 相关 atom、`services/certificate.ts`。

## 验收
- 双端 `tsc --noEmit` 零错误；`pnpm lint` 零错误。
- `E2E_LOGIN_PASSWORD=admin123 pnpm test:e2e` 全绿（e2e 大量走分组列表/解锁 UI 路径，等于回归）。

## 依赖
T02、T03（后端 group 响应结构与 LockDetail 先定形）；建议在 T05 后（frontend tsc 环境含 shared）
