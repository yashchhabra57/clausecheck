import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks until the window slides", () => {
    let t = 0;
    const check = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });

    expect(check("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(check("a")).toMatchObject({ allowed: true, remaining: 0 });
    expect(check("a")).toMatchObject({ allowed: false, retryAfter: 60 });

    // Other clients are unaffected.
    expect(check("b").allowed).toBe(true);

    t = 59_000;
    expect(check("a")).toMatchObject({ allowed: false, retryAfter: 1 });
    t = 60_000;
    expect(check("a").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first x-forwarded-for address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(clientKey(req)).toBe("1.2.3.4");
  });
});
