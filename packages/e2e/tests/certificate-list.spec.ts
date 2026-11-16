import {
  test,
  expect,
  authHeaders,
  BASE,
  encryptContent,
  loginWithPassword,
} from "../fixtures/api";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const LONG_CERT_NAME =
  "oneai-office-addins 阿里云管理后台账号超长名称用于验证不会溢出卡片";

test.setTimeout(60_000);

test("长名称限制在卡片内，新建凭证保存及重新登录后均排在第一位", async ({
  page,
  request,
  session,
}) => {
  const groupName = "certificate-list-layout-e2e";
  const groupListResp = await request.post(`${BASE}/group/list`, {
    data: {},
    headers: authHeaders(session),
  });
  const staleGroups = (await groupListResp.json()).data.items.filter(
    (group: { id: number; name: string }) => group.name === groupName,
  );
  for (const group of staleGroups) {
    await request.post(`${BASE}/group/delete`, {
      data: { id: group.id },
      headers: authHeaders(session),
    });
  }

  const groupResp = await request.post(`${BASE}/group/add`, {
    data: { name: groupName, lockType: "None" },
    headers: authHeaders(session),
  });
  expect(groupResp.status()).toBe(200);
  const groupId = (await groupResp.json()).data.newId as number;

  try {
    const addResp = await request.post(`${BASE}/certificate/add`, {
      data: {
        groupId,
        nameEnc: await encryptContent(session.dek, "已有凭证"),
        content: await encryptContent(session.dek, "[]"),
      },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);

    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByText(groupName, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/group/${groupId}$`));

    await page.getByTestId("add-certificate-btn").click();
    await page.getByPlaceholder("请输入密码名").fill(LONG_CERT_NAME);
    await page.getByTestId("detail-save-btn").click();

    const items = page.locator('[data-testid^="certificate-item-"]');
    await expect(items).toHaveCount(2);
    await expect(items.first().getByTestId("certificate-item-name")).toHaveText(
      LONG_CERT_NAME,
    );

    const layout = await items.first().evaluate((item) => {
      const cardBody = item.querySelector(".ant-card-body")!;
      const name = item.querySelector('[data-testid="certificate-item-name"]')!;
      const cardBodyBox = cardBody.getBoundingClientRect();
      const nameBox = name.getBoundingClientRect();
      return {
        cardBodyRight: cardBodyBox.right,
        nameRight: nameBox.right,
        nameClientWidth: name.clientWidth,
        nameScrollWidth: name.scrollWidth,
      };
    });
    expect(layout.nameRight).toBeLessThanOrEqual(layout.cardBodyRight + 1);
    expect(layout.nameScrollWidth).toBeGreaterThan(layout.nameClientWidth);

    // 会话仅保存在内存中，刷新后重新登录以验证服务端持久化排序
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByText(groupName, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/group/${groupId}$`));
    await expect(
      page
        .locator('[data-testid^="certificate-item-"]')
        .first()
        .getByTestId("certificate-item-name"),
    ).toHaveText(LONG_CERT_NAME);
  } finally {
    // 浏览器登录会替换单用户 session，重新登录后按分组级联清理测试数据
    const cleanupSession = await loginWithPassword(request, PASSWORD);
    await request.post(`${BASE}/group/delete`, {
      data: { id: groupId },
      headers: authHeaders(cleanupSession),
    });
  }
});
