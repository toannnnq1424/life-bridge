import {
  createServiceAssertion,
  requiredSecret,
  requiredUrl,
} from "../../../packages/config/src/index.js";

const [command, eventId, mutation] = process.argv.slice(2);
if (
  !command ||
  !/^[a-z_]+$/u.test(command) ||
  !eventId ||
  !/^[a-zA-Z0-9_.:-]{3,120}$/u.test(eventId)
) {
  throw new Error("Usage: p7-s2-recovery <reconcile|replay> <event-id> [--execute]");
}
const selectedCommand = command;
const selectedEventId = eventId;

const careUrl = requiredUrl(process.env.CARE_RECOVERY_URL, "CARE_RECOVERY_URL");
const notificationUrl = requiredUrl(
  process.env.NOTIFICATION_RECOVERY_URL,
  "NOTIFICATION_RECOVERY_URL",
);
const careKey = requiredSecret(
  process.env.CARE_RECOVERY_INTERNAL_TOKEN,
  "CARE_RECOVERY_INTERNAL_TOKEN",
);
const notificationKey = requiredSecret(
  process.env.NOTIFICATION_RECOVERY_INTERNAL_TOKEN,
  "NOTIFICATION_RECOVERY_INTERNAL_TOKEN",
);

async function evidence(url: string, audience: string, key: string) {
  const response = await fetch(
    `${url}/internal/v1/event-recovery/events/${encodeURIComponent(selectedEventId)}`,
    {
      headers: {
        "x-lifebridge-service-identity": createServiceAssertion({
          caller: "recovery-operator",
          audience,
          scope: audience === "notification" ? "event.reconciliation" : "event.recovery",
          keyId: "recovery-current",
          secret: key,
        }),
      },
      signal: AbortSignal.timeout(2_000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${audience.toUpperCase()}_EVIDENCE_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 16 * 1024) throw new Error("EVIDENCE_RESPONSE_TOO_LARGE");
  return JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
}

const care = await evidence(careUrl, "care-coordination", careKey);
const notification = await evidence(notificationUrl, "notification", notificationKey);
if (selectedCommand === "reconcile") {
  const classification = !care
    ? notification
      ? "receipt_without_source_evidence"
      : "not_found"
    : !notification
      ? "source_without_receipt"
      : care.state === "delivered" && notification.durableResult !== true
        ? "delivery_without_durable_result"
        : care.state !== "delivered" && notification.durableResult === true
          ? "receipt_awaiting_source_ack"
          : "consistent";
  process.stdout.write(
    JSON.stringify({ eventId: selectedEventId, classification, care, notification }),
  );
} else if (selectedCommand === "replay") {
  const execute = mutation === "--execute";
  const operatorId = requiredSecret(process.env.RECOVERY_OPERATOR_ID, "RECOVERY_OPERATOR_ID");
  const reasonCode = requiredSecret(process.env.RECOVERY_REASON_CODE, "RECOVERY_REASON_CODE");
  const response = await fetch(
    `${careUrl}/internal/v1/event-recovery/events/${encodeURIComponent(selectedEventId)}/replay`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lifebridge-service-identity": createServiceAssertion({
          caller: "recovery-operator",
          audience: "care-coordination",
          scope: "event.recovery",
          keyId: "recovery-current",
          secret: careKey,
        }),
      },
      body: JSON.stringify({ operatorId, reasonCode, dryRun: !execute }),
      signal: AbortSignal.timeout(2_000),
    },
  );
  if (!response.ok) throw new Error(`CARE_REPLAY_${response.status}`);
  process.stdout.write(await response.text());
} else {
  throw new Error("Unsupported recovery command");
}
