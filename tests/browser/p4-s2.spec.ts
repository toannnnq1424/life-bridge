import { AxeBuilder } from "@axe-core/playwright";
import type { EmergencyPlanProjection } from "../../packages/contracts/src/index.js";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);

interface SyntheticState {
  mode: "ready" | "no_plan" | "denied" | "unavailable";
  mutationFailure: "conflict" | "uncertain" | null;
  listRevision: number;
  aggregateRevision: number;
  contacts: Array<{
    contactId: string;
    position: number;
    displayLabel: string;
    dialString: string;
    version: number;
  }>;
  plan: EmergencyPlanProjection;
  mutations: Array<{ method: string; path: string; body: Record<string, unknown> }>;
}

async function syntheticApi(page: Page): Promise<SyntheticState> {
  const state: SyntheticState = {
    mode: "ready",
    mutationFailure: null,
    listRevision: 1,
    aggregateRevision: 3,
    contacts: [
      {
        contactId: "contact_alpha",
        position: 1,
        displayLabel: "Synthetic contact A",
        dialString: "+66000000001",
        version: 1,
      },
      {
        contactId: "contact_beta",
        position: 2,
        displayLabel: "Synthetic contact B",
        dialString: "020000002",
        version: 1,
      },
    ],
    plan: reviewedPlan(),
    mutations: [],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/account/session") return json(route, 200, session());
    if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
    if (state.mode === "unavailable") return failure(route, 503, "SERVICE_UNAVAILABLE");

    if (path.endsWith("/emergency-contacts") && request.method() === "GET") {
      return json(route, 200, {
        state: state.contacts.length ? "configured" : "no_contacts",
        listRevision: state.listRevision,
        contacts: state.contacts,
        lastConfirmedAtUtc: "2026-07-28T04:00:00.000Z",
      });
    }
    if (path.endsWith("/emergency-contacts") && request.method() === "PUT") {
      const body = request.postDataJSON() as {
        contacts: Array<{ contactId?: string; displayLabel: string; dialString: string }>;
      };
      state.mutations.push({ method: request.method(), path, body });
      if (request.headers()["x-csrf-token"] !== csrf) {
        return failure(route, 403, "CSRF_REJECTED");
      }
      if (state.mutationFailure) return mutationFailure(route, state);
      state.listRevision += 1;
      state.aggregateRevision += 1;
      state.contacts = body.contacts.map((contact, index) => ({
        contactId: contact.contactId ?? `contact_new_${index}`,
        position: index + 1,
        displayLabel: contact.displayLabel,
        dialString: contact.dialString,
        version: 2,
      }));
      state.plan = {
        ...state.plan,
        state: "review_required",
        aggregateRevision: state.aggregateRevision,
      };
      return json(route, 200, {
        outcome: "contacts_replaced",
        listRevision: state.listRevision,
        contacts: state.contacts.map(({ contactId, position, version }) => ({
          contactId,
          position,
          version,
        })),
        planState: state.plan.state,
        confirmedAtUtc: "2026-07-28T04:05:00.000Z",
      });
    }
    if (path.endsWith("/emergency-plan") && request.method() === "GET") {
      return json(route, 200, state.mode === "no_plan" ? noPlan() : state.plan);
    }
    if (path.endsWith("/emergency-plan/draft") && request.method() === "PUT") {
      const body = request.postDataJSON() as { steps: string[] };
      state.mutations.push({ method: request.method(), path, body });
      if (state.mutationFailure) return mutationFailure(route, state);
      state.aggregateRevision += 1;
      state.plan = {
        ...state.plan,
        state: state.plan.current ? "review_required" : "draft_only",
        aggregateRevision: state.aggregateRevision,
        draft: {
          draftRevision: 1,
          basePlanVersion: state.plan.current?.planVersion ?? 0,
          contactListRevision: state.listRevision,
          steps: body.steps,
          updatedAtUtc: "2026-07-28T04:06:00.000Z",
        },
      };
      return json(route, 200, {
        outcome: "draft_saved",
        aggregateRevision: state.aggregateRevision,
        draftRevision: 1,
        planVersion: null,
        contactListRevision: state.listRevision,
        state: state.plan.state,
        confirmedAtUtc: "2026-07-28T04:06:00.000Z",
      });
    }
    if (path.endsWith("/emergency-plan/reviews") && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.mutations.push({ method: request.method(), path, body });
      if (state.mutationFailure) return mutationFailure(route, state);
      state.aggregateRevision += 1;
      state.plan = reviewedPlan({
        aggregateRevision: state.aggregateRevision,
        contactListRevision: state.listRevision,
        planVersion: (state.plan.current?.planVersion ?? 0) + 1,
      });
      return json(route, 200, {
        outcome: "version_reviewed",
        aggregateRevision: state.aggregateRevision,
        draftRevision: null,
        planVersion: state.plan.current!.planVersion,
        contactListRevision: state.listRevision,
        state: "reviewed",
        confirmedAtUtc: "2026-07-28T04:07:00.000Z",
      });
    }
    if (path.endsWith("/emergency-plan/offline-snapshot") && request.method() === "GET") {
      const current = state.plan.current!;
      return json(route, 200, {
        contractVersion: "P4-S2-offline-v1",
        source: "care-coordination",
        scopeBinding: "a".repeat(64),
        planVersion: current.planVersion,
        contactListRevision: current.contactListRevision,
        reviewedAtUtc: current.reviewedAtUtc,
        lastConfirmedAtUtc: "2026-07-28T04:00:00.000Z",
        displayTimeZone: current.displayTimeZone,
        displayLocalTime: current.displayLocalTime,
        displayUtcOffset: current.displayUtcOffset,
        freshUntilUtc: "2099-07-29T04:00:00.000Z",
        expiresAtUtc: "2099-07-31T04:00:00.000Z",
        contacts: state.contacts.map((contact) => ({
          contactId: contact.contactId,
          position: contact.position,
          displayLabel: contact.displayLabel,
          dialString: contact.dialString,
        })),
        steps: current.steps.map((text, index) => ({ position: index + 1, text })),
      });
    }
    return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
  });
  return state;
}

