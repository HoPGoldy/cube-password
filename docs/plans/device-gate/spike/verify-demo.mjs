// 服务端验签示例 —— 演示后端 /device/verify 要做的事，只用 node:crypto，零依赖
//
// 用法（参数来自 demo.html ② 打印的三行）:
//   node verify-demo.mjs <challenge_b64> <signature_b64> <publicKey_spki_b64>
//
// 关键点：WebCrypto 的 ECDSA 签名输出是 raw r||s（IEEE P1363，64 字节），
// 而 OpenSSL/Node 默认吃 DER 格式。Node 官方方案是 dsaEncoding: 'ieee-p1363'，
// 无需手写 ASN.1 转换。

import { createPublicKey, verify } from "node:crypto";
import process from "node:process";

const [, , challengeB64, signatureB64, publicKeyB64] = process.argv;

if (!challengeB64 || !signatureB64 || !publicKeyB64) {
  console.error(
    "用法: node verify-demo.mjs <challenge_b64> <signature_b64> <publicKey_spki_b64>",
  );
  process.exit(1);
}

// 1. 公钥从 SPKI DER 构造（即 trusted-devices.json 里存的 publicKey 字段）
const publicKey = createPublicKey({
  key: Buffer.from(publicKeyB64, "base64"),
  format: "der",
  type: "spki",
});

// 2. 验签：data = challenge 原文，sig = 客户端上送的 raw r||s
const ok = verify(
  "sha256",
  Buffer.from(challengeB64, "base64"),
  { key: publicKey, dsaEncoding: "ieee-p1363" },
  Buffer.from(signatureB64, "base64"),
);

console.log(ok ? "✅ 验签通过：这是绑定过的设备钥匙" : "❌ 验签失败");

// 附：真实 /device/verify 还要做（见 PRD context.md 3.3/3.4）：
//   - challenge 必须是服务端签发的设备挑战码（pop 一次性消费，防重放）
//   - 按 assertion 里的设备 id 查 trusted-devices.json 找对应公钥
//   - 验签通过 → 更新 lastSeenAt → 签发 gate token（10min TTL）
process.exit(ok ? 0 : 1);
