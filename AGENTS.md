# AGENTS.md

## Glossary

### 挑战码 (Challenge)

全局唯一的登录挑战码，服务端生成、服务端 pop 消费，客户端不回传。存于 `lib/challenge`。5 分钟 TTL，全局单槽位：生成即覆盖旧码。一次性消费，被任何请求 pop 或过期后即失效。pop 失败 → 静默 401（无通知、不记失败数）；密码错误才触发通知与全局锁定。

### 登录锁 (LoginLocker)

全局失败计数（无 IP 维度），3 次/天锁死一切登录尝试（`lib/login-locker`）。锁定本身即「服务地址泄露」的告知信号（见 Principle 第三条）。

## Principle

- 本项目仅为单人服务设计
- 部署者应通过 nginx 反代隐藏当前服务
- “login 失败时全局锁定”是有意为之，目的是告诉用户当前服务地址已泄露
- 接口采用全 POST method
