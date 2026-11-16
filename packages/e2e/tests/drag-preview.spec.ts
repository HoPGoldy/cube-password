import type { Locator, Page } from "@playwright/test";
import {
  test,
  expect,
  authHeaders,
  BASE,
  encryptContent,
  loginWithPassword,
} from "../fixtures/api";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const GROUP_NAME = "certificate-drag-preview-e2e";

/** 开始一次真实鼠标拖拽，确认使用 Sortable fallback 而非浏览器原生拖拽镜像 */
const dragWithoutNativePreview = async (page: Page, target: Locator) => {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 30, startY + 20, { steps: 5 });

  const fallback = page.locator(".sortable-fallback");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveCSS("box-shadow", "none");
  await page.mouse.up();
  await expect(fallback).toHaveCount(0);
};

test("凭证卡片和详情字段拖拽均不使用带阴影的原生预览", async ({
  page,
  request,
  session,
}) => {
  const groupListResp = await request.post(`${BASE}/group/list`, {
    data: {},
    headers: authHeaders(session),
  });
  const staleGroups = (await groupListResp.json()).data.items.filter(
    (group: { id: number; name: string }) => group.name === GROUP_NAME,
  );
  for (const group of staleGroups) {
    await request.post(`${BASE}/group/delete`, {
      data: { id: group.id },
      headers: authHeaders(session),
    });
  }

  const groupResp = await request.post(`${BASE}/group/add`, {
    data: { name: GROUP_NAME, lockType: "None" },
    headers: authHeaders(session),
  });
  expect(groupResp.status()).toBe(200);
  const groupId = (await groupResp.json()).data.newId as number;

  try {
    const addResp = await request.post(`${BASE}/certificate/add`, {
      data: {
        groupId,
        nameEnc: await encryptContent(session.dek, "拖拽回归凭证"),
        content: await encryptContent(
          session.dek,
          JSON.stringify([
            { label: "用户名", value: "drag-user" },
            { label: "密码", value: "drag-password" },
          ]),
        ),
      },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);

    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByText(GROUP_NAME, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/group/${groupId}$`));

    const certificateItem = page
      .locator('[data-testid^="certificate-item-"]')
      .first();
    await expect(certificateItem).toBeVisible();
    await dragWithoutNativePreview(page, certificateItem);

    await certificateItem.click();
    await page.getByTestId("detail-edit-btn").click();
    const fieldHandle = page.locator(".ant-modal .move-handle").first();
    await expect(fieldHandle).toBeVisible();
    await dragWithoutNativePreview(page, fieldHandle);
  } finally {
    // 浏览器登录会替换单用户 session，重新登录后按分组级联清理测试数据
    const cleanupSession = await loginWithPassword(request, PASSWORD);
    await request.post(`${BASE}/group/delete`, {
      data: { id: groupId },
      headers: authHeaders(cleanupSession),
    });
  }
});
