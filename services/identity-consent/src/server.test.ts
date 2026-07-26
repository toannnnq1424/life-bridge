import { describe, expect, it, vi } from "vitest";

import { buildIdentityServer } from "./server.js";
import type { IdentityService } from "./service.js";

describe("identity internal HTTP boundary", () => {
  it("conceals protected routes from callers without the internal token", async () => {
    const identity = {
      isReady: vi.fn(async () => true),
      beginSignIn: vi.fn(),
    } as unknown as IdentityService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789");

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/account/sessions",
      payload: { loginName: "synthetic.user", password: "Synthetic passphrase value" },
    });

    expect(response.statusCode).toBe(404);
    expect(identity.beginSignIn).not.toHaveBeenCalled();
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("returns only a safe envelope and no-store headers for an authorized call", async () => {
    const beginSignIn = vi.fn(async () => ({
      code: "AUTHENTICATION_CONTINUE" as const,
      messageKey: "auth.continue" as const,
      challengeToken: "q".repeat(43),
    }));
    const identity = {
      isReady: vi.fn(async () => true),
      beginSignIn,
    } as unknown as IdentityService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789");

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/account/sessions",
      headers: {
        "x-internal-service-token": "internal-token-value-123456789",
        "x-correlation-id": "corr_internal_1",
        "x-rate-limit-source": "127.0.0.1",
      },
      payload: { loginName: "synthetic.user", password: "Synthetic passphrase value" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      data: {
        code: "AUTHENTICATION_CONTINUE",
        messageKey: "auth.continue",
        challengeToken: "q".repeat(43),
      },
      meta: { correlationId: "corr_internal_1" },
    });
    expect(beginSignIn).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: "127.0.0.1" }));
    await app.close();
  });
});
