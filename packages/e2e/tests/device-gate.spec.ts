import { test as rawTest, expect, type Page } from "@playwright/test";
import {
  gateTest,
  readTrustedDevices,
  writeTrustedDevices,
  makeManualDevice,
  generateNodeSideKey,
  signChallenge,
  knockGateViaApi,
  writeDeviceKeyToIdb,
  browserGenerateKeyInitScript,
  waitForInjectedKey,
} from "../fixtures/device-gate";
import { buildDeviceKeyString } from "../fixtures/device-gate";
import {
  authHeaders,
  BASE,
  loginWithPassword,
  sha512,
  deriveMasterKey,
  bytesToHex,
  hexToBytes,
} from "../fixtures/api";
import { parseKdfParams } from "@frontend/lib/e2ee";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";

/**
 * 设备门（device gate）端到端验收（见 docs/plans/device-gate/tasks/05-e2e-webcrypto.md
 * 与 context.md 第 4 节）：
 * ①门未激活回归 → ②绑定首台设备 → ③登出后静默过门 → ④无钥匙拦截（API + 页面）
 * → ⑤敲门通知去重 → ⑥【T04 强制】吊销后 denied 稳定 → ⑦【T04 强制】pending 未录入
 * + 重新验证 → ⑧手工编辑 trusted-devices.json 即时生效 → ⑨⑩【T02 强制】即取即用
 * 语义钉：停留后点登录仍成功（bootstrap + 提交各验签一次）与吊销后点登录渲染
 * 未授权页且密码请求未发出（吊销即时生效）。
 *
 * 隔离约定（workers=1 串行，见 playwright.config.ts）：
 * - 门状态：fixtures/device-gate 在每条用例前后删除 trusted-devices.json；
 *   需要门激活的用例自行写文件（服务端每次校验直读文件，即时生效、无需重启）
 * - 浏览器态：gatePage fixture 每用例全新 context（IndexedDB / localStorage 互不相通）
 * - 登录失败计数：全文件不做真实失败登录（3 次触发全局锁定），成功登录仅必要处使用
 */

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

/** 后端 storage 目录（坏文件用例直接写入） */
const STORAGE_DIR = new URL("../../backend/storage/", import.meta.url).pathname;

/** 浏览器内走完整静默过门三步（与前端 silentVerify/passGate 同语义，deviceId 可省略） */
const browserSilentPassGate = (page: {
  evaluate: <T>(fn: () => Promise<T>) => Promise<T>;
}): Promise<string> =>
  page.evaluate(async () => {
    const openDb = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("device-keys", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("keys");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const db = await openDb();
    const record = await new Promise<{
      deviceId?: string;
      privateKey: CryptoKey;
    }>((resolve, reject) => {
      const req = db
        .transaction("keys", "readonly")
        .objectStore("keys")
        .get("pending");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();

    const probe = await fetch("/api/device/challenge", { method: "POST" });
    const { challenge } = (await probe.json()).data;
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      record.privateKey,
      new TextEncoder().encode(challenge),
    );
    let binary = "";
    for (const b of new Uint8Array(signature)) binary += String.fromCharCode(b);
    const base64 = btoa(binary);
    const base64url =
      base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") ||
      base64; // all-padding 边界（64B 签名不会发生，防御式保留原值）

    const verify = await fetch("/api/device/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: record.deviceId,
        challenge,
        signature: base64url,
      }),
    });
    if (!verify.ok) throw new Error(`verify failed: ${verify.status}`);
    return ((await verify.json()).data as { gateToken: string }).gateToken;
  });

// ---------- ① 门未激活基线 ----------

gateTest.describe("设备门 - 门未激活基线", () => {
  gateTest(
    "探针回报 gateEnabled=false，密码登录全流程正常",
    async ({ gatePage, request }) => {
      // API 探针：门未激活
      const probeResp = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect(probeResp.status()).toBe(200);
      expect((await probeResp.json()).data).toMatchObject({
        gateEnabled: false,
      });

      // 页面：登录页直接渲染密码表单（无 denied 页、无门禁卡片）
      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);

      // 全流程登录成功（KDF 派生照常执行），进入应用后侧边栏可见
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();
    },
  );
});

// ---------- ② 绑定首台设备 ----------

