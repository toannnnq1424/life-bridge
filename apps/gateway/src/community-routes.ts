import { createHash } from "node:crypto";

import {
  CommunityAuthorizationContextSchema,
  CommunityDirectorySuccessSchema,
  CommunityFailureSchema,
  CommunityHelpRequestDeleteSuccessSchema,
  CommunityHelpRequestListSuccessSchema,
  CommunityHelpRequestMutationSuccessSchema,
  CommunityHelpRequestReconcileCommandSchema,
  CommunityHelpRequestSubmissionSchema,
  CommunityHelpRequestVersionRequestSchema,
  CommunityPublicDirectoryQuerySchema,
  IdempotencyKeySchema,
  type CommunityPermission,
} from "@lifebridge/contracts";
import { resolveCorrelationId, type SafeLogger } from "@lifebridge/observability";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface CommunityGatewayConfig {
  communityUrl: string;
  identityUrl: string;
  communityToken: string;
  identityToken: string;
  publicOrigin: string;
  sessionCookieName: string;
}

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

interface DependencyResponse {
  status: number;
  body: unknown;
}

const publicCache = new Map<string, { expiresAt: number; response: DependencyResponse }>();
const PUBLIC_CACHE_MS = 5 * 60_000;

export function registerCommunityRoutes(
  app: FastifyInstance,
  config: CommunityGatewayConfig,
  fetcher: Fetcher,
  logger: SafeLogger,
): void {
  app.get<{ Querystring: unknown }>("/api/v1/community", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const query = CommunityPublicDirectoryQuerySchema.parse(request.query);
    const parameters = new URLSearchParams();
    for (const key of ["category", "provinceCityCode", "organizationType"] as const) {
      const value = query[key];
      if (value) parameters.set(key, value);
    }
    const queryString = parameters.toString();
    const targetPath = `/internal/v1/community/directory${queryString ? `?${queryString}` : ""}`;
    const cacheKey = queryString;
    const cached = publicCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      reply.header("cache-control", "public, max-age=300, stale-if-error=86400");
      const cachedBody = CommunityDirectorySuccessSchema.parse(cached.response.body);
      return reply.code(cached.response.status).send({
        ...cachedBody,
        meta: { ...cachedBody.meta, correlationId },
      });
    }

    try {
      const response = await callCommunity(fetcher, config, targetPath, "GET", correlationId);
      const validated = validateDependencyResponse(response, CommunityDirectorySuccessSchema);
      if (validated.status < 400) {
        publicCache.set(cacheKey, {
          expiresAt: Date.now() + PUBLIC_CACHE_MS,
          response: validated,
        });
      }
      reply.header("cache-control", "public, max-age=300, stale-if-error=86400");
      return reply.code(validated.status).send(validated.body);
    } catch {
      return unavailable(reply, correlationId, logger, "DIRECTORY_SEARCH_UNAVAILABLE");
    }
  });

  app.post<{
    Params: { householdId: string };
  }>("/api/v1/households/:householdId/community/help-requests/query", async (request, reply) =>
    authorizeAndForward(request, reply, {
      permission: "community.help_request.list",
      householdId: request.params.householdId,
      internalPath: "/internal/v1/community/help-requests/query",
      method: "POST",
      intentBody: {},
      commandBody: (authorization) => ({ operation: "list", authorization }),
      successSchema: CommunityHelpRequestListSuccessSchema,
    }),
  );

  app.post<{
    Params: { householdId: string };
    Body: unknown;
  }>("/api/v1/households/:householdId/community/help-requests", async (request, reply) => {
    const submission = CommunityHelpRequestSubmissionSchema.parse(request.body);
    return authorizeAndForward(request, reply, {
      permission: "community.help_request.submit",
      householdId: request.params.householdId,
      internalPath: "/internal/v1/community/help-requests",
      method: "POST",
      intentBody: submission,
      idempotencyKey: requiredIdempotencyKey(request),
      mutation: true,
      uncertainAfterDispatch: true,
      commandBody: (authorization) => ({
        operation: "submit",
        authorization,
        request: submission,
      }),
      successSchema: CommunityHelpRequestMutationSuccessSchema,
    });
  });

  app.post<{
    Params: { householdId: string };
    Body: unknown;
  }>(
    "/api/v1/households/:householdId/community/help-requests/reconcile",
    async (request, reply) => {
      const reconciliation = CommunityHelpRequestReconcileCommandSchema.pick({
        submissionReference: true,
      }).parse(request.body);
      return authorizeAndForward(request, reply, {
        permission: "community.help_request.reconcile",
        householdId: request.params.householdId,
        internalPath: "/internal/v1/community/help-requests/reconcile",
        method: "POST",
        intentBody: reconciliation,
        mutation: true,
        commandBody: (authorization) => ({
          operation: "reconcile",
          authorization,
          submissionReference: reconciliation.submissionReference,
        }),
        successSchema: CommunityHelpRequestMutationSuccessSchema,
      });
    },
  );

  app.post<{
    Params: { householdId: string; requestId: string };
    Body: unknown;
  }>(
    "/api/v1/households/:householdId/community/help-requests/:requestId/close",
    async (request, reply) => {
      const version = CommunityHelpRequestVersionRequestSchema.parse(request.body);
      const requestId = boundedOpaqueId(request.params.requestId);
      return authorizeAndForward(request, reply, {
        permission: "community.help_request.close",
        householdId: request.params.householdId,
        requestId,
        internalPath: `/internal/v1/community/help-requests/${encodeURIComponent(requestId)}/close`,
        method: "POST",
        intentBody: version,
        idempotencyKey: requiredIdempotencyKey(request),
        mutation: true,
        uncertainAfterDispatch: true,
        commandBody: (authorization) => ({
          operation: "close",
          authorization,
          expectedVersion: version.expectedVersion,
        }),
        successSchema: CommunityHelpRequestMutationSuccessSchema,
      });
    },
  );

  app.delete<{
    Params: { householdId: string; requestId: string };
    Body: unknown;
  }>(
    "/api/v1/households/:householdId/community/help-requests/:requestId",
    async (request, reply) => {
      const version = CommunityHelpRequestVersionRequestSchema.parse(request.body);
      const requestId = boundedOpaqueId(request.params.requestId);
      return authorizeAndForward(request, reply, {
        permission: "community.help_request.delete",
        householdId: request.params.householdId,
        requestId,
        internalPath: `/internal/v1/community/help-requests/${encodeURIComponent(requestId)}`,
        method: "DELETE",
        intentBody: version,
        idempotencyKey: requiredIdempotencyKey(request),
        mutation: true,
        uncertainAfterDispatch: true,
        commandBody: (authorization) => ({
          operation: "delete",
          authorization,
          expectedVersion: version.expectedVersion,
        }),
        successSchema: CommunityHelpRequestDeleteSuccessSchema,
      });
    },
  );

  async function authorizeAndForward(
    request: FastifyRequest,
    reply: FastifyReply,
    input: {
      permission: CommunityPermission;
      householdId: string;
      requestId?: string;
      internalPath: string;
      method: "POST" | "DELETE";
      intentBody: unknown;
      idempotencyKey?: string;
      mutation?: boolean;
      uncertainAfterDispatch?: boolean;
      commandBody: (
        authorization: ReturnType<typeof CommunityAuthorizationContextSchema.parse>,
      ) => unknown;
      successSchema: {
        parse: (value: unknown) => unknown;
      };
    },
  ) {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    if (input.mutation && !validBrowserMutation(request, config.publicOrigin)) {
      return reply.code(403).send({
        error: {
          code: "ORIGIN_REJECTED",
          messageKey: "origin.rejected",
          retryable: false,
          correlationId,
        },
      });
    }

    const requestDigest = communityRequestDigest(
      input.method,
      input.internalPath,
      input.intentBody,
    );
    let decisionResponse: DependencyResponse;
    try {
      decisionResponse = await callIdentity(fetcher, config, request, correlationId, {
        permission: input.permission,
        householdId: input.householdId,
        ...(input.requestId ? { requestId: input.requestId } : {}),
        requestDigest,
      });
    } catch {
      return unavailable(reply, correlationId, logger, "IDENTITY_SERVICE_UNAVAILABLE");
    }
    if (decisionResponse.status >= 400) {
      if (![401, 403, 404].includes(decisionResponse.status)) {
        return unavailable(reply, correlationId, logger, "IDENTITY_SERVICE_UNAVAILABLE");
      }
      const identityCode = String(
        (decisionResponse.body as { error?: { code?: unknown } } | null)?.error?.code ?? "",
      );
      const revoked = identityCode === "COMMUNITY_CONSENT_REVOKED";
      return reply.code(403).send(communityAuthorityFailure(correlationId, revoked));
    }

    let authorization: ReturnType<typeof CommunityAuthorizationContextSchema.parse>;
    try {
      authorization = CommunityAuthorizationContextSchema.parse(
        (decisionResponse.body as { data?: unknown } | null)?.data,
      );
    } catch {
      return unavailable(reply, correlationId, logger, "IDENTITY_SERVICE_UNAVAILABLE");
    }
    if (
      authorization.permission !== input.permission ||
      authorization.householdId !== input.householdId ||
      authorization.requestDigest !== requestDigest ||
      authorization.requestId !== (input.requestId ?? null)
    ) {
      return unavailable(reply, correlationId, logger, "IDENTITY_SERVICE_UNAVAILABLE");
    }

    try {
      const response = await callCommunity(
        fetcher,
        config,
        input.internalPath,
        input.method,
        correlationId,
        input.commandBody(authorization),
        input.idempotencyKey,
      );
      const validated = validateDependencyResponse(response, input.successSchema);
      return reply.code(validated.status).send(validated.body);
    } catch {
      return unavailable(
        reply,
        correlationId,
        logger,
        input.uncertainAfterDispatch
          ? "COMMUNITY_REQUEST_RESULT_UNKNOWN"
          : "COMMUNITY_SERVICE_UNAVAILABLE",
      );
    }
  }
}

