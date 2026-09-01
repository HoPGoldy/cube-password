# T04: v1→v2 迁移脚本

## 目标

交付一次性迁移脚本 `scripts/migrate-v1-to-v2.mjs`，行为严格按实施方案第 8.2 节：自动备份 → 交互校验旧主密码 → v1 逻辑解密（脏数据警告跳过）→ argon2id 派生 (KEK,V) + 生成 DEK/keyBlob → 全部凭证重加密 v2 → 单事务写回 → 打印迁移报告。写出的 v2 密文必须与前端 e2ee 模块格式完全一致（可复用其实现，`hash-wasm` 在 Node 可直接运行；如需 tsx 等运行器可加为 root devDependency）。

## 上下文

- 实施方案第 4、8 节（v1/v2 结构差异表、脚本六步行为）。
- T01 的 e2ee 实现；T02 的 schema。
- v1 解密逻辑参考改造前的 `getAesMeta`/`aesDecrypt`（MD5/SHA256 派生 + AES-128-CBC + PKCS7，hex 密文）——可从 git 历史或实施方案背景节获取，crypto-js 仅作脚本临时依赖（root package.json，不进任何 package）。

## 边界

- 新建 `scripts/migrate-v1-to-v2.mjs`（及必要的根 package.json devDependency）。
- 不得改动 packages/** 内的业务代码。

## 验收

- 构造一个含脏数据（无法解密的 content）的 v1 sqlite 库，跑脚本：生成 `.v1.bak`、脏条目被警告跳过、其余条目迁移成功；
- 用 T01 的 e2ee 模块 + 迁移时输入的主密码派生 KEK，能解开库里的 keyBlob 和每条 v2 凭证；
- 报告中成功/跳过条数正确。

## 依赖

T01（e2ee 格式与实现）、T02（v2 schema 字段）。
