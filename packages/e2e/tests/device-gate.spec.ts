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
  setupGateEnabled,
  addTrustedDeviceViaApi,
  enableGateViaApi,
  disableGateViaApi,
  readGateConfigValue,
  writeGateConfigValue,
  resetGateConfig,
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
 * - 门状态：fixtures/device-gate 在每条用例前后删除 trusted-devices.json 并清
 *   AppConfig 的 deviceGateEnabled（gate-switch 新语义：清单与开关独立重置）；
 *   需要门激活的用例走 enableGateViaApi / setupGateEnabled（开关只经 API 切换，
 *   设备清单可直写文件模拟手工编辑，服务端均即时生效、无需重启）
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

      // 交叉验证：/device/list 与文件一致；此刻开关仍关，门未激活
      const listResp = await request.post(`${BASE}/device/list`, {
        data: {},
        headers: authHeaders(session),
      });
      expect((await listResp.json()).data.items).toHaveLength(1);
      const probeResp = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probeResp.json()).data).toMatchObject({
        gateEnabled: false,
      });

      // 开启开关（gate-switch：仅绑设备不激活门）→ 探针回报门已激活
      await enableGateViaApi(request, session);
      const probeAfter = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probeAfter.json()).data).toMatchObject({
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
      //    注册为受信设备并开启开关（等价管理页一键「设为受信设备并开启」）
      const injected = await waitForInjectedKey(gatePage);
      const session = await loginWithPassword(request, PASSWORD);
      await addTrustedDeviceViaApi(request, session, injected!.publicKey);
      await enableGateViaApi(request, session);
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
    async ({ browser, request }) => {
      // 纯 API 构造门激活态：清单非空 + 开关开启（无浏览器参与）
      await setupGateEnabled(request);

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
    async ({ gatePage, request }) => {
      await setupGateEnabled(request);

      await gatePage.goto("/login");
      // 未授权页：denied Alert（无外层卡片、无重试按钮）；密码表单不渲染
      await expect(gatePage.getByTestId("device-gate-denied")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-retry-btn")).toHaveCount(
        0,
      );
      await expect(gatePage.getByTestId("login-password-input")).toHaveCount(0);
      await expect(gatePage.getByTestId("device-gate-denied")).toContainText(
        "本机没有已授权的设备钥匙",
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

      // 门激活态（清单非空 + 开关开启）；陌生设备对它敲门（错误签名）。
      // setupGateEnabled 会再次登录互踢：通知断言改用其返回的新 session
      const { session: gateSession } = await setupGateEnabled(request);
      const key = await generateNodeSideKey();

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
        headers: authHeaders(gateSession),
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
      const id = await addTrustedDeviceViaApi(
        request,
        session,
        injected!.publicKey,
      );
      await enableGateViaApi(request, session);
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
    async ({ gatePage, request }) => {
      // 门激活：一把与浏览器无关的钥匙（清单非空 + 开关开启）
      const trusted = await generateNodeSideKey();
      const { session } = await setupGateEnabled(request);
      // 用例要求清单里只有这把「受信钥匙」：替换 setupGateEnabled 自带的设备
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-trusted", publicKey: trusted.publicKey }),
      ]);
      // 清单直改后 session 接口仍可用（门开 + session 有效，与清单内容无关）
      const listResp = await request.post(`${BASE}/device/list`, {
        data: {},
        headers: authHeaders(session),
      });
      expect((await listResp.json()).data.items).toHaveLength(1);

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

      // 刷新页面（文案指引的恢复方式）：pending 钥匙未在服务端录入 →
      // 验签必然失败 → 仍停留未授权页
      await gatePage.reload();
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
    "运行中增删 trusted-devices.json：清单即时生效，门开闭仅随开关（无需重启服务）",
    async ({ gatePage, request }) => {
      // 1. 初始：手工写空数组（清单为空），门未激活，auth/global 200；
      //    趁门未激活先登录拿 session（loginWithPassword 走 auth/login，
      //    门激活时会被 403，必须在开门前完成）
      writeTrustedDevices([]);
      const global1 = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(global1.status()).toBe(200);
      const session = await loginWithPassword(request, PASSWORD);

      // 2. 运行中录入设备但开关仍关：auth/global 仍 200（新语义：清单非空 ≠ 门开）
      const device1 = await generateNodeSideKey();
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-live-1", publicKey: device1.publicKey }),
      ]);
      const globalMid = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(globalMid.status()).toBe(200);

      // 3. 开启开关（API）→ 门立即激活：auth/global 403
      await enableGateViaApi(request, session);
      const global2 = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(global2.status()).toBe(403);
      expect(await global2.json()).toMatchObject({ code: 40301 });

      // 4. 新写入清单的设备能立刻过门（challenge → sign → verify 走通）
      await knockGateViaApi(request, device1, "e2e-live-1");

      // 5. 运行中再增一台 → list 反映为 2 台（清单直改即时生效）
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

      // 6. 手工编辑清单（删光设备）不动开关：门仍激活（auth/global 仍 403）
      writeTrustedDevices([]);
      const globalStill = await request.post(`${BASE}/auth/global`, {
        data: {},
      });
      expect(globalStill.status()).toBe(403);

      // 7. API 关闭开关 → 门立即失效：auth/global 恢复 200，
      //    浏览器端登录页密码表单直接出现（无 denied 页）
      await disableGateViaApi(request, session);
      const global3 = await request.post(`${BASE}/auth/global`, { data: {} });
      expect(global3.status()).toBe(200);

      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);
    },
  );

  rawTest(
    "手工坏文件不被静默降级：验签路径 500 显式暴露（测试自清理恢复）",
    async ({ request }) => {
      mkdirSync(STORAGE_DIR, { recursive: true });
      writeFileSync(`${STORAGE_DIR}/trusted-devices.json`, "{bad json", "utf8");
      try {
        // 坏文件仅在真正解析清单的路径暴露：探针只读 AppConfig 不触文件（仍 200），
        // updateGateConfig(true) 先走 hasDevices() 解析坏文件即炸 500（开关未写成）；随后 verify 在门 OFF 下无条件 listDevices() 同样炸 500（不静默降级为「无设备/门关」）
        await request.post(`${BASE}/device/gate-config-update`, {
          data: { enabled: true },
          headers: authHeaders(await loginWithPassword(request, PASSWORD)),
        });
        const probe = await request.post(`${BASE}/device/challenge`, {
          data: {},
        });
        expect(probe.status()).toBe(200);
        const { challenge } = (await probe.json()).data;
        // 携带合法 challenge 打到「遍历清单验签」那一步 → 解析坏文件炸 500
        const verify = await request.post(`${BASE}/device/verify`, {
          data: { challenge, signature: "y" },
        });
        expect(verify.status()).toBe(500);
      } finally {
        rmSync(`${STORAGE_DIR}/trusted-devices.json`, { force: true });
        // 开关兜底还原（清单已删，不还原会把 fail-closed 态泄漏给后续用例）
        resetGateConfig();
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

      // 2. 注册为受信设备并开启开关（门激活；服务端直读文件与 AppConfig）
      const session = await loginWithPassword(request, PASSWORD);
      await addTrustedDeviceViaApi(request, session, injected!.publicKey);
      await enableGateViaApi(request, session);
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
    async ({ gatePage, request }) => {
      const apiPaths = recordPageApiRequests(gatePage);

      // 1. 门未激活时首跳：浏览器生成本机钥匙（后续作为「被吊销设备」）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/login");
      const injected = await waitForInjectedKey(gatePage);

      // 2. 写入受信设备：本机钥匙（即将吊销）+ 一把无关钥匙（吊销本机后门仍激活），
      //    并开启开关（吊销用例的后半段依赖门保持激活）
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
      const session = await loginWithPassword(request, PASSWORD);
      await enableGateViaApi(request, session);

      // 3. 加载登录页 → 静默过门成功（此时本机仍在名单内）→ 密码表单出现
      await gatePage.goto("/login");
      await expect(gatePage.getByTestId("login-password-input")).toBeVisible();
      await expect(gatePage.getByTestId("device-gate-denied")).toHaveCount(0);

      // 4. 期间吊销本机设备：手工改写 trusted-devices.json 删掉它（服务端直读文件，
      //    即时生效、无需重启；保留陌生钥匙使清单非空，门开关仍开启、门保持激活）
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
        "本机没有已授权的设备钥匙",
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

      // 服务端登记这把公钥并开启开关（模拟「钥匙串已录入、本机尚不知 id」的跨设备场景）
      const session = await loginWithPassword(request, PASSWORD);
      await addTrustedDeviceViaApi(request, session, injected!.publicKey);
      await enableGateViaApi(request, session);

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
      await setupGateEnabled(request);
      // 用例要求清单里只有这把重导入钥匙：替换 setupGateEnabled 自带的设备
      // （开关保持开启，门激活态不变）
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

// ---------- 【T03 强制】开关生命周期（AppConfig deviceGateEnabled 唯一开关） ----------

gateTest.describe("设备门 - 开关生命周期（T03）", () => {
  /**
   * 登录 → 打开账号菜单 → 设备管理（SettingContainer 弹窗）→ 等待 gate-config
   * 加载完成并返回开关元素。桌面端容器是 antd Modal（渲染在 body portal 下）。
   */
  const openDeviceManage = async (page: Page) => {
    await page.getByRole("button", { name: "打开用户菜单" }).click();
    await page.getByRole("button", { name: "设备管理" }).click();
    const gateSwitch = page.getByRole("switch");
    await expect(gateSwitch).toBeVisible();
    return gateSwitch;
  };

  gateTest(
    "空库 UI 开关生命周期：OFF 无内容 → 引导一键绑定并开启 → 探针 true",
    async ({ gatePage, request }) => {
      // 1. 登录进入应用（门未激活，全新空库默认开关 OFF）
      await gatePage.goto("/login");
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      // 2. 打开设备管理：仅 OFF 开关，下方无任何内容
      const gateSwitch = await openDeviceManage(gatePage);
      // aria-checked 由 antd Switch 的 checked 属性映射，是态判定最稳的锚点
      await expect(gateSwitch).toHaveAttribute("aria-checked", "false");
      // exact 匹配：开关描述文案含「受信设备」子串，必须 exact 排除
      await expect(gatePage.getByText("受信设备", { exact: true })).toHaveCount(
        0,
      );
      await expect(
        gatePage.getByText("开启设备验证", { exact: true }),
      ).toHaveCount(0);

      // 3. 首次开启（清单为空）→ 绑定引导卡（不调 update，后端守卫未触发）
      await gateSwitch.click();
      const guideTitle = gatePage.getByText("受信设备", { exact: true });
      await expect(guideTitle).toBeVisible();

      // 4. 一键「将本机设为受信设备并开启」（生成 → add → update 单按钮完成）
      const enrollBtn = gatePage.getByRole("button", {
        name: "将本机设为受信设备",
      });
      await expect(enrollBtn).toBeEnabled();
      await enrollBtn.click();

      // 5. 服务端探针：门已激活（AppConfig 开关 + 浏览器生成的钥匙串已入库）
      await expect
        .poll(
          async () => {
            const probe = await request.post(`${BASE}/device/challenge`, {
              data: {},
            });
            return (await probe.json()).data.gateEnabled as boolean;
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      // 清单与开关各就各位：文件 1 台设备 + AppConfig 值为 "true"
      expect(readTrustedDevices()).toHaveLength(1);
      expect(readGateConfigValue()).toBe("true");

      // 6. 浏览器端复核：页面加载 /device/challenge 探针同样回报 true
      //    （门开启 = 登录走廊已切到设备验证流程）
      const pageProbe = await gatePage.evaluate(async () => {
        const resp = await fetch("/api/device/challenge", { method: "POST" });
        return (await resp.json()).data as { gateEnabled: boolean };
      });
      expect(pageProbe.gateEnabled).toBe(true);
    },
  );

  gateTest(
    "关闭开关：探针立即 false（清单保留），再开时 deviceCount>0 走 confirm 直开",
    async ({ gatePage, request }) => {
      // 1. 门激活（清单 1 台 + 开关开）
      const { session } = await setupGateEnabled(request);

      // 2. API 关闭开关 → 探针立即 false，设备清单原样保留（临时排查场景）
      await disableGateViaApi(request, session);
      const probe = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probe.json()).data).toMatchObject({ gateEnabled: false });
      expect(readTrustedDevices()).toHaveLength(1);

      // 3. UI 再开：登录后打开设备管理（gate-config 已刷新为 OFF 态，
      //    deviceCount=1 → 点击开关走 confirm 直开，不进引导卡）
      await gatePage.goto("/login");
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      const gateSwitch = await openDeviceManage(gatePage);
      await expect(gateSwitch).toHaveAttribute("aria-checked", "false");
      await expect(
        gatePage.getByText("开启设备验证", { exact: true }),
      ).toHaveCount(0);

      await gateSwitch.click();
      await expect(gatePage.getByText("确定开启设备验证？")).toBeVisible();
      await gatePage.getByRole("button", { name: "开 启" }).click();

      // 4. UI 复核：开关更新成功后 aria-checked 翻 true（react-query 失效重拉）
      await expect(gateSwitch).toHaveAttribute("aria-checked", "true", {
        timeout: 10_000,
      });
      // 5. 探针回报门再次激活，清单未被改动
      const probeAgain = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probeAgain.json()).data).toMatchObject({
        gateEnabled: true,
      });
      expect(readTrustedDevices()).toHaveLength(1);
    },
  );

  gateTest(
    "门开吊销最后一台设备：探针仍 true + 无钥匙 context 访问 auth/global 403（fail-closed）",
    async ({ browser, request }) => {
      // 1. 门激活（唯一设备），吊销之（API revoke；设备清单清空，开关不动）
      const { session, device } = await setupGateEnabled(request);
      const revokeResp = await request.post(`${BASE}/device/revoke`, {
        data: { id: device.id },
        headers: authHeaders(session),
      });
      expect(revokeResp.status()).toBe(200);
      expect(readTrustedDevices()).toHaveLength(0);

      // 2. fail-closed 核心断言：开关仍开启 → 探针仍 true
      const probe = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probe.json()).data).toMatchObject({ gateEnabled: true });

      // 3. 开关状态（gate-config，session 接口）回报一致：enabled=true + deviceCount=0
      const configResp = await request.post(`${BASE}/device/gate-config`, {
        data: {},
        headers: authHeaders(session),
      });
      expect(await configResp.json()).toMatchObject({
        success: true,
        data: { enabled: true, deviceCount: 0 },
      });

      // 4. 无钥匙的全新 context：auth/global 403 ErrorDeviceGate（无人能过门）
      const context = await browser.newContext();
      const denied = await context.request.post(`${BASE}/auth/global`, {
        data: {},
      });
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toMatchObject({ code: 40301 });
      await context.close();

      // 5. 自有 session 仍可用（门禁不拦 session 路由）：经 API 关门逃生
      await disableGateViaApi(request, session);
      const probeAfter = await request.post(`${BASE}/device/challenge`, {
        data: {},
      });
      expect((await probeAfter.json()).data).toMatchObject({
        gateEnabled: false,
      });
    },
  );
});