gateTest.describe("设备门 - 绑定首台设备", () => {
  gateTest(
    "浏览器生成钥匙 → /device/add → trusted-devices.json 落盘 + 门激活",
    async ({ gatePage, request }) => {
      // 浏览器侧生成非导出钥匙对（initScript 与正式 lib/device-key.ts 同语义）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/");
      const injected = await waitForInjectedKey(gatePage);
      expect(injected.publicKey).toBeTruthy();

      // API 登录拿 session，把浏览器上报的公钥按钥匙串格式录入服务端
      const session = await loginWithPassword(request, PASSWORD);
      const addResp = await request.post(`${BASE}/device/add`, {
        data: {
          deviceKey: buildDeviceKeyString({
            name: injected!.name,
            publicKey: injected!.publicKey,
          }),
        },
        headers: authHeaders(session),
      });
      expect(addResp.status()).toBe(200);
      const { id } = (await addResp.json()).data as { id: string };

      // 落盘断言：trusted-devices.json 已生成且含该设备（直接读文件）
      const devices = readTrustedDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({ id, publicKey: injected!.publicKey });

      // 交叉验证：/device/list 与文件一致，探针回报门已激活
      const listResp = await request.post(`${BASE}/device/list`, {
        data: {},
        headers: authHeaders(session),
      });
      expect((await listResp.json()).data.items).toHaveLength(1);
      const probeResp = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probeResp.json()).data).toMatchObject({
        gateEnabled: true,
      });
    },
  );
});

// ---------- ③ 登出 → 登录页加载即静默过门 ----------

gateTest.describe("设备门 - 静默过门", () => {
  gateTest(
    "登出后重新进入登录页：加载即静默过门，密码表单直接出现（零感知）",
    async ({ gatePage, request }) => {
      // 0. 预挂注入脚本（幂等，只在本机无 pending 钥匙时生成；首次导航即生效）
      await gatePage.addInitScript(browserGenerateKeyInitScript);

      // 1. 门未激活时正常登录进入应用
      await gatePage.goto("/login");
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      // 2. 本机已随首次导航生成钥匙（initScript 首跳时已执行并写入 IDB），
      //    注册为受信设备（等价管理页「生成 + 直接添加」）
      const injected = await waitForInjectedKey(gatePage);
      const session = await loginWithPassword(request, PASSWORD);
      const addResp = await request.post(`${BASE}/device/add`, {
        data: {
          deviceKey: buildDeviceKeyString({
            name: injected!.name,
            publicKey: injected!.publicKey,
          }),
        },
        headers: authHeaders(session),
      });
      expect(addResp.status()).toBe(200);
      expect(readTrustedDevices()).toHaveLength(1);

      // 3. 走 UI 登出（头像菜单 → 登出按钮），回到登录页
      await gatePage.getByRole("button", { name: "打开用户菜单" }).click();
      await gatePage.getByRole("button", { name: "登出" }).click();
      await expect(gatePage).toHaveURL(/\/login/);

      // 4. 登录页加载即静默过门：密码表单直接出现，无 denied 页
      //    （runGateFlow 内 probeGate + passGate 静默完成，用户零感知）
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);

      // 5. 静默过门后的登录全链路可用（走廊请求自动附带 gate token）
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
    },
  );
});

// ---------- ④ 无钥匙的全新 context ----------

gateTest.describe("设备门 - 无钥匙拦截", () => {
  gateTest(
    "门激活时：全新 context 的 auth/global 返回 403 ErrorDeviceGate（API 级）",
    async ({ browser }) => {
      // Node 侧生成钥匙 + 写文件激活门（无浏览器参与）
      const key = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-api-device", publicKey: key.publicKey }),
      ]);

      // 全新 context 的隔离 request：不带任何 gate token
      const context = await browser.newContext();
      const resp = await context.request.post(`${BASE}/auth/global`, {
        data: {},
      });
      expect(resp.status()).toBe(403);
      expect(await resp.json()).toMatchObject({ success: false, code: 40301 });
      await context.close();
    },
  );

  gateTest(
    "门激活时：无钥匙浏览器访问登录页渲染「此设备未授权」页（无密码表单）",
    async ({ gatePage }) => {
      const key = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-api-device", publicKey: key.publicKey }),
      ]);

      await gatePage.goto("/login");
      // 未授权页：denied 卡片 + 重新验证按钮；密码表单不渲染
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-retry-btn")).toBeVisible();
      await expect(gatePage.getByTestId("login-password-input")).toHaveCount(0);
      await expect(gatePage.getByTestId("device-gate-denied")).toContainText(
        "此设备未授权",
      );
    },
  );
});

