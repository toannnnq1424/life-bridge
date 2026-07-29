import { ModerationResolutionApp } from "../../../src/ModerationResolutionApp";

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string; moderatorEnrollmentId?: string }>;
}) {
  const params = await searchParams;
  return (
    <ModerationResolutionApp
      householdId={safeId(params.householdId)}
      moderatorEnrollmentId={safeId(params.moderatorEnrollmentId)}
    />
  );
}

function safeId(value?: string) {
  return value && /^[A-Za-z0-9_-]{8,128}$/u.test(value) ? value : "";
}