// ---------- 【T03 强制】手工编辑数据库开关：AppConfig 为唯一判定源 ----------

gateTest.describe("设备门 - 开关判定源钉（T03）", () => {
  gateTest(
    "手工写 AppConfig（不经 API）+ 清单非空：门开启；删行即关（缺省视为关）",
    async ({ request }) => {
      // 1. 清单非空 + 开关缺省（无行）→ 门关（缺省视为 false）
      writeTrustedDevices([
        makeManualDevice({ id: "e2e-db-device", publicKey: "not-a-real-key" }),
      ]);
      let probe = await request.post(`${BASE}/device/challenge`, { data: {} });
      expect((await probe.json()).data).toMatchObject({ gateEnabled: false });

      // 2. 手工插入 deviceGateEnabled='true' → 门开（清单无需任何变更）
      writeGateConfigValue("true");
      probe = await request.post(`${BASE}/device/challenge`, { data: {} });
      expect((await probe.json()).data).toMatchObject({ gateEnabled: true });

      // 3. 门开 + 篡改为脏值 '1' → 单条件判定 fail-closed：探针立即 false
      writeGateConfigValue("1");
      probe = await request.post(`${BASE}/device/challenge`, { data: {} });
      expect((await probe.json()).data).toMatchObject({ gateEnabled: false });

      // 4. 删行恢复缺省 → 门关；干净状态交还兜底 hook
      writeGateConfigValue(null);
      probe = await request.post(`${BASE}/device/challenge`, { data: {} });
      expect((await probe.json()).data).toMatchObject({ gateEnabled: false });
    },
  );
});
