import { useCallback, useEffect, useState } from "react";
import { stateIsLoggedIn, stateKdfMeta } from "@/store/user";
import { useAtomValue, useSetAtom } from "jotai";
import { LoginPage } from "./page";
import { DeviceGatePage } from "./device-gate";
import { PageLoading } from "@hopgoldy/cube-ui";
import { queryGlobal } from "@/services/auth";
import {
  passGate,
  probeGate,
  setGateToken,
  toGateDenial,
} from "@/services/device-gate";
import type { GateDenial } from "@/services/device-gate";
import { Navigate } from "react-router-dom";
import type { SchemaLockDetailType } from "@shared-types/auth";

/**
 * 登录页门禁编排（见 docs/plans/device-gate/tasks/04-login-gate-flow.md）：
 * - 进页先 probeGate（登录页唯一探针）：gateEnabled=false → 现有流程零变化
 * - gateEnabled=true → passGate 静默过门：
 *   - 成功 → gate token 入内存，随后才调 auth/global（门激活时该请求必须带 token）
 *   - 失败 → 「此设备未授权」页（不显示密码表单，密码请求此时也过不了门禁）
 */
const Login = () => {
  const isLoggedIn = useAtomValue(stateIsLoggedIn);
  const [checking, setChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);
  const setKdfMeta = useSetAtom(stateKdfMeta);
  const [initialLockDetail, setInitialLockDetail] =
    useState<SchemaLockDetailType>();

  /** 门禁状态：checking（探针中）→ off（纯密码模式）/ denied（未授权页）/ passed */
  const [gateChecking, setGateChecking] = useState(true);
  const [gateDenial, setGateDenial] = useState<GateDenial | undefined>();

  /**
   * 门禁流程：探针 +（门激活时）静默过门。
   * 独立成函数供「重新验证」复用；过门成功仅保存 gate token（由拦截器附带），
   * token 过期/失效由 auth 请求的 40301 兜底重定向处理。
   */
  const runGateFlow = useCallback(async (): Promise<boolean> => {
    setGateChecking(true);
    setGateDenial(undefined);
    try {
      const probe = await probeGate();
      if (!probe.success) {
        setGateDenial({ kind: "unavailable", detail: probe.message });
        return false;
      }
      if (!probe.data!.gateEnabled) {
        return true; // 门未激活：纯密码模式
      }
      const { gateToken } = await passGate(probe.data!.challenge);
      setGateToken(gateToken);
      return true;
    } catch (err) {
      setGateDenial(toGateDenial(err));
      return false;
    } finally {
      setGateChecking(false);
    }
  }, []);

  /** 登录表单初始化：拉 auth/global（门激活时需 gate token，由拦截器附带） */
  const checkGlobal = useCallback(async () => {
    try {
      const resp = await queryGlobal();
      if (resp.success) {
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
      }
    } catch {
      // ignore
    }
  }, [setKdfMeta]);

  useEffect(() => {
    const bootstrap = async () => {
      const gatePassed = await runGateFlow();
      // 门未过（含暂时不可用）时不请求 auth/global（40301，属于正常拒绝）
      if (gatePassed) await checkGlobal();
      setChecking(false);
    };
    bootstrap();
  }, [runGateFlow, checkGlobal]);

  /** 「重新验证」：重跑门禁流程；过门后补一次 auth/global 初始化现有表单所需数据 */
  const onGateRetry = useCallback(async () => {
    setChecking(true);
    const passed = await runGateFlow();
    if (passed) await checkGlobal();
    setChecking(false);
  }, [runGateFlow, checkGlobal]);

  if (checking || gateChecking) return <PageLoading />;

  if (gateDenial) {
    return <DeviceGatePage denial={gateDenial} onRetry={onGateRetry} />;
  }

  if (!isInitialized) {
    return <Navigate to="/init" replace />;
  }

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage initialLockDetail={initialLockDetail} />;
};

export default Login;
