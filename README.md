# Cube Password

![Docker Image Version](https://img.shields.io/docker/v/hopgoldy/cube-password)

Cube Password 是一款面向单人使用的自托管密码管理器。基于 react / fastify / sqlite / typescript 开发，采用端到端加密（E2EE）架构：主密码仅在浏览器内通过 argon2id 派生出加密密钥，服务端只保存验证器与密文，数据库即使泄露也无法还原你的密码。

## 特性

- 🔐 端到端加密：主密码不出浏览器，凭据敏感字段密文落库
- 🗂️ 凭证分组管理，支持为分组单独设置密码锁或 TOTP 锁
- 🔢 支持绑定 TOTP 动态口令作为登录第二因素
- 🎲 内置密码生成器（强随机密码）与随机用户名生成
- 💪 基于 zxcvbn 的密码强度检测
- 🔍 凭证关键字搜索
- 📋 安全日志，记录登录等安全事件
- 📱 桌面端 / 移动端响应式设计，支持暗色主题
- 🚫 无广告、无收费、完全开源，自己的数据自己掌握

## docker 部署

- `-p 3499:3499`：服务端口，容器内监听 `3499`。
- `-v cube-password-storage:/app/packages/backend/storage`：数据持久化目录。
- `FRONTEND_BASE_URL` 参数用于指定应用部署到的路径，例如想要部署到 `https://your-domain/cube-password/`，那么该参数就需要配置为 `/cube-password/`。

```
docker run -d \
  --restart=always \
  -p 3499:3499 \
  -v cube-password-storage:/app/packages/backend/storage \
  -e FRONTEND_BASE_URL=/ \
  hopgoldy/cube-password:latest
```

首次启动后访问应用，按引导设置主密码完成初始化。

### nginx 子路径部署

前端 API 请求为相对路径，依赖反向代理「吞掉子路径前缀」的语义：`proxy_pass` 末尾**带斜杠**时，nginx 会去掉 `location` 匹配的前缀再转发；不带斜杠则原样转发，后端会收到 `/cube-password/api/*` 导致 404。

```nginx
# 子路径部署：注意 proxy_pass 末尾的斜杠（吞掉 /cube-password/ 前缀）
location /cube-password/ {
    proxy_pass http://127.0.0.1:3499/;
}
```

根路径部署则无需关心斜杠：

```nginx
location / {
    proxy_pass http://127.0.0.1:3499;
}
```

若通过 https 对外提供服务，建议在 nginx 侧追加 HSTS 头承担协议升级（应用自身不下发 UIR/HSTS，以兼容 http 直连部署）：

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 本地开发

1、安装依赖：

```sh
pnpm install
```

2、初始化后端开发数据库：

```sh
pnpm init:dev
```

3、启动开发服务（同时启动前后端）：

```sh
pnpm dev
```

然后访问前端服务的地址即可（默认 `http://localhost:3500`，后端默认监听 `3499`）。

## 本地配置

如果需要自定义本地环境变量配置的话，可以进入 `packages/backend`，参考 `.env.example` 创建 `.env` 文件并按需修改（可用变量：`NODE_ENV`、`FRONTEND_BASE_URL`、`BACKEND_PORT`）。

## 数据迁移

所有数据均默认保存在应用目录下的 `packages/backend/storage` 文件夹里，所以直接将其打包然后复制到其他地方即可。

## 许可

本项目源码基于 [GPL v3](./LICENSE) 许可开源。
