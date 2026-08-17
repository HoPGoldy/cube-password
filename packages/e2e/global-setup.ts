import crypto from "crypto";

/**
 * 后端直连地址（baseURL 是前端 3500，setup 阶段必须使用后端的绝对地址）。
 * 可通过环境变量 E2E_BACKEND_URL 覆盖（CI 等场景）。
 */
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3499";

/** 登录密码，与 packages/e2e/.env 的 E2E_LOGIN_PASSWORD 一致 */
const LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

/**
 * 初始化固定盐（可复现）
 * 后端存储 passwordHash = SHA512(salt + password)，登录校验 SHA512(passwordHash + challengeCode)
 */
const FIXED_SALT = "e2e-fixed-salt";

/** SHA-512（大写 hex），与 packages/e2e/fixtures/api.ts 及后端一致 */
export const sha512 = (str: string): string => {
  return crypto.createHash("sha512").update(str).digest("hex").toUpperCase();
};

interface GlobalData {
  isInitialized?: boolean;
  salt?: string;
}

interface GlobalResponse {
  success?: boolean;
  code?: number;
  data?: GlobalData;
}

/** 单次登录探测：challenge → login，返回是否成功（只探测 1 次，避免触发 3 次登录锁定） */
async function probeLogin(
  password: string,
  salt: string,
): Promise<{ ok: boolean; body?: unknown }> {
  try {
    const challengeResp = await fetch(`${BACKEND_URL}/api/auth/challenge`);
    const challengeBody = await challengeResp.json();
    const code = challengeBody?.data?.code as string | undefined;
    if (!code) {
      return { ok: false, body: challengeBody };
    }

    const hash = sha512(sha512(salt + password) + code);
    const loginResp = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash }),
    });
    const body = await loginResp.json();
    return { ok: loginResp.ok && body?.success === true, body };
  } catch (err) {
    return { ok: false, body: String(err) };
  }
}

async function ensureInitialized() {
  const globalResp = await fetch(`${BACKEND_URL}/api/auth/global`);
  if (!globalResp.ok) {
    throw new Error(
      `无法访问后端 ${BACKEND_URL}/api/auth/global（HTTP ${globalResp.status}），请先启动后端服务。`,
    );
  }
  const globalBody = (await globalResp.json()) as GlobalResponse;
  if (!globalBody.success) {
    throw new Error(
      `GET /api/auth/global 返回失败：${JSON.stringify(globalBody)}`,
    );
  }

  const { isInitialized } = globalBody.data ?? {};

  // 数据库未初始化：用固定盐自动初始化管理员账号
  if (!isInitialized) {
    const passwordHash = sha512(FIXED_SALT + LOGIN_PASSWORD);
    const initResp = await fetch(`${BACKEND_URL}/api/auth/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwordHash, passwordSalt: FIXED_SALT }),
    });
    const initBody = await initResp.json();
    if (!initResp.ok || !initBody?.success) {
      throw new Error(
        `自动初始化用户失败（HTTP ${initResp.status}）：${JSON.stringify(initBody)}`,
      );
    }
    console.log(
      `[global-setup] 数据库未初始化，已自动创建管理员用户（E2E_LOGIN_PASSWORD=${LOGIN_PASSWORD}）`,
    );
    return;
  }

  // 数据库已初始化：单次登录探测校验密码是否与 E2E_LOGIN_PASSWORD 一致
  const salt = globalBody.data?.salt;
  if (!salt) {
    throw new Error(
      "数据库已初始化但缺少 passwordSalt（可能是旧版本库），无法校验密码。请重建数据库后重试。",
    );
  }

  const probe = await probeLogin(LOGIN_PASSWORD, salt);
  if (!probe.ok) {
    throw new Error(
      `现有数据库的用户密码与 E2E_LOGIN_PASSWORD 不一致：期望 '${LOGIN_PASSWORD}'。` +
        `请重建数据库或设置正确的 E2E_LOGIN_PASSWORD。` +
        `（密码由 global-setup 自动初始化为 E2E_LOGIN_PASSWORD；复用已有开发库时必须与其一致。探测响应：${JSON.stringify(probe.body)}）`,
    );
  }
  console.log(
    `[global-setup] 数据库已初始化，密码校验通过（E2E_LOGIN_PASSWORD=${LOGIN_PASSWORD}）`,
  );
}

export default async function globalSetup() {
  await ensureInitialized();
}