// ---------- ⑤ 敲门通知去重 ----------

gateTest.describe("设备门 - 敲门通知去重", () => {
  gateTest(
    "连续两次 verify 失败 → 通知列表只有 1 条 Warning",
    async ({ request }) => {
      const session = await loginWithPassword(request, PASSWORD);

      // 清空历史通知，保证断言只针对本轮敲门
      await request.post(`${BASE}/notification/remove-all`, {
        data: {},
        headers: authHeaders(session),
      });

      const key = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-knock-device", publicKey: key.publicKey }),
      ]);

      // 陌生设备连续两次敲门（错误签名，门激活态）→ 两次都 403 ErrorDeviceGate
      for (let i = 0; i < 2; i += 1) {
        const challengeResp = await request.post(`${BASE}/device/challenge`, {
          data: {},
        });
        const { challenge } = (await challengeResp.json()).data;
        const verifyResp = await request.post(`${BASE}/device/verify`, {
          data: {
            deviceId: "e2e-knock-device",
            challenge,
            signature: signChallenge(key.privateKeyJwk, "tampered"),
          },
        });
        expect(verifyResp.status()).toBe(403);
        expect(await verifyResp.json()).toMatchObject({ code: 40301 });
      }

      // 通知列表：Warning（type=2）恰好 1 条（全局 1 小时窗口去重）
      const listResp = await request.post(`${BASE}/notification/list`, {
        data: { page: 1, pageSize: 50, type: 2 },
        headers: authHeaders(session),
      });
      expect(listResp.status()).toBe(200);
      const body = await listResp.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0]).toMatchObject({ type: 2 });
    },
  );
});

// ---------- ⑥ 【T04 强制】吊销钥匙后 denied 稳定 ----------

gateTest.describe("设备门 - 吊销后 denied 稳定", () => {
  gateTest(
    "门激活 + /device/revoke 后登录页稳定渲染 denied 页，无 reload 循环",
    async ({ gatePage, request }) => {
      // 1. 浏览器生成钥匙并注册（门激活，本机为受信设备）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/login");
      const injected = await waitForInjectedKey(gatePage);
      const session = await loginWithPassword(request, PASSWORD);
      const addResp = await request.post(`${BASE}/device/add`, {
        data: {
          deviceKey: buildDeviceKeyString({
            name: injected!.name,
            publicKey: injected!.publicKey,
          }),
        },
        headers: authHeaders(session),
      });
      const { id } = (await addResp.json()).data as { id: string };
      expect(readTrustedDevices()).toHaveLength(1);

      // 2. 吊销唯一受信设备（session 接口；devices 变空 = 门自动失效）
      const revokeResp = await request.post(`${BASE}/device/revoke`, {
        data: { id },
        headers: authHeaders(session),
      });
      expect(revokeResp.status()).toBe(200);
      expect(readTrustedDevices()).toHaveLength(0);

      // 3. 模拟「本机钥匙仍在但服务端已不认识」：手工写回一把陌生公钥的门
      //    （等价吊销后重新激活门，本机未重绑）
      const stranger = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({
          id: "e2e-stranger-device",
          publicKey: stranger.publicKey,
        }),
      ]);

      // 4. 重新加载登录页 → 本机验签被拒 → denied 页，且稳定不循环
      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();

      // 稳定性断言：等待一段真实时间后仍在 denied 页、URL 未变（无 reload 循环）
      const urlBefore = gatePage.url();
      await gatePage.waitForTimeout(3000);
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();
      expect(gatePage.url()).toBe(urlBefore);
      await expect(gatePage.getByTestId("login-password-input")).toHaveCount(0);

      // 5. API 级复核：被吊销的本机钥匙（浏览器句柄仍在 IDB）静默验签被拒 403
      await expect(browserSilentPassGate(gatePage)).rejects.toThrow(
        "verify failed: 403",
      );
    },
  );
});

