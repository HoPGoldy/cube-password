# T03: 前端登录页去 TOTP、失败记录改展示 IP

## 目标

配合后端改造清理前端：登录页删除动态验证码交互（后端已不会再返回 40103），登录失败记录从展示 `location` 改为展示 `ip`。

## 上下文

- 读 `docs/plans/ip-location-removal/context.md` 第 2、3 节。
- 需要阅读：
  - `packages/frontend/src/pages/login/page.tsx`（`code`/`codeVisible` 状态、40103 分支、动态码输入框 JSX、`renderLoginFailure`）
  - `packages/frontend/src/types/auth.ts`（`LoginFailRecord.location`）
  - `packages/frontend/src/services/auth.ts`（`useLogin` 的入参是否带 `code`）
- 后端契约变化（T01 产出）：登录请求不再有 `code` 参数；不会再返回 40103；`LoginFailRecord` 不再有 `location`。

## 边界

只允许修改 `packages/frontend/` 下的文件：

- `pages/login/page.tsx`：删 `code`/`codeVisible` 状态、`codeInputRef`、40103 处理分支、动态码输入框 JSX、`postLogin` 入参里的 `code`；清理不再使用的 import（如 `KeyOutlined` 若仅用于动态码框）。`renderLoginFailure` 改为展示 `item.ip`（文案如 `"于 " + item.ip + " 登录失败"`）。
- `types/auth.ts`：`LoginFailRecord` 删 `location` 字段。
- `services/auth.ts`：登录 mutation 入参类型删 `code`（如存在）。
- **不要**动 `withTotp`、分组解锁、OTP 配置页、改密页（它们继续依赖 TOTP，正常工作）。

## 验收

```bash
cd cube-password
pnpm --filter frontend build   # tsc && vite build 通过
pnpm lint                      # 无新增 error
grep -rn "40103\|NeedTotpCode" packages/frontend/src          # 应为空
grep -rn "location" packages/frontend/src/types/auth.ts       # 应无 LoginFailRecord.location
```

## 依赖

T01（依赖其产出：后端登录契约变化）。