test("LB-020 keeps explicit order, validation, focus, and conflict recovery truthful", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/households/household_synthetic/emergency-contacts");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.locator(".emergency-safety").getByText(/rank urgency/)).toBeVisible();
  await page.getByRole("button", { name: "Move later" }).first().click();
  await expect(page.getByLabel("Display label").first()).toHaveValue("Synthetic contact B");
  await page.getByLabel("Configured phone number").first().fill("invalid");
  await page.getByRole("button", { name: "Review complete order" }).click();
  await expect(page.locator(".error-summary")).toContainText("Enter 3–15 digits");
  expect(api.mutations).toHaveLength(0);
  await page.getByLabel("Configured phone number").first().fill("+66000000002");
  await page.getByRole("button", { name: "Review complete order" }).click();
  await expect(page.getByRole("heading", { name: /not yet sent/ })).toBeFocused();
  api.mutationFailure = "conflict";
  await page.getByRole("button", { name: "Confirm complete contact list" }).click();
  await expect(page.getByRole("heading", { name: /confirmed state changed/ })).toBeFocused();
  expect(api.mutations).toHaveLength(1);
  expect(JSON.stringify(api.mutations[0])).not.toMatch(
    /diagnosis|urgency|availability|legal|professional|dispatch/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-021 distinguishes no-plan, denied, unavailable, and blocked offline writes", async ({
  context,
  page,
}) => {
  const api = await syntheticApi(page);
  api.mode = "no_plan";
  await page.goto("/households/household_synthetic/emergency-plan");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByText("No reviewed emergency plan is confirmed.")).toBeVisible();
  api.mode = "denied";
  await page.reload();
  await expect(page.getByRole("heading", { name: /lacks purpose-scoped authority/ })).toBeVisible();
  api.mode = "unavailable";
  await page.reload();
  await expect(page.getByRole("heading", { name: /service is unavailable/ })).toBeVisible();
  api.mode = "ready";
  await page.reload();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: "◇ Offline / Ngoại tuyến" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft on server" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Review and confirm version" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save encrypted copy on this device" }),
  ).toBeDisabled();
  expect(api.mutations).toHaveLength(0);
  await context.setOffline(false);
});