// ---------- ⑦ 【T04 强制】pending 未录入 + 重新验证 ----------

gateTest.describe("设备门 - pending 未录入 + 重新验证", () => {
  gateTest(
    "清 IDB 后生成 pending 钥匙（服务端未录入）：重新验证停留未授权页，无循环",
    async ({ gatePage }) => {
      // 门激活：一把与浏览器无关的钥匙
      const trusted = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-trusted", publicKey: trusted.publicKey }),
      ]);

      // 首次进入：本机无钥匙 → denied 页
      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();

      // 在 denied 页用 UI 生成本机钥匙串（KeyGenCard → generateDeviceKeyPair：
      // 句柄进 pending 槽位，服务端并不知道这把公钥）
      await gatePage
        .getByPlaceholder("设备名称，如 Chrome on macOS")
        .fill("e2e-pending-device");
      // antd 会把两个汉字的按钮文案渲染为「生 成」（中间插空格），用正则匹配
      await gatePage.getByRole("button", { name: /生\s*成/ }).click();
      await expect(gatePage.getByText("本机钥匙已生成")).toBeVisible();

      // 点「重新验证」：pending 钥匙未在服务端录入 → 验签必然失败 → 仍停留未授权页
      await gatePage.getByTestId("device-gate-retry-btn").click();
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();

      // 稳定性：无 reload 循环（URL 不变、denied 持续在、无密码表单）
      const urlBefore = gatePage.url();
      await gatePage.waitForTimeout(3000);
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();
      expect(gatePage.url()).toBe(urlBefore);
      await expect(gatePage.getByTestId("login-password-input")).toHaveCount(0);

      // IDB 里确实只留了 pending（未关联 deviceId）——本地态符合场景设定
      const idbKeys = await gatePage.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("device-keys", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("keys");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const keys = await new Promise<string[]>((resolve, reject) => {
          const req = db
            .transaction("keys", "readonly")
            .objectStore("keys")
            .getAllKeys();
          req.onsuccess = () => resolve(req.result as string[]);
          req.onerror = () => reject(req.error);
        });
        db.close();
        return keys;
      });
      expect(idbKeys).toEqual(["pending"]);
    },
  );
});

// ---------- ⑧ 手工编辑 trusted-devices.json 即时生效 ----------

gateTest.describe("设备门 - 手工编辑文件即时生效", () => {
  gateTest(
    "运行中增删 trusted-devices.json：门即时开关，无需重启服务",
    async ({ gatePage, request }) => {
      // 1. 初始：手工写空数组（门未激活），auth/global 200；趁门未激活先登录拿 session
      //    （loginWithPassword 走 auth/login，门激活时会 403，必须在开门前完成）
      writeTrustedDevices([]);
      const global1 = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(global1.status()).toBe(200);
      const session = await loginWithPassword(request, PASSWORD);

      // 2. 运行中写入一台设备（Node 生成钥匙）→ 门立即激活
      const device1 = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-live-1", publicKey: device1.publicKey }),
      ]);
      const global2 = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(global2.status()).toBe(403);
      expect(await global2.json()).toMatchObject({ code: 40301 });

      // 3. 新写入的设备能立刻过门（challenge → sign → verify 走通）
      await knockGateViaApi(request, device1, "e2e-live-1");

      // 4. 运行中再增一台 → list 反映为 2 台（session 在门未激活时已拿到，不受门状态影响）
      const device2 = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-live-1", publicKey: device1.publicKey }),
        makeManualDevice({ id: "e2e-live-2", publicKey: device2.publicKey }),
      ]);
      const listResp = await request.post(`${BASE}/device/list`, {
        data: {},
        headers: authHeaders(session),
      });
      const items = (await listResp.json()).data.items as Array<{ id: string }>;
      expect(items.map((item) => item.id).sort()).toEqual([
        "e2e-live-1",
        "e2e-live-2",
      ]);

      // 5. 运行中删光设备 → 门立即失效：auth/global 恢复 200，
      //    浏览器端登录页密码表单直接出现（无 denied 页）
      writeTrustedDevices([]);
      const global3 = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(global3.status()).toBe(200);

      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);
    },
  );

  rawTest(
    "手工坏文件不被静默降级：探针 500 显式暴露（测试自清理恢复）",
    async ({ request }) => {
      mkdirSync(STORAGE_DIR, { recursive: true });
      writeFileSync(`${STORAGE_DIR}/trusted-devices.json`, "{bad json", "utf8");
      try {
        const probe = await request.post(`${BASE}/device/challenge`, {
          data: {},
        });
        expect(probe.status()).toBe(500);
      } finally {
        rmSync(`${STORAGE_DIR}/trusted-devices.json`, { force: true });
      }
    },
  );
});

