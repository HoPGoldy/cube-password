# Gate Token 即取即用（ephemeral gate token）

## 1. 背景与目标

device-gate 批次（v2.3）落地后，gate token 采用「页面级缓存」：登录页静默过门后将 token
存入前端模块级变量（10 分钟 TTL），后续走廊请求由 axios 拦截器自动附带。该设计为处理
「token 过期后的 403」引入了自愈 reload 逻辑（base.ts 拦截器三态分支），是 device-gate
批次中打磨轮次最多、复杂度最高的部分；且存在「吊销设备后已签发 token 仍有效 10 分钟」
的纵深缺口（ship review optional 之外的已知弱点）。

用户决策（讨论定案）：**取消页面级 token 缓存，改为每次需要时现取现用**——

- 登录页 bootstrap（需要调 auth/global）时走完整遍：device/challenge → 签名 →
  device/verify → 临时 token → auth/global → 弃 token
- 用户点「登 录」时再走一遍：…… → 临时 token → auth/challenge → auth/login → 弃 token
- token 只作为单次流程的函数局部变量存在，**永不跨请求/跨页面持久**

带来的收益：
- 「停留超时后 403」问题从根上消失（每次现取，没有过期概念）
- 吊销立即生效（每次登录重新验签），消除 10 分钟残留窗口
- 删除拦截器的门页 reload/自愈分支与其循环防御逻辑，复杂度净减
- 前端不再常驻任何门禁凭证于内存

**非目标**：
- 不改后端门禁 hook 语义（gate 仍守 disableAuth 路由，X-Gate-Token 仍必填）
- 不改 verify/challenge 接口契约与遍历验签逻辑
- 不改未授权页/纯密码模式行为
- GateTokenManager 服务端实现保留（内存 Map + TTL），仅将 TTL 调为 3 分钟作防御性
  上限（正常流程秒级用完，TTL 只是兜底）

## 2. 方案概要（已敲定决策）

1. **passGate 返回 token，不再写模块级变量**（D-passgate）：`services/device-gate.ts`
   删除 gateTokenState 模块状态与 setGateToken/getValidGateToken；passGate 照旧返回
   `{ gateToken }`，调用方自行使用。新增显式 `withGateToken<T>(fn)` 辅助：跑一遍过门
   → 把 token 作为参数传给 fn → 返回 fn 结果（token 随调用栈消亡）。
2. **走廊请求显式携带**（D-corridor）：删除 base.ts 请求拦截器的 GATE_CORRIDOR_URLS
   自动附带逻辑；auth/global、auth/challenge、auth/login、auth/init 的调用点改为
   接受可选 `gateToken` 参数（axios config header）——由调用方（登录流程）显式传入。
   拦截器不再拥有任何门禁知识。
3. **登录页两遍流程**（D-loginflow）：
   - bootstrap：probeGate → 门开则 passGate → 拿临时 token → queryGlobal(token) → 弃
   - 提交：passGate（新挑战码新签名）→ 拿临时 token → queryChallenge(token) →
     argon2id 派生 → postLogin(token, hash) → 弃
   - 注意点登录时的 passGate 失败（如停留期间钥匙被吊销）→ 渲染未授权页（复用现有
     toGateDenial 链路），密码不发送
4. **init 页同构**（D-init）：init 提交（auth/init）同样先 passGate 再携带临时 token。
5. **响应拦截器简化**（D-interceptor）：删除 40301 的 reload 自愈与门页判定分支；
   保留两条：非门页收到 40301 → 跳登录页（会话中途激活门的兜底）；门页收到 40301 →
   透传给页面流程（现在每次流程都自持 token，40301 只可能意味着钥匙被拒/门态变化，
   由未授权页承接）。401 分支的 clearGateToken 删除（token 不再常驻）。
6. **服务端 TTL 收紧**（D-ttl）：GATE_TOKEN_TTL_MS 10min → 3min；同步前端注释。
   单测断言同步调整。

## 3. 公共上下文

### 现状关键文件（改造前必读）

| 关注点 | 文件 |
| --- | --- |
| 模块级 token 状态（要删） | `frontend/src/services/device-gate.ts`（gateTokenState/setGateToken/getValidGateToken/GATE_TOKEN_TTL_MS 客户端副本） |
| 拦截器附带与 40301 分支（要简化） | `frontend/src/services/base.ts` |
| 登录页 bootstrap/提交流程 | `frontend/src/pages/login/index.tsx`、`pages/login/page.tsx`（onPasswordSubmit） |
| init 提交流程 | `frontend/src/pages/init/index.tsx` |
| auth services 签名 | `frontend/src/services/auth.ts`（queryGlobal/queryChallenge/useLogin/useInit 四处需接受 gateToken 参数） |
| 服务端 TTL | `backend/src/lib/gate-token/index.ts` + `index.test.ts` |
| use-login-success 的 clearGateToken | `frontend/src/pages/login/use-login-success.ts`（删除该调用） |

### 已知的坑

- `page.tsx` 的 onPasswordSubmit 内部有 `queryChallenge → postLogin` 两步与密钥派生交
  织（KEK fill(0) 时序敏感）——插入 passGate 步骤时不得破坏现有 finally/清零路径。
- e2e `device-gate.spec.ts` 的用例③（静默过门）与④（无钥匙 403）建立在「页面加载即
  过门」语义上：bootstrap 流程仍保持「门开则过门后才调 auth/global」，行为不变；
  用例⑥⑦（防循环）在新设计下天然满足（无 reload 可言），断言应继续绿。
- e2e fixtures 的 `browserSilentPassGate` 直接调 verify API 拿 token（不经前端模块），
  不受本次改动影响。
- `services/auth.ts` 的 useLogin/useInit 是 react-query mutation，加参数走 mutateAsync
  的入参对象扩展（`{ hash, gateToken? }`），保持向后兼容（gateToken 可选）。
- CI 中 e2e 探针（playwright webServer）打 /docs，与本改动无关。

## 4. 端到端验收

一段话：门激活时，登录页加载静默过门正常显示；输入密码点登录，Network 面板可见
device/verify → auth/challenge → auth/login 的顺序（每次登录一组），token 不在任何
模块状态中残留（代码审查确认）；停留任意时长后点登录不再出现 403/reload；吊销钥匙
后点登录渲染未授权页且密码请求未发出；门未激活全部行为与现状一致；backend/frontend/
e2e 全量绿。

验证命令：

```sh
pnpm --filter backend test && pnpm --filter frontend test
pnpm lint
E2E_BACKEND_PORT=13499 E2E_FRONTEND_PORT=13500 pnpm test:e2e
```
