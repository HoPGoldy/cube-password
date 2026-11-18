import { test, expect, authHeaders, BASE } from "../fixtures/api";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const GROUP_NAME = "locked-delete-e2e";

test.setTimeout(60_000);

/**
 * 锁定分组也要能删（分组锁只保护「读」）：
 * 用 API 造一个 Password 锁分组，登录后直接删除该分组，
 * 校验右上角删除入口、输入分组名的确认弹窗与删除后的跳转。
 */
test("锁定分组在未解锁状态下可从右上角删除", async ({
  page,
  request,
  session,
}) => {
  // 上一次运行失败可能留下同名分组：先清掉（只清理本轮对应用例的组）
  const listResp = await request.post(`${BASE}/group/list`, {
    data: {},
    headers: authHeaders(session),
  });
  const staleGroups = (await listResp.json()).data.items.filter(
    (group: { name: string }) => group.name === GROUP_NAME,
  );
  for (const group of staleGroups) {
    await request.post(`${BASE}/group/delete`, {
      data: { id: group.id },
      headers: authHeaders(session),
    });
  }

  const addResp = await request.post(`${BASE}/group/add`, {
    data: {
      name: GROUP_NAME,
      lockType: "Password",
      passwordHash: "a".repeat(64),
      passwordSalt: "b".repeat(64),
      kdfParams: JSON.stringify({
        algorithm: "argon2id",
        m: 65536,
        t: 2,
        p: 1,
        version: 1,
      }),
    },
    headers: authHeaders(session),
  });
  expect(addResp.status()).toBe(200);
  const groupId = (await addResp.json()).data.newId as number;

  try {
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);

    // 前端 session 仅存内存，必须走 SPA 导航（点击侧边栏分组名）
    await page.getByText(GROUP_NAME, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/group/${groupId}$`));
    await expect(page.getByText("分组已锁定")).toBeVisible();

    const deleteBtn = page.getByTestId("delete-locked-group-btn");
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const input = page.getByTestId("group-delete-confirm-input");
    await expect(input).toBeVisible();
    await input.fill(GROUP_NAME);
    await page.getByTestId("group-delete-confirm-btn").click();

    await expect(page.getByText("分组删除成功")).toBeVisible();
    // 删除后跳回默认分组，侧边栏不再有该分组
    await expect(page).not.toHaveURL(new RegExp(`/group/${groupId}$`));
    await expect(page.getByText(GROUP_NAME, { exact: true })).toHaveCount(0);
  } finally {
    // 失败时兜底清理（已被删掉时返回 400，忽略即可）
    await request.post(`${BASE}/group/delete`, {
      data: { id: groupId },
      headers: authHeaders(session),
    });
  }
});