// ---------- ⑨⑩【T02 强制】即取即用（ephemeral gate token）语义钉 ----------

gateTest.describe("设备门 - 即取即用语义（T02）", () => {
  /**
   * 记录页面自身发出的 /api/* 请求路径（page.on('request') 只捕获页面上下文内的
   * 请求；request fixture 发起的 API 调用不计入，恰好隔离出「前端真实行为」）
   */
  const recordPageApiRequests = (page: Page): string[] => {
    const paths: string[] = [];
    page.on("request", (req) => {
      const { pathname } = new URL(req.url());
      if (pathname.startsWith("/api/")) paths.push(pathname);
    });
    return paths;
  };

  gateTest(
    "门开 + 停留后点登录仍成功：bootstrap 与提交各走一遍 device/verify",
    async ({ gatePage, request }) => {
      const apiPaths = recordPageApiRequests(gatePage);

      // 1. 门未激活时首跳：浏览器生成本机钥匙（initScript）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/login");
      const injected = await waitForInjectedKey(gatePage);

      // 2. 注册为受信设备（服务端直读文件，门立即激活）
      const session = await loginWithPassword(request, PASSWORD);
      const addResp = await request.post(`${BASE}/device/add`, {
        data: {
          deviceKey: buildDeviceKeyString({
            name: injected!.name,
            publicKey: injected!.publicKey,
          }),
        },
        headers: authHeaders(session),
      });
      expect(addResp.status()).toBe(200);
      expect(readTrustedDevices()).toHaveLength(1);

      // 3. 加载登录页 → 静默过门（bootstrap：device/verify 第 1 次）→ 密码表单直接出现
      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);

      // 4. 模拟停留：即取即用语义下 token 不跨流程存在，无过期概念，
      //    停留任意时长后点登录都必须成功（旧「页面级缓存 10min TTL」时代的钉）
      await gatePage.waitForTimeout(5000);

      // 5. 输密码点登录 → 提交流程重新过门（device/verify 第 2 次）→ 登录成功进首页
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      // 核心断言：本轮 Network 恰好两次 device/verify（bootstrap 一次 + 提交一次），
      // 且 auth/login 恰好一次（携带提交时现取的 token 通过门禁）
      expect(
        apiPaths.filter((path) => path.endsWith("/device/verify")),
      ).toHaveLength(2);
      expect(
        apiPaths.filter((path) => path.endsWith("/auth/login")),
      ).toHaveLength(1);
    },
  );

  gateTest(
    "吊销后不刷新点登录：渲染未授权页且密码请求未发出",
    async ({ gatePage }) => {
      const apiPaths = recordPageApiRequests(gatePage);

      // 1. 门未激活时首跳：浏览器生成本机钥匙（后续作为「被吊销设备」）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/login");
      const injected = await waitForInjectedKey(gatePage);

      // 2. 写入受信设备：本机钥匙（即将吊销）+ 一把无关钥匙（吊销本机后门仍激活）
      const stranger = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({
          id: "e2e-revoked-target",
          publicKey: injected!.publicKey,
        }),
        makeManualDevice({
          id: "e2e-still-trusted",
          publicKey: stranger.publicKey,
        }),
      ]);

      // 3. 加载登录页 → 静默过门成功（此时本机仍在名单内）→ 密码表单出现
      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);

      // 4. 期间吊销本机设备：手工改写 trusted-devices.json 删掉它（服务端直读文件，
      //    即时生效、无需重启；保留陌生钥匙使门保持激活）
      writeTrustedDevices([
        makeManualDevice({
          id: "e2e-still-trusted",
          publicKey: stranger.publicKey,
        }),
      ]);

      // 5. 不刷新页面直接输密码点登录 → 提交流程 passGate 验签被拒（40301）→
      //    ErrorGateDenied 上报外层渲染未授权页，挑战码与密码请求均未发出
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toContainText(
        "此设备未授权",
      );
      await expect(gatePage.getByTestId("login-password-input")).toHaveCount(0);

      // Network 断言：全程（含提交）无 auth/challenge、无 auth/login（密码未发出）；
      // 提交触发的那次 verify 确实发出且被服务端拒绝（请求存在于 Network）
      expect(
        apiPaths.filter((path) => path.endsWith("/auth/login")),
      ).toHaveLength(0);
      expect(
        apiPaths.filter((path) => path.endsWith("/auth/challenge")),
      ).toHaveLength(0);
      expect(
        apiPaths.filter((path) => path.endsWith("/device/verify")),
      ).toHaveLength(2);
    },
  );
});

