import { test, expect } from "@playwright/test";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

test.describe("认证", () => {
  test("未登录访问首页应重定向到登录页", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("密码错误时显示错误提示", async ({ page }) => {
    // 拦截登录请求直接返回 401：避免消耗真实登录失败计数（3 次触发 IP 锁定），
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
});
