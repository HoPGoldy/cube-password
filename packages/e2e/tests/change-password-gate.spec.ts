import { expect } from "@playwright/test";
import {
  captureSessionToken,
  closeGateWithSessionToken,
  gateTest,
  browserGenerateKeyInitScript,
  waitForInjectedKey,
  addTrustedDeviceViaApi,
  enableGateViaApi,
} from "../fixtures/device-gate";
import {
  BASE,
  authHeaders,
  loginWithPassword,
  deriveMasterKey,
  bytesToHex,
  hexToBytes,
  sha512,
} from "../fixtures/api";
import { randomBytes, wrapDek, unwrapDek } from "@frontend/lib/e2ee";

/**
 * 改密码（change-password）× 设备门回归：
 *
 * 线上事故根因：改密码弹窗裸调预登录路由 /auth/challenge（disableAuth），
 * 门开启时必须携带 X-Gate-Token——即使已登录。403 被静默吞掉，弹窗看似
 * 成功而密码实际未改。
 *
 * 修复方案：会话内流程（改密码 / 分组解锁 / 解绑 OTP）改走新增的
 * session 保护端点 /auth/session-challenge——与 /auth/challenge 唯一差异
 * 是需要登录。设备门只守登录走廊（disableAuth 路由），session 守房间，
 * 已登录取码天然免门禁，不再需要 withGateToken 的临时 token 往返。
 *
 * 本 spec 在「门激活」的真实布局下验证：
 * ① 门开时 /auth/session-challenge 带 session 即可访问（无 gate token）；
 * ② UI 全流程改密码成功且新密码真实生效；
 * ③ 收尾恢复默认密码与门状态，不污染其他 spec。
 *
 * 隔离约定与 device-gate.spec 相同（workers=1；fixtures/device-gate 在
 * 每条用例前后重置 trusted-devices.json 与 AppConfig 门开关）。
 */

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const NEW_PASSWORD = "e2e-gate-changed-pwd-789";

/** UI 全流程改密码（调用前已在应用内） */
const changePasswordViaUi = async (
  page: import("@playwright/test").Page,
  oldPassword: string,
  newPassword: string,
) => {
  await page.getByRole("button", { name: "打开用户菜单" }).click();
  await page.getByRole("button", { name: "修改密码" }).click();
  await expect(page.getByText("密码修改")).toBeVisible();
  await page.getByLabel("旧密码").fill(oldPassword);
  await page.getByLabel("新密码", { exact: true }).fill(newPassword);
  await page.getByLabel("重复新密码").fill(newPassword);
  await page.getByRole("button", { name: "保 存" }).click();
  // KDF 派生约 0.5s×2，放宽到 15s
  await expect(page.getByText("密码修改成功")).toBeVisible({
    timeout: 15_000,
  });
};

