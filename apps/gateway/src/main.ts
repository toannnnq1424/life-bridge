import { port, requiredSecret, requiredUrl, requireFixtureSafeMode } from "@lifebridge/config";

import { buildGatewayServer } from "./server.js";

const publicOrigin = requiredUrl(process.env.APP_ORIGIN, "APP_ORIGIN");
const gatewayHost = process.env.GATEWAY_HOST ?? "127.0.0.1";
const runtime = requireFixtureSafeMode(
  process.env.RUNTIME_MODE,
  process.env.FIXTURE_IDENTITY,
  gatewayHost,
  publicOrigin,
);
const config = {
  careUrl: requiredUrl(process.env.CARE_URL, "CARE_URL"),
  identityUrl: requiredUrl(process.env.IDENTITY_URL, "IDENTITY_URL"),
  notificationUrl: requiredUrl(process.env.NOTIFICATION_URL, "NOTIFICATION_URL"),
  communityUrl: requiredUrl(process.env.COMMUNITY_URL, "COMMUNITY_URL"),
  careToken: requiredSecret(process.env.CARE_INTERNAL_TOKEN, "CARE_INTERNAL_TOKEN"),
  identityToken: requiredSecret(process.env.IDENTITY_INTERNAL_TOKEN, "IDENTITY_INTERNAL_TOKEN"),
  notificationToken: requiredSecret(
    process.env.NOTIFICATION_INTERNAL_TOKEN,
    "NOTIFICATION_INTERNAL_TOKEN",
  ),
  communityToken: requiredSecret(process.env.COMMUNITY_INTERNAL_TOKEN, "COMMUNITY_INTERNAL_TOKEN"),
  fixtureEnabled: runtime.fixtureEnabled,
  publicOrigin,
  sessionCookieName: runtime.mode === "production" ? "__Host-lb_session" : "lb_session",
  secureCookies: runtime.mode === "production",
};
const app = buildGatewayServer(config);
const servicePort = port(process.env.GATEWAY_PORT, 3001);

const close = async () => {
  await app.close();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ host: gatewayHost, port: servicePort });
