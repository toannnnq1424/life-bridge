import { MatchCoordinationApp } from "../../src/MatchCoordinationApp";

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string; organizationId?: string }>;
}) {
  const params = await searchParams;
  return (
    <MatchCoordinationApp
      view="volunteer"
      householdId={safeId(params.householdId)}
      organizationId={safeId(params.organizationId)}
    />
  );
}

function safeId(value?: string) {
  return value && /^[A-Za-z0-9_-]{8,128}$/u.test(value) ? value : "";
}
