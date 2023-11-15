# 安全机制介绍

cube-password 采用了一系列安全机制保证数据在网络传输、存储中的私密性。

## 1. https 相关

首先，**强烈建议使用 HTTPS 进行公网访问**。cube-password 采用了一些策略来保证 HTTP 传输时数据也是加密的，但是依旧强烈建议采用前置 nginx 的方式进行 HTTPS 转发来防止诸如 js 注入的问题出现。

下面是一个可用的 nginx https 配置，可以参考注释修改你的相关信息：

```nginx.conf
http {
    client_max_body_size 20m;
    server {
        listen 443;
        server_name xxx.com; # 你的域名
        ssl on;
        ssl_certificate   cert/xxx.com_bundle.pem; # https 证书
        ssl_certificate_key  cert/xxx.com.key; # https 密钥
        ssl_session_timeout 5m;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
        ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
        ssl_prefer_server_ciphers on;

        location /your-cube-password-url/ { # 你的 cube-password 访问路径
            proxy_pass http://127.0.0.1:3700/; # 应用部署到的本地端口
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    server {
        listen 80;
        server_name xxx.com; # 你的域名
        rewrite ^(.*)$ https://$host$1 permanent;
    }
}
```

## 2. 主密码

第一次访问 cube-password 时会要求创建主密码。

密码数据会使用主密码进行 AES 加密（以主密码的 md5 为 key，主密码的 sha256 为 iv）后保存至数据库，主密码本身则加盐（128 位 nanoid）并使用 sha512 哈希后保存至数据库。

**所以主密码一旦忘记将完全无法找回，请妥善保存主密码**。

## 3. 用户 & 登录

cube-password 采用单用户设计，每个 cube-password 实例只服务一个用户。

密码输入错误后将允许重试两次，重试次数用完后应用将会锁定二十四小时。且失败记录会直接显示在登录页上且不可清除，直到成功登录。

重启服务实例可以重置重试次数。

每次登录前会先请求一个有效期 10 秒的随机挑战码，挑战码全局唯一，生成新的挑战码会导致旧挑战码作废。

用户输入的主密码会使用盐值、挑战码进行 sha512 后再发送至后端进行认证。

## 4. 会话有效期

登录成功之后有效期为半个小时，关闭浏览器标签后再次打开需要重新输入密码。且重新登录后会导致旧 token 立刻失效。

cube-password 不会在任何地方存储主密码明文和 session token。你可以使用浏览器的隐私模式访问应用来提高安全性。

登录成功之后会生成随机的防重放攻击密钥，且后续所有请求都会使用该密钥进行防重放攻击验证（随机数 + 时间戳）。

## 5. 数据加解密

数据的加解密工作由纯前端完成，数据在数据库、后端和网络传输中均处于加密状态。

登录成功之后前端将会根据主密码生成解密用的 key 和 iv 并保存在内存中。用户在查看某个密码时会请求到对应的加密数据、进行解密后展示在页面上。

## 6. totp 二次认证

cube-password 支持如 google 身份认证器（免费、无需登录、纯离线手机 app）之类的 totp 令牌应用，在登录之后可以在设置里打开。

开启后将会在应用异地登录、修改主密码、分组加密时要求输入验证码，强烈推荐使用。

## 7. 分组加密

cube-password 支持分组加密，每个分组可以设置不同的密码，在开启 totp 认证后可以直接使用 totp 验证码进行分组解密。

分组被加密后，其中包含的密码将无法被搜索到，可以解密后再次尝试搜索。

## 8. 主密码修改

由于数据都使用主密码进行 aes 加密，所以修改主密码后需要对所有数据进行重新加解密。

加解密的具体操作由后端执行，前端会把新老主密码进行一次单独 aes 加密后发送给后端，密钥为：sha(旧主密码 + 盐) + 挑战码 + sessionToken + totpToken。

## 9. 安全日志

cube-password 会对所有请求进行安全性审查，当出现密码出错，请求逻辑异常（未申请挑战码、未通过防重放校验校验等），异地登陆之类的非正常情况时，会记录下来。可以在登录系统后访问 “安全日志” 查看。