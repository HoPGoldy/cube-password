## cube-password

![](https://img.shields.io/npm/v/cube-password)

一个简单扁平的桌面 / 移动端密码管理器。基于 react / koa2 / sqlite / typescript / antd。

cube-password 使用的安全机制详见 [这里](./SECURE.md)。

<details>
    <summary style="cursor:pointer">查看桌面端截图</summary>
    <a href="https://imgse.com/i/pim69xK"><img src="https://z1.ax1x.com/2023/10/30/pim69xK.png" alt="登录"></a>
    <a href="https://imgse.com/i/pim6Fqe"><img src="https://z1.ax1x.com/2023/10/30/pim6Fqe.png" alt="列表"></a>
    <a href="https://imgse.com/i/pim6AVH"><img src="https://z1.ax1x.com/2023/10/30/pim6AVH.png" alt="详情"></a>
    <a href="https://imgse.com/i/pim6p26"><img src="https://z1.ax1x.com/2023/10/30/pim6p26.png" alt="编辑"></a>
</details>

<details>
    <summary style="cursor:pointer">查看移动端截图</summary>
    <div style="display: flex; align-items: center;">
        <a href="https://imgse.com/i/pim6PKO"><img src="https://z1.ax1x.com/2023/10/30/pim6PKO.png" alt="移动端登录"></a>
        <a href="https://imgse.com/i/pim6irD"><img src="https://z1.ax1x.com/2023/10/30/pim6irD.png" alt="移动端列表"></a>
        <a href="https://imgse.com/i/pim6S8x"><img src="https://z1.ax1x.com/2023/10/30/pim6S8x.png" alt="移动端设置"></a>
        <a href="https://imgse.com/i/pimyzP1"><img src="https://z1.ax1x.com/2023/10/30/pimyzP1.png" alt="移动端搜索"></a>
    </div>
</details>

## 特性

- 🚫 无广告、无收费、完全开源，自己的数据自己掌握
- 🚀 极其简单的部署，仅需两行命令
- 🔀 自动生成随机用户名、自定义强密码
- 🔒 凭证内容加密存放、支持搜索、排序、颜色标记功能
- 🗂 支持额外加密的分组
- 🏹 安全模块：内置一组安全策略，会分析请求，并在发现异常时进行提醒
- 🛒 内置 TOTP 二次认证，支持 google 身份认证器等令牌工具
- 🌙 黑夜模式

## 部署

### 1. docker 安装（推荐）

cube-password 不需要 docker compose，单容器即可运行：

```bash
docker run -d -p 3701:3700 -v ~/cube-password-storage:/app hopgoldy/cube-password:1.0.0
```

执行后数据将会存放在 `~/cube-password-storage` 目录。

### 2. npm 安装

cube-password 在开发时就以简单部署为目标，不需要配置数据库，不需要安装任何软件。仅需 node（*16+*）环境即可运行。

```bash
# 安装项目
# linux 下安装失败时请尝试 sudo 并在安装命令后追加 --unsafe-perm=true --allow-root 参数
npm install -g cube-password

# 启动项目
cube-password run
```

项目启动后将会在当前目录下生成 `config.json`，可以通过修改该文件来对应用进行简单的自定义。

服务将默认开启在端口 3700 上，可以通过 `cube-password run --port=3701` 修改端口。

*使用 `-h` 参数查看更多配置*

## 数据迁移

所有数据均默认保存在应用目录下的 `.storage` 文件夹里，所以直接将其打包然后复制到其他地方即可。

## 许可

本项目源码基于 GPL v3 许可开源，[点此](https://github.com/HoPGoldy/cube-password/blob/master/LICENSE) 查看更多信息。