// ---------- 注入链路语义复核（页面签名 → 服务端遍历验签 → gate token） ----------

gateTest.describe("设备门 - 注入链路语义复核", () => {
  gateTest(
    "浏览器 pending 钥匙：省略 deviceId 的 verify 也能过门，gate token 可用",
    async ({ gatePage, request }) => {
      // 浏览器生成钥匙（pending，无服务端 id）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/");
      const injected = await waitForInjectedKey(gatePage);

      // 服务端只登记这把公钥（模拟「钥匙串已录入、本机尚不知 id」的跨设备场景）
      const session = await loginWithPassword(request, PASSWORD);
      const addResp = await request.post(`${BASE}/device/add`, {
        data: {
          deviceKey: buildDeviceKeyString({
            name: injected!.name,
            publicKey: injected!.publicKey,
          }),
        },
        headers: authHeaders(session),
      });
      expect(addResp.status()).toBe(200);

      // 页面上下文内走完整静默过门（fetch 走 vite 代理，省略 deviceId）
      const gateToken = await browserSilentPassGate(gatePage);
      expect(gateToken).toBeTruthy();

      // gate token 真实可用：门激活态下带 token 访问走廊路由恢复 200
      const globalResp = await request.post(`${BASE}/auth/global`, {
        data: {},
        headers: { "X-Gate-Token": gateToken },
      });
      expect(globalResp.status()).toBe(200);
    },
  );

  gateTest(
    "sanity：Node 侧 JWK 重导入浏览器后签名仍可过门（writeDeviceKeyToIdb 基建）",
    async ({ gatePage, request }) => {
      const key = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-reimport", publicKey: key.publicKey }),
      ]);

      // 先导航拿到真实 origin（about:blank 下无 crypto.subtle 且 fetch 走不了）
      await gatePage.goto("/login");

      // 重导入 Node 侧 JWK 到浏览器 IndexedDB（pending 槽位）
      const browserPublicKey = await writeDeviceKeyToIdb(gatePage, {
        privateKeyJwk: key.privateKeyJwk,
        name: "e2e-reimport-device",
      });
      expect(browserPublicKey).toBe(key.publicKey);

      // 浏览器句柄签名 → 服务端验签通过
      const gateToken = await browserSilentPassGate(gatePage);
      expect(gateToken).toBeTruthy();

      const globalResp = await request.post(`${BASE}/auth/global`, {
        data: {},
        headers: { "X-Gate-Token": gateToken },
      });
      expect(globalResp.status()).toBe(200);
    },
  );

  gateTest(
    "sanity：登录辅助派生与后端 kdfParams 闭环（本文件登录前置的自检）",
    async ({ request }) => {
      const globalResp = await request.post(`${BASE}/auth/global`, {
        data: {},
      });
      const body = await globalResp.json();
      const kdfParams = parseKdfParams(body.data.kdfParams);
      const { verifier } = await deriveMasterKey(
        PASSWORD,
        hexToBytes(body.data.salt),
        kdfParams,
      );
      const challengeResp = await request.post(`${BASE}/auth/challenge`, {
        data: {},
      });
      const code = (await challengeResp.json()).data.code;
      const loginResp = await request.post(`${BASE}/auth/login`, {
        data: { hash: sha512(bytesToHex(verifier) + code) },
      });
      expect(loginResp.status()).toBe(200);
    },
  );
});
