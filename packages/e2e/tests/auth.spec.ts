import { test, expect } from "@playwright/test";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

test.describe("认证", () => {
  test("未登录访问首页应重定向到登录页", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("密码错误时显示错误提示", async ({ page }) => {
    // 拦截登录请求直接返回 401：避免消耗真实登录失败计数（3 次触发全局锁定），
    // 同时仍验证错误密码时前端停留在登录页的 UX（KDF 派生照常真实执行）
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          code: 40101,
          message: "账号或密码错误",
        }),
      }),
    );
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill("wrong-password-123");
    await page.getByTestId("login-submit-btn").click();
    // 登录失败，停留在登录页
    await expect(page).toHaveURL(/\/login/);
  });

  test("密码正确时成功登录并跳转首页", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("登出后不再发出任何 API 请求（缓存清理不在组件卸载前触发 refetch）", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);

    // 回归钉：logout() 曾在组件树卸载前 queryClient.clear()，导致 Sidebar 的
    // group/list 与 AppContainer 的 config/version 在卸载缝隙里 refetch。
    // 登出后允许的请求仅限登录页自身 bootstrap（auth/logout、device/challenge、
    // auth/global），任何来自旧组件树的数据查询都算回归
    const allowedAfterLogout =
      /\/api\/(auth\/logout|auth\/global|device\/challenge)/;
    const strayRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/") && !allowedAfterLogout.test(req.url())) {
        strayRequests.push(req.url());
      }
    });

    await page.getByRole("button", { name: "打开用户菜单" }).click();
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.waitForTimeout(500);

    expect(strayRequests).toEqual([]);
  });

  test("登录失败计数在成功登录后清零（Locker reset）", async ({
    page,
    request,
  }) => {
    // 前置：真实输错一次密码（消耗一次失败计数）
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill("definitely-wrong");
    await page.getByTestId("login-submit-btn").click();
    await expect(page.getByText(/账号或密码错误/)).toBeVisible();

    // 随后正确登录：reset 应已清零，否则再错一次的锁死预告会显示「还剩 0 次」
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);

    // 登出后再输错一次：预告应为「还剩 2 次后锁定」（计数从头开始），
    // 若 reset 缺失则为「还剩 0 次/已锁定」（残留 1+1=2 次记录，第三次即锁）
    await page.getByRole("button", { name: "打开用户菜单" }).click();
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByTestId("login-password-input").fill("wrong-again-456");
    await page.getByTestId("login-submit-btn").click();
    await expect(page.getByText(/2 次后锁定登录/)).toBeVisible();
  });
});
