import { AppInstance } from "@/types";
import {
  SchemaDeviceChallengeResponse,
  SchemaDeviceVerifyBody,
  SchemaDeviceVerifyResponse,
  SchemaDeviceAddBody,
  SchemaDeviceAddResponse,
  SchemaDeviceListResponse,
  SchemaDeviceRevokeBody,
  SchemaDeviceRevokeResponse,
  SchemaDeviceGateConfigResponse,
  SchemaDeviceGateConfigUpdateBody,
  SchemaDeviceGateConfigUpdateResponse,
} from "./types";
import { DeviceService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  deviceService: DeviceService;
}

export const registerDeviceController = (options: RegisterOptions) => {
  const { server, deviceService } = options;

  // POST /api/device/challenge — 获取设备挑战码（门禁探针，豁免门禁与 session）
  // 注意：不声明 body schema——部分客户端（axios 走 vite proxy 时）不发送
  // Content-Type，声明 body schema 会触发 fastify 的 content-type parser 校验 400
  server.post(
    "/device/challenge",
    {
      config: { disableAuth: true },
      schema: {
        description: "获取设备挑战码，并回报设备门是否激活（登录页唯一探针）",
        tags: ["device"],
        response: { 200: SchemaDeviceChallengeResponse },
      },
    },
    async () => {
      return deviceService.getChallenge();
    },
  );

  // POST /api/device/gate-config — 设备门开关状态（session 保护）
  // 不声明 body schema——与 /device/list 同坑（axios 无 body 不发 Content-Type，
  // 声明 body schema 会触发 fastify content-type 校验 400）
  server.post(
    "/device/gate-config",
    {
      schema: {
        description: "设备门开关状态（enabled）与受信设备数量（deviceCount）",
        tags: ["device"],
        response: { 200: SchemaDeviceGateConfigResponse },
      },
    },
    async () => {
      return deviceService.gateConfig();
    },
  );

  // POST /api/device/gate-config-update — 切换设备门开关（session 保护）
  // 只写 AppConfig，不动 trusted-devices.json；开启且无设备时 400
  server.post(
    "/device/gate-config-update",
    {
      schema: {
        description: "切换设备门开关；开启前必须已绑定至少一台设备，否则 400",
        tags: ["device"],
        body: SchemaDeviceGateConfigUpdateBody,
        response: { 200: SchemaDeviceGateConfigUpdateResponse },
      },
    },
    async (request) => {
      await deviceService.updateGateConfig(request.body.enabled);
      return {};
    },
  );

  // POST /api/device/verify — 设备验签过门（豁免门禁与 session）
  server.post(
    "/device/verify",
    {
      config: { disableAuth: true },
      schema: {
        description: "设备挑战码验签，通过后签发门禁令牌",
        tags: ["device"],
        body: SchemaDeviceVerifyBody,
        response: { 200: SchemaDeviceVerifyResponse },
      },
    },
    async (request) => {
      // 来源 IP 仅用作通知文案（尽力而为的诊断信息）
      const notifyIp = request.ip;
      return deviceService.verify(request.body, notifyIp);
    },
  );

  // POST /api/device/add — 录入设备（session 保护）
  server.post(
    "/device/add",
    {
      schema: {
        description: "录入受信设备（钥匙串格式），公钥重复时拒绝",
        tags: ["device"],
        body: SchemaDeviceAddBody,
        response: { 200: SchemaDeviceAddResponse },
      },
    },
    async (request) => {
      return deviceService.add(request.body.deviceKey);
    },
  );

  // POST /api/device/list — 设备列表（session 保护）
  // 不声明 body schema——部分客户端（axios 走 vite proxy 时）对无 body 请求
  // 不发送 Content-Type，声明 body schema 会触发 fastify content-type 校验 400
  // （与 /device/challenge 同坑，见 T04 说明）
  server.post(
    "/device/list",
    {
      schema: {
        description: "受信设备列表（含最近过门时间）",
        tags: ["device"],
        response: { 200: SchemaDeviceListResponse },
      },
    },
    async () => {
      return deviceService.list();
    },
  );

  // POST /api/device/revoke — 吊销设备（session 保护）
  server.post(
    "/device/revoke",
    {
      schema: {
        description: "吊销受信设备",
        tags: ["device"],
        body: SchemaDeviceRevokeBody,
        response: { 200: SchemaDeviceRevokeResponse },
      },
    },
    async (request) => {
      deviceService.revoke(request.body.id);
      return {};
    },
  );
};
