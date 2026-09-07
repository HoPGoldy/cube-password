import { createPublicKey, verify } from "node:crypto";
import { ChallengeManager } from "@/lib/challenge";
import { GateTokenManager } from "@/lib/gate-token";
import {
  addDevice,
  findDevice,
  isGateEnabled,
  listDevices,
  removeDevice,
  updateLastSeen,
} from "@/lib/device-store";
import { parseDeviceKey } from "@/lib/device-key";
import { NotificationService } from "@/modules/notification/service";
import { NoticeType } from "@/types/notification";
import { timingSafeEqual } from "@/lib/crypto";
import { ErrorDeviceGate } from "./error";

interface DeviceServiceDeps {
  deviceChallengeManager: ChallengeManager;
  gateTokenManager: GateTokenManager;
  notificationService: NotificationService;
}

/** 敲门失败通知去重窗口：全局 1 小时 1 条（内存态，重启重置） */
const KNOCK_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

/**
 * device 模块业务逻辑（见 docs/plans/device-gate/context.md 3.3）：
 * 挑战码用独立的 ChallengeManager 实例（与服务端登录挑战码分离，互不覆盖）；
 * verify = 查设备 → pop 挑战码（一次性，防重放）→ ieee-p1363 验签 →
 * 更新 lastSeenAt → 签发 gate token。
 */
export class DeviceService {
  private deviceChallengeManager: ChallengeManager;
  private gateTokenManager: GateTokenManager;
  private notificationService: NotificationService;
  /** 上次敲门通知时刻（全局去重） */
  private lastKnockNoticeAt = 0;

  constructor(deps: DeviceServiceDeps) {
    this.deviceChallengeManager = deps.deviceChallengeManager;
    this.gateTokenManager = deps.gateTokenManager;
    this.notificationService = deps.notificationService;
  }

  /** 设备挑战码（登录页唯一探针，同时回报门是否激活） */
  getChallenge(): { challenge: string; gateEnabled: boolean } {
    return {
      challenge: this.deviceChallengeManager.generateChallenge(),
      gateEnabled: isGateEnabled(),
    };
  }

  /**
   * 设备过门：任何一步失败均抛 ErrorDeviceGate（403）并尽力发一条去重通知。
   * 验签按 ieee-p1363 对齐 WebCrypto 的 raw r||s 输出（spike/verify-demo.mjs 已验证）。
   */
  verify(
    data: {
      deviceId?: string;
      challenge: string;
      signature: string;
    },
    notifyIp?: string,
  ): { gateToken: string } {
    // pop 一次性消费：同一挑战码二次 verify 必失败（防重放）。
    // 先 pop 再查设备：未知设备同样烧掉挑战码，不给探测面。
    const expectedChallenge = this.deviceChallengeManager.popLastChallenge();
    if (
      !expectedChallenge ||
      !timingSafeEqual(data.challenge, expectedChallenge)
    ) {
      this.notifyKnockFailure(notifyIp, "挑战码无效或已过期");
      throw new ErrorDeviceGate("挑战码无效或已过期");
    }

    // 候选设备集：显式指定 deviceId 时只验该设备；省略时（跨设备录入后
    // 源机器尚不知道自己的服务端 id）对全部受信设备逐一验签——设备数有界
    // （单人自托管），首个验签成功者即为未携带 id 的钥匙所属设备
    const candidates = data.deviceId
      ? [findDevice(data.deviceId)]
      : listDevices();
    const device = candidates.find(
      (d) =>
        d !== undefined &&
        this.verifySignature(d, expectedChallenge, data.signature),
    );

    if (!device) {
      this.notifyKnockFailure(
        notifyIp,
        data.deviceId ? "未知设备" : "签名验证失败",
      );
      throw new ErrorDeviceGate(
        data.deviceId ? "未知设备或签名验证失败" : "签名验证失败",
      );
    }

    updateLastSeen(device.id);
    return { gateToken: this.gateTokenManager.createToken() };
  }

  /** 单设备 ieee-p1363 验签（公钥损坏/签名非法均按失败处理） */
  private verifySignature(
    device: { publicKey: string },
    challenge: string,
    signature: string,
  ): boolean {
    try {
      const publicKey = createPublicKey({
        key: Buffer.from(device.publicKey, "base64"),
        format: "der",
        type: "spki",
      });
      return verify(
        "sha256",
        Buffer.from(challenge, "utf8"),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature, "base64"),
      );
    } catch {
      return false;
    }
  }

  /** 敲门失败通知：NoticeType.Warning 含来源 IP，全局 1 小时窗口去重 */
  private notifyKnockFailure(ip: string | undefined, reason: string): void {
    const now = Date.now();
    if (now - this.lastKnockNoticeAt < KNOCK_DEDUPE_WINDOW_MS) {
      return;
    }
    this.lastKnockNoticeAt = now;
    void this.notificationService
      .createNotice(
        "陌生设备尝试访问",
        `${ip ?? "未知来源"} 的设备未通过门禁验证（${reason}）。如非本人操作，请检查服务地址是否泄露。`,
        NoticeType.Warning,
      )
      .catch(() => {
        // 通知落库失败不影响门禁拒绝语义（403 已抛出）
      });
  }

  /** 录入设备（session 保护），公钥重复时 device-store 抛 ErrorBadRequest */
  add(deviceKey: string): { id: string } {
    const { name, publicKey } = parseDeviceKey(deviceKey);
    return { id: addDevice({ name, publicKey }).id };
  }

  /** 设备列表（session 保护），含 lastSeenAt 供管理页展示 */
  list() {
    return { items: listDevices() };
  }

  /** 吊销设备（session 保护） */
  revoke(id: string): void {
    removeDevice(id);
  }
}
