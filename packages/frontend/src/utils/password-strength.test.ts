import { describe, expect, it } from "vitest";
import { useZxcvbnWarningFactory } from "./password-strength";

describe("zxcvbn warning", () => {
  it(
    "warns on weak passwords and stays silent on strong ones",
    async () => {
      const check = useZxcvbnWarningFactory();

      const weak = await check("123456");
      expect(typeof weak).toBe("string");
      expect(weak!.length).toBeGreaterThan(0);

      const empty = await check("");
      expect(empty).toBeUndefined();

      const strong = await check("correct horse battery staple 7&Zq");
      expect(strong).toBeUndefined();
    },
    60 * 1000,
  );
});
