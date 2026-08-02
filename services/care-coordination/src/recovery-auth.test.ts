import { createServiceAssertion } from "@lifebridge/config";
import { describe, expect, it, vi } from "vitest";

import { buildCareServer } from "./server.js";
import type { CareService } from "./service.js";

describe("P7-S2 Care recovery identity", () => {
  it("permits only the recovery operator scope and key", async () => {
    const deliveryEvidence = vi.fn(async () => ({ eventId: "evt_recovery_1", state: "pending" }));
    const care = { isReady: vi.fn(async () => true), deliveryEvidence } as unknown as CareService;
    const gatewayKey = "synthetic-care-gateway-key-0000001";
    const recoveryKey = "synthetic-care-recovery-key-0000001";
    const app = buildCareServer(
      care,
      gatewayKey,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      undefined,
      recoveryKey,
    );
    const assertion = (caller: string, scope: string, secret: string, keyId: string) =>
      createServiceAssertion({
        caller,
        audience: "care-coordination",
        scope,
        keyId,
        secret,
        nonce: `nonce_${caller.replaceAll("-", "_")}`,
      });
    const denied = await app.inject({
      method: "GET",
      url: "/internal/v1/event-recovery/events/evt_recovery_1",
      headers: {
        "x-lifebridge-service-identity": assertion(
          "gateway",
          "care.access",
          gatewayKey,
          "gateway-current",
        ),
      },
    });
    expect(denied.statusCode).toBe(404);
    const accepted = await app.inject({
      method: "GET",
      url: "/internal/v1/event-recovery/events/evt_recovery_1",
      headers: {
        "x-lifebridge-service-identity": assertion(
          "recovery-operator",
          "event.recovery",
          recoveryKey,
          "recovery-current",
        ),
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(deliveryEvidence).toHaveBeenCalledOnce();
    await app.close();
  });
});
