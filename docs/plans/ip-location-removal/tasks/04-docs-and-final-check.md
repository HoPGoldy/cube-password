# T04: 回写决策文档 + 全仓残留检查

## 目标

`docs/ip-location-removal.md` 记录的是旧决策（方案 A，IP 直比保留检测），与最终实现（方案 B+）不符。将其回写为最终决策，并做全仓残留检查收尾。

## 上下文

- 读 `docs/plans/ip-location-removal/context.md` 全文。
- 读现有 `docs/ip-location-removal.md`。
- 最终决策要点（必须体现在文档中）：
  1. 异地登录检测**整个移除**（非方案 A 的 IP 直比）；
  2. 登录 TOTP 随检测移除；TOTP 保留于分组解锁与改密；
  3. `commonLocation` 列删除（migration）；
  4. `LoginFailRecord.location` 删除，前端展示 `ip`；
  5. 登录成功无通知；失败/非法登录通知保留且只含 IP；
  6. 设计原则：安全审计只记录原始事实（IP），不做不可靠的派生转译。

## 边界

只允许修改 `docs/ip-location-removal.md`（重写）。不改任何代码。

## 验收

```bash
cd cube-password
# 代码面无残留（prisma/client 生成物与 docs/ 除外）
grep -rn "ip2region\|ip-location\|commonLocation\|isSameLocation\|formatLocation\|NeedTotpCode\|40103" \
  packages/backend/src packages/frontend/src Dockerfile packages/backend/prisma/schema.prisma   # 应为空
pnpm --filter backend exec vitest run && pnpm --filter backend build && pnpm --filter frontend build
```

文档内容经主 Agent 评审确认与最终决策一致。

## 依赖

T01、T02、T03（文档需反映全部最终改动）。
