/**
 * 密码强度提示（@zxcvbn-ts/core 动态 import 懒加载，仅 init / 改密码页使用）
 *
 * 策略（实施方案第 1 节决策 #6）：评分 < 3 时展示警告，不拦截提交。
 */

/** zxcvbn 评分 0~4，>= 3 视为足够强 */
export const ZXCVBN_MIN_SCORE = 3;

/** 懒加载缓存，避免重复 import 与重复构建 */
let checkerPromise: Promise<
  (password: string) => import("@zxcvbn-ts/core").ZxcvbnResult
> | null = null;

const loadChecker = async () => {
  if (!checkerPromise) {
    checkerPromise = Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
    ]).then(([core, common]) => {
      const factory = new core.ZxcvbnFactory({
        dictionary: common.default.dictionary,
        graphs: common.default.adjacencyGraphs,
      });
      return (password: string) => factory.check(password);
    });
  }
  return checkerPromise;
};

/** 创建强度检查函数（不依赖 React，供页面 hook 与单测复用） */
export const useZxcvbnWarningFactory = () => {
  return async (password: string): Promise<string | undefined> => {
    if (!password) return undefined;

    const check = await loadChecker();
    const { score, crackTimes } = check(password);
    if (score >= ZXCVBN_MIN_SCORE) return undefined;

    // 离线慢哈希场景（argon2id）下的破解时间估算
    const crackTime = crackTimes.offlineSlowHashingXPerSecond;
    return `密码强度不足（破解时间估算：${crackTime?.display ?? "未知"}），建议使用更长的密码或混合大小写字母、数字与符号`;
  };
};

/** 页面用 hook（懒加载只发生首次调用时） */
export const useZxcvbnWarning = useZxcvbnWarningFactory;