test("required LB-032 unlocks only a verified, timestamped offline copy", async ({
  context,
  page,
}) => {
  await syntheticApi(page);
  await page.goto("/households/household_synthetic/emergency-plan");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page
    .getByLabel("Offline passphrase (not your account password)")
    .fill("synthetic offline phrase");
  await page.getByRole("button", { name: "Save encrypted copy on this device" }).click();
  await expect(page.getByText(/encrypted copy was verified/)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) location.reload();
  });
  await page.waitForLoadState("domcontentloaded");
  await context.setOffline(true);
  await page.goto("/households/household_synthetic/emergency-plan");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Offline copy — not live" })).toBeVisible();
  await expect(page.locator("#protected-content")).toBeHidden();
  await page.locator("#passphrase").fill("synthetic offline phrase");
  await page.getByRole("button", { name: /Open copy|Mở bản sao/ }).click();
  await expect(page.getByText("Synthetic reviewed step")).toBeVisible();
  await expect(page.getByText(/Current permission and updates cannot be checked/i)).toBeVisible();
  await expect(page.getByText(/UTC 2026-07-28T04:00:00.000Z/)).toBeVisible();
  await expect(page.getByText(/does not dispatch emergency services/i).last()).toBeVisible();
  expect(await page.locator("a[href^='tel:']").count()).toBe(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifebridge-emergency-offline-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("encrypted-snapshots", "readwrite");
    const store = transaction.objectStore("encrypted-snapshots");
    const record = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = store.get("primary");
      request.onsuccess = () => resolve(request.result as Record<string, unknown>);
      request.onerror = () => reject(request.error);
    });
    record.ciphertext = `${String(record.ciphertext).slice(0, -1)}A`;
    store.put(record);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "English" }).click();
  await page.locator("#passphrase").fill("synthetic offline phrase");
  await page.getByRole("button", { name: "Open copy" }).click();
  await expect(page.getByText(/could not be verified.*removed/i)).toBeVisible();
  await expect(page.locator("#protected-content")).toBeHidden();
  await context.setOffline(false);
});

function reviewedPlan(
  overrides: {
    aggregateRevision?: number;
    contactListRevision?: number;
    planVersion?: number;
  } = {},
): EmergencyPlanProjection {
  const contactListRevision = overrides.contactListRevision ?? 1;
  return {
    state: "reviewed" as const,
    aggregateRevision: overrides.aggregateRevision ?? 3,
    contactListRevision,
    current: {
      planVersion: overrides.planVersion ?? 1,
      contactListRevision,
      steps: ["Synthetic reviewed step"],
      reviewedAtUtc: "2026-07-28T03:00:00.000Z",
      displayTimeZone: "Asia/Bangkok",
      displayLocalTime: "28 July 2026 at 10:00",
      displayUtcOffset: "+07:00",
    },
    draft: null as {
      draftRevision: number;
      basePlanVersion: number;
      contactListRevision: number;
      steps: string[];
      updatedAtUtc: string;
    } | null,
    lastConfirmedAtUtc: "2026-07-28T04:00:00.000Z",
  };
}

function noPlan() {
  return {
    state: "no_plan",
    aggregateRevision: 0,
    contactListRevision: 0,
    current: null,
    draft: null,
    lastConfirmedAtUtc: "2026-07-28T04:00:00.000Z",
  };
}

function session() {
  return {
    accountId: "account_synthetic",
    authorizationScope: "account",
    onboardingState: "complete",
    csrfToken: csrf,
    preferences: {
      locale: "en",
      textScale: "default",
      contrast: "system",
      motion: "reduce",
      version: 1,
    },
    session: {
      idleExpiresAt: "2099-07-28T05:00:00.000Z",
      absoluteExpiresAt: "2099-07-28T12:00:00.000Z",
    },
  };
}

async function mutationFailure(route: Route, state: SyntheticState) {
  const mode = state.mutationFailure;
  state.mutationFailure = null;
  return failure(
    route,
    mode === "conflict" ? 409 : 503,
    mode === "conflict" ? "EMERGENCY_CONTACT_LIST_VERSION_CONFLICT" : "SERVICE_UNAVAILABLE",
  );
}

async function json(route: Route, status: number, data?: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data, meta: { correlationId: "corr_browser_p4s2" } }),
  });
}

async function failure(route: Route, status: number, code: string) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code,
        messageKey: "errors.synthetic",
        retryable: status >= 500,
        correlationId: "corr_browser_p4s2",
      },
    }),
  });
}
