# T01: device-store 与设备钥匙解析

## 目标
新建 `packages/backend/src/lib/device-store/`（trusted-devices.json 的读写 + 门激活判断）和 `packages/backend/src/lib/device-key/`（`cube-device-key:v1:` 钥匙串的解析与序列化），为 device 模块提供数据层。不涉及任何路由。

## 上下文
context.md 第 2 节（决策 1、2）、3.2（文件格式与 PATH_ROOT 约定）、3.3（钥匙串格式）。
阅读源码：`packages/backend/src/config/path.ts`（PATH_ROOT）、`packages/backend/src/lib/challenge/index.ts`（lib 风格参照）、`packages/backend/src/lib/challenge/index.test.ts`（测试风格）。

## 边界
允许新增：`lib/device-store/`、`lib/device-key/` 及其测试文件。禁止修改现有文件。

## 验收
`pnpm --filter backend test` 通过，覆盖：空文件/不存在文件 → 门未激活；合法文件 → 设备列表与字段完整；钥匙串解析（合法/篡改 version/坏 base64/credentialId 重复入库拒绝）；原子写（temp+rename）后文件可回读。

## 依赖
无
