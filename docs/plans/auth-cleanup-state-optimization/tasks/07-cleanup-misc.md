# T07: 遗留清理与杂项打包

## 目标
context.md 第 2 节第 7 条的全部杂项，逐项清单：

**后端**：① 删 `@fastify/multipart`（register-plugin.ts 与 package.json）；② 删 `config/path.ts` 的 `PATH_USER_FILE`/`PATH_USER_FILE_THUMB`；③ `certificate/controller.ts` 的 `rand-name` 接口换内置词表实现（两组常见英文名各 ~50 个，随机 first+last 拼接，保持响应结构 `{ data: string }` 与复数种子随机性），删 `mockjs` + `@types/mockjs` 依赖；④ 删 `dotenv` 依赖（`config/env.ts` 只留 dotenv-flow）；⑤ 删 `lib/frontend-history/index.ts` 的 `console.log`；⑥ 删 `modules/app-config/controller.ts` 两处 `config: { requireAdmin: true }`（全项目无 hook 消费，无效配置）；⑦ 删 `modules/auth/error.ts` 的 `ErrorBanned` 及 `modules/auth/service.ts` 对它的 import；⑧ `certificate/service.ts` 与 `group/service.ts` 的 `sort` 用 `prisma.$transaction` 包裹（参考 app-config service 的用法）。

**前端**：⑨ `services/base.ts` 删 `requestDelete`；⑩ axios 拦截器 403 跳转改为 `window.location.href = mergeUrl(APP_CONFIG.PATH_BASENAME, "e403")`（复用 `utils/path.ts` 的 mergeUrl）；⑪ `store/lcoal.ts` 改名 `store/local.ts`（更新 import）。

**根**：⑫ `README.md` 重写为 cube-password 内容（简介：单人自托管密码管理器、E2EE 架构一句话、特性列表按实际功能、docker run 示例仿照现有结构含 `FRONTEND_BASE_URL`、init/dev/start 命令、storage 迁移说明、GPL v3 与 LICENSE 链接——LICENSE 文件是 GPL v3，保持一致）；⑬ `packages/frontend/index.html` 的 `<title>cube-diary</title>` 改 `Cube Password`。

## 上下文
context.md 第 2 节第 7 条；源码即上述清单对应文件。README 现状整篇是 cube-diary 内容，重写时功能描述以代码为准（凭证分组/密码锁/TOTP/搜索/随机用户名与密码生成）。

## 边界
- 允许修改：清单 13 项涉及文件 + 双端 package.json + `packages/frontend/src/store/`（改名）+ 根 README.md。
- 禁止触碰：清单之外的一切（尤其 challenge/locker/group/certificate 的行为逻辑——sort 的事务包裹不改变排序结果语义）。

## 验收
- `pnpm install` 后 `pnpm lint` 零错误；双端 `tsc --noEmit` 零错误。
- `pnpm --filter backend build`、`pnpm --filter frontend build` 成功。
- `grep -rn "mockjs\|multipart\|ErrorBanned\|requireAdmin\|requestDelete\|lcoal\|cube-diary" packages/backend/src packages/frontend/src packages/backend/package.json packages/frontend/package.json README.md packages/frontend/index.html` 无残留（README 中合理提及除外，如"从 cube-diary 分叉"说明——不需要就不写）。

## 依赖
T01-T06 全部完成后执行（纯删除与改名，放最后避免与功能改动交叠冲突）
