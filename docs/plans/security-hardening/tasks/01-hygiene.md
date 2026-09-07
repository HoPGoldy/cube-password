# T01: 代码卫生包

## 目标

补齐密钥覆写、常数时间比较、缓存清理、Modal 销毁四类纯代码级卫生问题，无任何行为
变化。为什么：失败分支的 KEK 残留堆内存扩大本机攻击面；react-query 残留旧密文缓存
导致换号后报"解密失败"；Modal 残留明文表单值。

## 上下文

- context.md 第 2.5 条与第 3 节"关键文件"。
- 必读源码：`frontend/src/pages/login/page.tsx`（成功路径 fill(0) 的现有写法是范本）、
  `pages/change-password/content.tsx`、`pages/otp-config/content.tsx`、
  `backend/src/lib/crypto/index.ts`、`backend/src/modules/{auth,otp,group}/service.ts`、
  `frontend/src/store/user.ts`、`frontend/src/pages/certificate-list/components/certificate-detail.tsx`。

## 边界

- `frontend/src/pages/{login,change-password,otp-config}/**`
- `frontend/src/store/user.ts`、`frontend/src/services/base.ts`（仅 queryClient 清理）
- `frontend/src/pages/certificate-list/components/certificate-detail.tsx`（仅 Modal 属性）
- `backend/src/lib/crypto/index.ts` + auth/otp/group service 中 4 处比对行

## 验收

- 所有失败/异常 return 路径上已派生的 kek/verifier 均 `fill(0)`（逐处核对，含
  queryChallenge 失败、postLogin 失败、unwrapDek 抛错三分支；change-password 的
  newKek/newVerifier 失败路径与成功路径）。
- timingSafeEqual 封装含"长度不等时先走虚拟比较再返回 false"处理，4 处调用替换完成。
- logout() 调用 queryClient.clear()。
- `pnpm --filter backend test && pnpm --filter frontend test` 全绿；
  `grep -n "fill(0)" frontend/src/pages/**/*.tsx` 覆写点数量 ≥ 现有成功路径的对称实现。

## 依赖

无。
