# T04: rand-name 前端化 + 前端/e2e 接口适配收口

## 目标

随机用户名生成改为纯前端实现（后端删除该接口），同时完成 T02 全 POST 改动的前端与
e2e 适配，让整个仓库回到"全部验证绿"的收口状态。为什么：现接口存在响应双重包装 bug
（前端拿到对象而非字符串，功能已坏），且名字组合不值得一次网络往返。

## 上下文

- context.md 第 2.4、2.6 条与"已知的坑"第 2 条。
- 必读源码：`backend/src/modules/certificate/controller.ts:19-148`（FIRST_NAMES/
  LAST_NAMES 常量与路由，整体删除）、`frontend/src/services/certificate.ts:13-15`
  （getRandName 删除）、`frontend/src/pages/certificate-list/components/certificate-field-item.tsx:67-75`
  （onCreateUsername 改本地生成）、`frontend/src/services/{auth,app-config}.ts` 与
  `e2e/fixtures/api.ts`（GET→POST 适配点）。

## 边界

- `backend/src/modules/certificate/controller.ts`（仅删 rand-name 部分）
- `frontend/src/services/certificate.ts`、`pages/certificate-list/components/certificate-field-item.tsx`
- 名字常量数组搬到 `frontend/src/utils/`（新文件，如 `rand-name.ts`，含导出函数）
- `frontend/src/services/{auth,app-config}.ts`、`packages/e2e/fixtures/api.ts`

## 验收

- DevTools Network：点击随机用户名按钮零网络请求，表单填入 "FirstLast" 形态字符串
  并复制成功（不再是 [object Object]）。
- `grep -rn "rand-name" backend/src frontend/src packages/e2e` 零命中。
- GET→POST 适配后 `pnpm test:e2e` 全绿。

## 依赖

T02（后端路由已改 POST，本任务做前端/e2e 侧适配与全量收口）。
