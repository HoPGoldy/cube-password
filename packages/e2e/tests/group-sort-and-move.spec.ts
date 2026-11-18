import type { APIRequestContext } from "@playwright/test";
import {
  test,
  expect,
  authHeaders,
  BASE,
  encryptContent,
  loginWithPassword,
  deriveMasterKey,
  bytesToHex,
  randomBytes,
  type SessionInfo,
} from "../fixtures/api";
import { DEFAULT_KDF_PARAMS } from "@frontend/lib/e2ee";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const LOCKED_TARGET_WARNING = "请先解锁分组再移动凭证";

test.setTimeout(90_000);

/** 清理失败重跑遗留的同名分组；分组删除允许锁定态并会级联删除其中凭证 */
const cleanupNamedGroups = async (
  request: APIRequestContext,
  session: SessionInfo,
  names: string[],
) => {
  const resp = await request.post(`${BASE}/group/list`, {
    data: {},
    headers: authHeaders(session),
  });
  expect(resp.status()).toBe(200);
  const staleGroups = (await resp.json()).data.items.filter(
    (group: { name: string }) => names.includes(group.name),
  );

  for (const group of staleGroups) {
    const deleteResp = await request.post(`${BASE}/group/delete`, {
      data: { id: group.id },
      headers: authHeaders(session),
    });
    expect(deleteResp.status()).toBe(200);
  }
};

test("桌面分组整行拖拽排序，刷新后保持且不改变默认落地分组", async ({
  page,
  request,
  session,
}) => {
  const names = ["group-sort-a-e2e", "group-sort-b-e2e", "group-sort-c-e2e"];
  await cleanupNamedGroups(request, session, names);

  const groupIds: number[] = [];
  for (const name of names) {
    const resp = await request.post(`${BASE}/group/add`, {
      data: { name, lockType: "None" },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
    groupIds.push((await resp.json()).data.newId);
  }

  try {
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).toHaveURL(/\/group\/\d+$/);
    const defaultGroupUrl = page.url();

    const sidebar = page.getByTestId("sidebar");
    const source = page.getByTestId(`sidebar-group-${groupIds[2]}`);
    const target = page.getByTestId(`sidebar-group-${groupIds[0]}`);
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();

    const getTestGroupOrder = async () =>
      sidebar
        .locator('[data-testid^="sidebar-group-"]')
        .evaluateAll((elements, ids) => {
          return elements
            .map((element) =>
              Number(
                element
                  .getAttribute("data-testid")
                  ?.replace("sidebar-group-", ""),
              ),
            )
            .filter((id) => ids.includes(id));
        }, groupIds);

    await expect.poll(getTestGroupOrder).toEqual(groupIds);

    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    const sortResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/group/sort") &&
        response.request().method() === "POST",
    );

    // 将 C 拖到 A 前方；SortableJS 会在拖动后抑制链接 click
    await page.mouse.move(
      sourceBox!.x + sourceBox!.width / 2,
      sourceBox!.y + sourceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sourceBox!.x + sourceBox!.width / 2,
      sourceBox!.y + sourceBox!.height / 2 - 12,
      { steps: 4 },
    );
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + 2,
      { steps: 12 },
    );
    await page.mouse.up();

    const sortResponse = await sortResponsePromise;
    expect(sortResponse.status()).toBe(200);
    expect((await sortResponse.json()).code).toBe(200);
    await expect
      .poll(getTestGroupOrder)
      .toEqual([groupIds[2], groupIds[0], groupIds[1]]);
    await expect(page).toHaveURL(defaultGroupUrl);

    // 会话仅在内存中，刷新后重新登录；仍应进入原默认分组并读到持久化顺序
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).toHaveURL(defaultGroupUrl);
    await expect
      .poll(getTestGroupOrder)
      .toEqual([groupIds[2], groupIds[0], groupIds[1]]);
  } finally {
    // 浏览器登录会替换单用户 session，使用新会话清理测试数据
    const cleanupSession = await loginWithPassword(request, PASSWORD);
    await cleanupNamedGroups(request, cleanupSession, names);
  }
});

test("多选移动到未解锁分组仅提示，不请求移动且保留选择", async ({
  page,
  request,
  session,
}) => {
  const sourceName = "locked-move-source-e2e";
  const targetName = "locked-move-target-e2e";
  const names = [sourceName, targetName];
  await cleanupNamedGroups(request, session, names);

  const sourceResp = await request.post(`${BASE}/group/add`, {
    data: { name: sourceName, lockType: "None" },
    headers: authHeaders(session),
  });
  expect(sourceResp.status()).toBe(200);
  const sourceGroupId = (await sourceResp.json()).data.newId as number;

  const salt = randomBytes(32);
  const { verifier } = await deriveMasterKey(
    "locked-move-e2e-password",
    salt,
    DEFAULT_KDF_PARAMS,
  );
  const targetResp = await request.post(`${BASE}/group/add`, {
    data: {
      name: targetName,
      lockType: "Password",
      passwordHash: bytesToHex(verifier),
      passwordSalt: bytesToHex(salt),
      kdfParams: JSON.stringify(DEFAULT_KDF_PARAMS),
    },
    headers: authHeaders(session),
  });
  expect(targetResp.status()).toBe(200);
  const targetGroupId = (await targetResp.json()).data.newId as number;

  const certResp = await request.post(`${BASE}/certificate/add`, {
    data: {
      groupId: sourceGroupId,
      nameEnc: await encryptContent(session.dek, "locked-move-cert-e2e"),
      content: await encryptContent(session.dek, "[]"),
    },
    headers: authHeaders(session),
  });
  expect(certResp.status()).toBe(200);
  const certId = (await certResp.json()).data.id as number;

  let cleanupSession: SessionInfo | undefined;
  try {
    await page.goto("/login");
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-btn").click();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByTestId(`sidebar-group-${targetGroupId}`),
    ).toBeVisible();
    await page.getByTestId(`sidebar-group-${sourceGroupId}`).click();
    await expect(page).toHaveURL(new RegExp(`/group/${sourceGroupId}$`));

    await page.getByRole("button", { name: /移动凭证/ }).click();
    await page.getByTestId(`certificate-item-${certId}`).click();

    const moveRequests: string[] = [];
    const collectMoveRequest = (request: { url: () => string }) => {
      if (request.url().includes("/api/certificate/move")) {
        moveRequests.push(request.url());
      }
    };
    page.on("request", collectMoveRequest);
    try {
      await page.getByRole("button", { name: /移动至/ }).hover();
      await page
        .getByRole("menuitem", { name: targetName, exact: true })
        .click();

      await expect(
        page.getByText(LOCKED_TARGET_WARNING, { exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/group/${sourceGroupId}$`));
      await expect(
        page.getByRole("button", { name: /取消移动/ }),
      ).toBeVisible();
      await expect(
        page.getByTestId(`certificate-item-${certId}`).getByRole("checkbox"),
      ).toBeChecked();
      expect(moveRequests).toHaveLength(0);
    } finally {
      page.off("request", collectMoveRequest);
    }

    // 浏览器登录已替换 fixture session，换最新会话验证数据仍在来源分组
    cleanupSession = await loginWithPassword(request, PASSWORD);
    const detailResp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: certId },
      headers: authHeaders(cleanupSession),
    });
    expect(detailResp.status()).toBe(200);
    expect((await detailResp.json()).data.groupId).toBe(sourceGroupId);
  } finally {
    cleanupSession ??= await loginWithPassword(request, PASSWORD);
    await cleanupNamedGroups(request, cleanupSession, names);
  }
});