export function communityRequestDigest(
  method: string,
  exactInternalPath: string,
  intentBody: unknown,
): string {
  const canonical = canonicalJson(intentBody);
  return createHash("sha256")
    .update(`${method.toUpperCase()}\n${exactInternalPath}\n${canonical}`, "utf8")
    .digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as JsonRecord)[key])}`)
      .join(",")}}`;
  }
  throw new Error("COMMUNITY_DIGEST_VALUE_INVALID");
}

async function callCommunity(
  fetcher: Fetcher,
  config: CommunityGatewayConfig,
  path: string,
  method: "GET" | "POST" | "DELETE",
  correlationId: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<DependencyResponse> {
  const response = await fetcher(`${config.communityUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-correlation-id": correlationId,
      "x-internal-service-token": config.communityToken,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(2_500),
  });
  return { status: response.status, body: await safeJson(response) };
}

async function callIdentity(
  fetcher: Fetcher,
  config: CommunityGatewayConfig,
  request: FastifyRequest,
  correlationId: string,
  body: unknown,
): Promise<DependencyResponse> {
  const sessionToken = request.cookies[config.sessionCookieName];
  const csrfToken = String(request.headers["x-csrf-token"] ?? "");
  const response = await fetcher(`${config.identityUrl}/internal/v1/community/authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": correlationId,
      "x-internal-service-token": config.identityToken,
      "x-rate-limit-source": request.ip,
      ...(sessionToken ? { "x-session-token": sessionToken } : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2_500),
  });
  return { status: response.status, body: await safeJson(response) };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function validateDependencyResponse(
  response: DependencyResponse,
  successSchema: { parse: (value: unknown) => unknown },
): DependencyResponse {
  if (response.status >= 200 && response.status < 300) {
    return { status: response.status, body: successSchema.parse(response.body) };
  }
  return { status: response.status, body: CommunityFailureSchema.parse(response.body) };
}

function communityAuthorityFailure(correlationId: string, revoked: boolean) {
  return CommunityFailureSchema.parse({
    error: {
      code: revoked ? "COMMUNITY_CONSENT_REVOKED" : "COMMUNITY_AUTHORITY_REQUIRED",
      messageKey: revoked ? "community.consent.revoked" : "community.authority.required",
      retryable: false,
      correlationId,
    },
  });
}

function requiredIdempotencyKey(request: FastifyRequest): string {
  return IdempotencyKeySchema.parse(request.headers["idempotency-key"]);
}

function boundedOpaqueId(value: string): string {
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(value)) {
    throw new Error("COMMUNITY_REQUEST_ID_INVALID");
  }
  return value;
}

