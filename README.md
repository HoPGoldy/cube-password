## keep-my-password

一个简单扁平的桌面 / 移动端密码管理器。基于 react / koa2 / typescript / vant。

## 特性

- 🚫 无广告、无收费、不托管，自己的数据自己掌握
- 🔀 自动生成随机用户名、强密码
- 🔒 凭证数据加密存放
- 🗂 分组管理 / 分组加密
- 📝 操作记录：记录每一次请求、登录、凭证查看操作
- 🏹 安全模块：内置一组安全策略，会分析请求，并在发现异常时进行提醒
- 🛒 内置 TOTP 二次认证，支持 google 身份认证器等令牌工具
- 🌙 黑夜模式

## 部署

*请确保已安装了 node 16+*

```bash
# 安装依赖
yarn install
# 打包项目
yarn build
# 启动项目
yarn start
```

服务将默认开启在端口 3700 上，可以通过 `yarn start --port=3701` 修改端口。

## 数据迁移

所有数据均保存在应用目录下的 `.storage` 文件夹里，所以直接将其打包然后复制到其他地方即可。

## 贡献

本项目系本人自用开发，如果你觉得有些功能不够完善，欢迎 PR / issue。

## 许可

本项目源码基于 GPL v3 许可开源，[点此](https://github.com/HoPGoldy/keep-my-password/blob/master/LICENSE) 查看更多信息。