gateTest.describe("改密码 × 设备门（session-challenge 方案）", () => {
  gateTest(
    "门激活时：/auth/session-challenge 免门禁（session 直达），UI 改密码成功且新密码生效",
    async ({ gatePage, request }) => {
      // 0. 布局：浏览器生成钥匙（initScript）→ API 登录注册该公钥 → 开门。
      //    之后的 API session 已被 UI 登录互踢——API 断言放在 UI 登录前完成
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/login");
      const injected = await waitForInjectedKey(gatePage);
      const session = await loginWithPassword(request, PASSWORD);
      await addTrustedDeviceViaApi(request, session, injected!.publicKey);
      await enableGateViaApi(request, session);
      // 门已激活：预登录路由从此需要 gate token（本用例 API 侧全程不提供）

      // 1. API 级断言：门开时 session-challenge 仅凭 session 即可访问
      //    （修复前若走 /auth/challenge 则 403 ErrorDeviceGate）
      const blockedOld = await request.post(`${BASE}/auth/challenge`, {
        data: {},
      });
      expect(blockedOld.status()).toBe(403);
      expect((await blockedOld.json()).code).toBe(40301);

      const okNew = await request.post(`${BASE}/auth/session-challenge`, {
        data: {},
        headers: authHeaders(session),
      });
      expect(okNew.status()).toBe(200);
      const challengeBody = await okNew.json();
      expect(challengeBody.success).toBe(true);
      expect(typeof challengeBody.data.code).toBe("string");

      // 无 session 的访问仍被 session hook 拒绝（401，非门禁 403）
      const noSession = await request.post(`${BASE}/auth/session-challenge`, {
        data: {},
      });
      expect(noSession.status()).toBe(401);

      // 2. UI 登录（静默过门；此导航会重新加载登录页）。截获登录响应里的
      //    session token：互踢语义下只有浏览器会话存活，收尾关门必须用它
      const getLatestSessionToken = captureSessionToken(gatePage);
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      // 3. 回归点：门开着时 UI 改密码（此处曾静默 403、密码未被更改）
      await changePasswordViaUi(gatePage, PASSWORD, NEW_PASSWORD);

      // 4. 新密码生效：登出后用新密码重新登录成功。
      //    旧密码失效（真实 401）不在本用例验证：登录 401 会触发登录页
      //    回流重跑门禁流程，与提交流程竞争服务端「全局单槽挑战码」，
      //    属独立的前端竞态；verifier 已轮换的负向验证由
      //    api-change-password.spec 的真实 401 用例（无门禁场景）覆盖
      await gatePage.getByRole("button", { name: "打开用户菜单" }).click();
      await gatePage.getByRole("button", { name: "登出" }).click();
      await expect(gatePage).toHaveURL(/\/login/);
      await gatePage.getByTestId("login-password-input").fill(NEW_PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      // 5. 收尾：用截获的浏览器 session 关门（loginWithPassword 的
      //    /auth/global 是预登录路由，门开着必 403），再走 API 恢复默认密码
      await closeGateWithSessionToken(request, getLatestSessionToken);
      const restoreSession = await loginWithPassword(request, NEW_PASSWORD);
      await restorePasswordViaApi(request, restoreSession, NEW_PASSWORD);
    },
  );

  gateTest(
    "门激活且钥匙被吊销时：会话内改密码仍可用（session 通道不依赖设备钥匙）",
    async ({ gatePage, request }) => {
      // 布局：注册浏览器钥匙并开门后，从受信清单移除该钥匙（模拟吊销）。
      // 页面已登录的 session 不受影响——session-challenge / change-password
      // 走 session 通道，改密应照常成功（若借道登录走廊则会 403）
      await gatePage.addInitScript(browserGenerateKeyInitScript);
      await gatePage.goto("/login");
      const injected = await waitForInjectedKey(gatePage);
      const session = await loginWithPassword(request, PASSWORD);
      await addTrustedDeviceViaApi(request, session, injected!.publicKey);
      await enableGateViaApi(request, session);

      // UI 登录（此刻钥匙仍有效）；截获 session 供收尾
      const getLatestSessionToken = captureSessionToken(gatePage);
      await gatePage.getByTestId("login-password-input").fill(PASSWORD);
      await gatePage.getByTestId("login-submit-btn").click();
      await expect(gatePage).not.toHaveURL(/\/login/);
      await expect(gatePage.getByTestId("sidebar")).toBeVisible();

      // 吊销全部受信设备（写空清单，服务端即时生效）
      const { writeTrustedDevices } = await import("../fixtures/device-gate");
      writeTrustedDevices([]);

      // 回归点：门开 + 钥匙吊销，改密码仍成功（不碰门禁走廊）
      await changePasswordViaUi(gatePage, PASSWORD, NEW_PASSWORD);

      // 收尾：用截获的浏览器 session 关门（互踢后唯一存活的 session），
      // 再走 API 恢复默认密码
      await closeGateWithSessionToken(request, getLatestSessionToken);
      const restoreSession = await loginWithPassword(request, NEW_PASSWORD);
      await restorePasswordViaApi(request, restoreSession, NEW_PASSWORD);
    },
  );
});

/**
 * API 侧 re-wrap 改密码（与 api-change-password.spec 的 changePasswordViaApi
 * 同构）：走 session 保护的 /auth/session-challenge 取码（无论门开关均可）。
 */
const restorePasswordViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  session: Awaited<ReturnType<typeof loginWithPassword>>,
  oldPassword: string,
) => {
  const { kek: oldKek, verifier: oldVerifier } = await deriveMasterKey(
    oldPassword,
    hexToBytes(session.salt),
    session.kdfParams,
  );
  const dek = await unwrapDek(oldKek, session.keyBlob);

  const newSalt = randomBytes(32);
  const { kek: newKek, verifier: newVerifier } = await deriveMasterKey(
    PASSWORD,
    newSalt,
    session.kdfParams,
  );
  const newKeyBlob = await wrapDek(newKek, dek);

  const challengeResp = await request.post(`${BASE}/auth/session-challenge`, {
    data: {},
    headers: authHeaders(session),
  });
  const code = ((await challengeResp.json()).data as { code: string }).code;

  const resp = await request.post(`${BASE}/auth/change-password`, {
    data: {
      verifier: bytesToHex(newVerifier),
      hash: sha512(bytesToHex(oldVerifier) + code),
      salt: bytesToHex(newSalt),
      keyBlob: newKeyBlob,
    },
    headers: authHeaders(session),
  });
  expect((await resp.json()).success).toBe(true);

  // 默认密码可登录（其他 spec 的 session fixture 依赖它）
  const restored = await loginWithPassword(request, PASSWORD);
  expect(restored.token.length).toBeGreaterThan(0);
};