function validBrowserMutation(request: FastifyRequest, publicOrigin: string): boolean {
  const origin = String(request.headers.origin ?? "");
  const fetchSite = String(request.headers["sec-fetch-site"] ?? "");
  return origin === publicOrigin && (fetchSite === "same-origin" || fetchSite === "none");
}

function unavailable(
  reply: FastifyReply,
  correlationId: string,
  logger: SafeLogger,
  code:
    | "COMMUNITY_REQUEST_RESULT_UNKNOWN"
    | "COMMUNITY_SERVICE_UNAVAILABLE"
    | "DIRECTORY_SEARCH_UNAVAILABLE"
    | "IDENTITY_SERVICE_UNAVAILABLE",
) {
  logger.emit({
    level: "warn",
    eventName: "community.dependency.unavailable",
    operation: "community.request",
    result: "failed",
    correlationId,
    errorCode: code,
  });
  return reply.code(503).send({
    error: {
      code,
      messageKey:
        code === "COMMUNITY_REQUEST_RESULT_UNKNOWN"
          ? "community.request.result_unknown"
          : code === "DIRECTORY_SEARCH_UNAVAILABLE"
            ? "community.directory.search_unavailable"
            : code === "IDENTITY_SERVICE_UNAVAILABLE"
              ? "identity.unavailable"
              : "community.unavailable",
      retryable: code !== "COMMUNITY_REQUEST_RESULT_UNKNOWN",
      correlationId,
    },
  });
}
