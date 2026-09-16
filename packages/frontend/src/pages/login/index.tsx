import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { stateIsLoggedIn, stateKdfMeta } from "@/store/user";
import { useAtomValue, useSetAtom } from "jotai";
import { LoginPage } from "./page";
import { DeviceGatePage } from "./device-gate";
import { PageLoading } from "@hopgoldy/cube-ui";
import { queryGlobal } from "@/services/auth";
import { toGateDenial, withGateToken } from "@/services/device-gate";
import type { GateDenial } from "@/services/device-gate";
import { Navigate } from "react-router-dom";
import type { SchemaLockDetailType } from "@shared-types/auth";

/**
 * 登录页门禁编排（见 docs/plans/device-gate/tasks/04-login-gate-flow.md
 * 与 docs/plans/ephemeral-gate-token/context.md 第 2 节 D-loginflow）：
 * - bootstrap 即 withGateToken 一遍：门未激活 → 无 token 直调 auth/global（纯密码
 *   模式，行为与门未激活时一致）；门激活 → 过门现取临时 token 调 auth/global，
 *   token 用完即弃（不落任何模块级状态）：
 *   - 成功 → 渲染密码表单
 *   - 失败 → 「此设备未授权」页（不显示密码表单，密码请求此时也过不了门禁）
 */
const Login = () => {
  const isLoggedIn = useAtomValue(stateIsLoggedIn);
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(true);
  const setKdfMeta = useSetAtom(stateKdfMeta);
  const [initialLockDetail, setInitialLockDetail] =
    useState<SchemaLockDetailType>();

  /**
   * 挂载即清 react-query 缓存：到达登录页 = 旧组件树已卸载（LoginAuth →
   * Navigate 的提交时序保证），此刻缓存零 active observer，clear 是纯删数据、
   * 零 refetch。所有进入登录页的路径（登出 / 会话到期 / 直链重定向）都过这里，
   * 「换号不读上一个账号缓存」由此兜底——不可在 logout() 里 clear：那里组件
   * 尚未卸载，observer 会因缓存消失而立即 refetch（登出瞬间的幽灵请求）。
   */
  useEffect(() => {
    queryClient.clear();
  }, []);

  /** 门禁状态：checking（探针中）→ off（纯密码模式）/ denied（未授权页）/ passed */
  const [gateChecking, setGateChecking] = useState(true);
  const [gateDenial, setGateDenial] = useState<GateDenial | undefined>();

  /** 把 auth/global 响应写入表单初始化所需的状态 */
  const applyGlobal = useCallback(
    (resp: Awaited<ReturnType<typeof queryGlobal>>) => {
      if (!resp.success) return;
      setIsInitialized(resp.data!.isInitialized);
      if (resp.data!.salt) {
        setKdfMeta((prev) => ({ ...prev, salt: resp.data!.salt }));
      }
      if (resp.data!.kdfParams) {
        setKdfMeta((prev) => ({
          ...prev,
          kdfParamsRaw: resp.data!.kdfParams,
        }));
      }
      setInitialLockDetail({
        loginFailure: resp.data!.loginFailure,
        retryNumber: resp.data!.retryNumber,
        isBanned: resp.data!.isBanned,
      });
    },
    [setKdfMeta],
  );

  /**
   * 门禁 + 表单初始化流程（withGateToken 一遍）。
   * 独立成函数供「重新验证」复用；gate token 即取即用：过门成功后不保存，
   * 仅存活于本次调用栈（withGateToken → queryGlobal），返回即消亡。
   */
  const runGateFlow = useCallback(async () => {
    setGateChecking(true);
    setGateDenial(undefined);
    try {
      applyGlobal(
        await withGateToken((gateToken) => queryGlobal({ gateToken })),
      );
    } catch (err) {
      setGateDenial(toGateDenial(err));
    } finally {
      setGateChecking(false);
    }
  }, [applyGlobal]);

  useEffect(() => {
    void runGateFlow();
  }, [runGateFlow]);

  if (gateChecking) return <PageLoading />;

  if (gateDenial) {
    return <DeviceGatePage denial={gateDenial} />;
  }

  if (!isInitialized) {
    return <Navigate to="/init" replace />;
  }

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <LoginPage
      initialLockDetail={initialLockDetail}
      onGateDenied={(denial) => setGateDenial(denial)}
    />
  );
};

export default Login;
