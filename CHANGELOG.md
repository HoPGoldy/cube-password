# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [2.0.0-rc.1](https://github.com/HoPGoldy/cube-password/compare/1.0.5...2.0.0-rc.1) (2026-03-26)


### Features

* add color filter to search page ([52f85a3](https://github.com/HoPGoldy/cube-password/commit/52f85a3e972ec92ac745ddea726121da04811629))
* add encryption method option to add-group modal ([26f434e](https://github.com/HoPGoldy/cube-password/commit/26f434ea301a83324a365964937dfc8d746d9167))
* add group config and move certificate to list header ([4bb9ff6](https://github.com/HoPGoldy/cube-password/commit/4bb9ff65ba16ac6aae96c5e3f13c6dc511d2df56))
* add icon/color picker and help tips to certificate detail ([4ac0c15](https://github.com/HoPGoldy/cube-password/commit/4ac0c15e75da948c7ef7a26e603485d8bb536faf))
* add Phase 3 infrastructure (session, challenge, login-locker, crypto, ip-location) ([1bdde12](https://github.com/HoPGoldy/cube-password/commit/1bdde122eec7f1fbe8bc036de4526bb3a1b2362b))
* add TOTP option to group config lock type ([b06ceeb](https://github.com/HoPGoldy/cube-password/commit/b06ceeb5f5ac1537363e73310ff01ea78ea4bb8b))
* add User, Group, Certificate, Notification Prisma models ([a256811](https://github.com/HoPGoldy/cube-password/commit/a2568119a7f6881532f86854b8609b3fb75a9b8f))
* implement all backend modules (auth, notification, user, group, certificate, otp) ([5655722](https://github.com/HoPGoldy/cube-password/commit/56557222bfde2e0480c331b956eb0eb5eb96d520))
* implement certificate list page with group sidebar (T-022) ([9504ba4](https://github.com/HoPGoldy/cube-password/commit/9504ba492a55f55d4f3c2cf0a9a2afa9263c3476))
* implement change password page (T-025) ([65458e2](https://github.com/HoPGoldy/cube-password/commit/65458e2b77fac2cf6fae022149baae8560adea12))
* implement frontend infrastructure (crypto, auth store, interceptor, API services) ([471d58b](https://github.com/HoPGoldy/cube-password/commit/471d58bee095601a7537a8a1deaf51b20f56aeb0))
* implement OTP config page (T-026) ([5405d09](https://github.com/HoPGoldy/cube-password/commit/5405d093196f460be54b55a892c979a6dddacf00))
* implement search page (T-023) ([b96ccc5](https://github.com/HoPGoldy/cube-password/commit/b96ccc5606c74f1c84fd6785e05b2e15141107bc))
* implement security log and about pages (T-027) ([d260183](https://github.com/HoPGoldy/cube-password/commit/d260183038520b5d5c398a029b456527bdb44379))
* implement settings page (T-024) ([91b3e59](https://github.com/HoPGoldy/cube-password/commit/91b3e59e717d1f87f0143e14ea72ff88e46baf3d))
* responsive card grid and drag sort for certificate list ([b66e33d](https://github.com/HoPGoldy/cube-password/commit/b66e33d73f9966dedda12a897f0602d7b6193d6b))
* restore drag-to-reorder for certificate detail fields ([9e8fe11](https://github.com/HoPGoldy/cube-password/commit/9e8fe11255afd86dbafa16af99927738f6a47723))
* rewrite login page and add init page (T-021) ([a94bcd6](https://github.com/HoPGoldy/cube-password/commit/a94bcd6d4963448336b3e0e8eba488318758f2bb))
* run Prisma migration for password manager models ([15a9746](https://github.com/HoPGoldy/cube-password/commit/15a9746d434bfcf6b862e1b2c369bc7ed67367c9))
* update E2E tests for session-based auth (T-028, T-029, T-030) ([a278968](https://github.com/HoPGoldy/cube-password/commit/a2789688bb93d4f54f3bb484be6b7ffed625a7ae))
* 移植旧项目登录失败内联展示功能 ([a39b177](https://github.com/HoPGoldy/cube-password/commit/a39b1772226e10674b69efa4a277422a59780f7f))


### Bug Fixes

* add fontawesome CSS for certificate icon display ([86eb8ea](https://github.com/HoPGoldy/cube-password/commit/86eb8ea708e05c3c11dd04951217f51ac5b0cca8))
* align auth routes for challenge and global endpoints ([0269cab](https://github.com/HoPGoldy/cube-password/commit/0269cab3c3a84ab1104219e1c0295c5b6155b3dd))
* change-password stores wrong format, re-encrypt certificates on password change ([4176f8c](https://github.com/HoPGoldy/cube-password/commit/4176f8c80f10089678dd4c7abcb521a5bd44ba64))
* improve certificate selection highlight and checkbox alignment ([711d831](https://github.com/HoPGoldy/cube-password/commit/711d831c78bc1ed6c0e33b09ef429f66a4daf225))
* otp qrcode data too long error ([fc2607d](https://github.com/HoPGoldy/cube-password/commit/fc2607d050a9c542fdb39d481fb9ffaeb4e5bd8a))
* refresh group list after adding new group ([62145d7](https://github.com/HoPGoldy/cube-password/commit/62145d7146178c5f2f6044ac8eb3743a27484da6))
* resolve build errors and E2E test mismatches ([d3023da](https://github.com/HoPGoldy/cube-password/commit/d3023da79fa50e7d95216e718a99b9070941803c))
* restore UI styles to match old project ([5a1a0e1](https://github.com/HoPGoldy/cube-password/commit/5a1a0e19eafce8b3c52e1d667933cccf2b9d0534))
* store password as salted SHA512 hash instead of plaintext ([8b5e0b4](https://github.com/HoPGoldy/cube-password/commit/8b5e0b47155541dd3f9e303d008f193ccadebb8b))
* use default import for mockjs ([8cc93bf](https://github.com/HoPGoldy/cube-password/commit/8cc93bfb95f696cf0b17974a25f3fcba6c90c8cf))
* use real AES-encrypted content in E2E certificate tests ([82863f8](https://github.com/HoPGoldy/cube-password/commit/82863f829537e30b69bc778d038777b136207732))
* widen init page text area ([0ed15b9](https://github.com/HoPGoldy/cube-password/commit/0ed15b9c364657dba33c19941bb96066c5a20881))
* 用readFile读取package.json避免import assertion错误 ([6c775f8](https://github.com/HoPGoldy/cube-password/commit/6c775f81ab73985e9a6cea0069d28133224b086e))
* 移除无用依赖 ([397a6f7](https://github.com/HoPGoldy/cube-password/commit/397a6f76f2df02dde1ee6c24d7d207c2fdb1602e))
