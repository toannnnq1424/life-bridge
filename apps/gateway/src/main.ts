import { port, requiredSecret, requiredUrl, requireFixtureSafeMode } from "@lifebridge/config";

import { buildGatewayServer } from "./server.js";

const runtime = requireFixtureSafeMode(process.env.RUNTIME_MODE, process.env.FIXTURE_IDENTITY);
const config = {
  careUrl: requiredUrl(process.env.CARE_URL, "CARE_URL"),
  notificationUrl: requiredUrl(process.env.NOTIFICATION_URL, "NOTIFICATION_URL"),
  careToken: requiredSecret(process.env.CARE_INTERNAL_TOKEN, "CARE_INTERNAL_TOKEN"),
  notificationToken: requiredSecret(
    process.env.NOTIFICATION_INTERNAL_TOKEN,
    "NOTIFICATION_INTERNAL_TOKEN",
  ),
  fixtureEnabled: runtime.fixtureEnabled,
};
const app = buildGatewayServer(config);
const servicePort = port(process.env.GATEWAY_PORT, 3001);

const close = async () => {
  await app.close();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ host: "127.0.0.1", port: servicePort });
