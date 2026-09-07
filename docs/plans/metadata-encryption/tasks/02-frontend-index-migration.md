# T02: 前端索引、本地搜索与存量迁移

## 目标

前端构建登录后的内存明文名称索引，搜索/列表改读索引，并提供一次性存量迁移流程
（明文 name → nameEnc）。完成后整个元数据加密方案端到端闭环。

## 上下文

- context.md 第 2.3、2.4、5 条与"已知的坑"全部条目。
- 必读源码：`frontend/src/store/user.ts`（stateVault/DEK 生命周期、logout 清理是
  索引生命周期的范本）、`frontend/src/lib/e2ee/index.ts`（encryptContent/
  decryptContent）、`frontend/src/pages/search/index.tsx`（现搜索页，重写数据源）、
  `frontend/src/pages/certificate-list/**`（名称渲染点）、
  `frontend/src/services/certificate.ts`（现有 query key 结构）。

## 边界

- `frontend/src/store/`（新索引 atom）、`frontend/src/services/certificate.ts`、
  `frontend/src/services/user.ts`（如需）
- `frontend/src/pages/search/index.tsx`、`frontend/src/pages/certificate-list/**`
- `frontend/src/pages/` 下新增迁移提示组件（交互复用 v1→v2 迁移的提示模式）
- `packages/e2e/**`（断言适配，见 context.md"已知的坑"第 1 条）

## 验收

- 手动全流程：旧库登录 → 迁移提示 → 迁移完成 → 搜索/列表/详情/新建/改名全部正常，
  Network 面板无 certificate/search 请求。
- 迁移中断重试：手动中断（刷新）后重登，提示继续迁移且进度正确（幂等验证）。
- 单条密文损坏场景：该条名称显示占位符，其余条目与搜索不受影响。
- `pnpm --filter frontend test` 全绿（索引构建/过滤逻辑补单测）；
  `pnpm test:e2e` 全绿。

## 依赖

T01（接口与 schema 就绪）。
