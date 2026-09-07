import { ErrorForbidden } from "@/types/error";

/**
 * 设备门拒绝（403）。
 * 场景：
 * - 门激活时，未携带/携带无效 X-Gate-Token 访问受门禁保护的预登录路由；
 * - 设备挑战码校验失败或验签失败。
 * 前端据此渲染设备门 UI（见 docs/plans/device-gate/context.md 3.5）。
 */
export class ErrorDeviceGate extends ErrorForbidden {
  constructor(message = "此设备未授权访问") {
    super(message);
    this.code = 40301;
  }
}
