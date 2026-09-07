# T06: 文档与版本收尾

## 目标

批次交付的文档层收尾：README 补 nginx 子路径部署配置示例、死依赖/死代码清理、
LICENSE 统一 GPL v3、版本号升 2.1.0。全部改动无逻辑风险。

## 上下文

- context.md 第 2.8 条与第 3 节。
- 死依赖清单（删前必须逐个 grep 全仓库确认零引用，含动态引用）：
  - npm：`ahooks`、`react-sortablejs`（`sortablejs` 本体在用，保留）、`@types/qs`、
    `cross-env`（仅前端 devDeps 中的冗余，后端的保留）；
    `@fortawesome/fontawesome-free` **保留**（icon-picker 在用）。
  - 代码：`frontend/src/hooks/use-jump-to-search.ts`、`frontend/src/utils/path.ts`
    的 `withFrontend`（保留 mergeUrl）、`frontend/src/assets/file/` 下 16 个 svg。
  - `nanoid` 前端 3.x 为刻意 pin，不动。
- nginx 示例要点：`proxy_pass http://127.0.0.1:3499/;` 末尾斜杠吞前缀语义 +
  不带斜杠会 404 的注释说明（用户确认的口径）。
- LICENSE：LICENSE 文件已是 GPL v3；改三个 package.json（root/frontend/backend）的
  license 字段为 GPL-3.0-only。

## 边界

- `README.md`
- `packages/frontend/package.json`、`packages/backend/package.json`、根 `package.json`
- `frontend/src/hooks/use-jump-to-search.ts`（删）、`frontend/src/utils/path.ts`、
  `frontend/src/assets/file/`（删）
- `pnpm-lock.yaml`（随依赖删除自然变更）

## 验收

- 每个删除项的 grep 验证记录在提交说明中（删除前零引用的证据）。
- `pnpm install && pnpm lint && pnpm --filter backend build && pnpm --filter frontend build`
  通过；`pnpm test:e2e` 全绿。
- README 含 nginx location 配置块；`grep '"license"' package.json packages/*/package.json`
  统一为 GPL-3.0-or-later 或 GPL-3.0-only（与 LICENSE 文件一致）。
- `pnpm release` 产出 2.1.0（或手动改 version 字段，以仓库现有 release 流程为准）。

## 依赖

T05（全量验证绿之后做版本收尾）。
