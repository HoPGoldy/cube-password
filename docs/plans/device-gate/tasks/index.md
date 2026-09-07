# Tasks

| 编号 | 名称                               | 依赖 | 验证方式                                       |
| ---- | ---------------------------------- | ---- | ---------------------------------------------- |
| 01   | device-store 与设备钥匙解析        | -    | `pnpm --filter backend test`                   |
| 02   | device 模块接口 + 门禁 preHandler  | 01   | `pnpm --filter backend test`（含 http 注入测试） |
| 03   | 前端：钥匙生成/录入与管理页        | 02   | 手动 dev 验证 + `pnpm -w lint`                 |
| 04   | 登录页门禁流程改造                 | 02,03 | e2e auth 旧用例全绿（门未激活路径）            |
| 05   | e2e：WebCrypto 钥匙全链路              | 03,04 | `pnpm -w test:e2e`（device-gate.spec.ts）      |
