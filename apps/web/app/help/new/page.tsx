import { HelpRequestApp } from "../../../src/CommunityApp";

export default async function NewHelpRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const { householdId } = await searchParams;
  const safeHouseholdId =
    householdId && /^[A-Za-z0-9_-]{8,128}$/u.test(householdId) ? householdId : "";
  return <HelpRequestApp householdId={safeHouseholdId} />;
}
