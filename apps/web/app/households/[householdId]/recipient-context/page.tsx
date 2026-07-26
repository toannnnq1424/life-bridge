import { HouseholdAccessApp } from "../../../../src/HouseholdAccessApp";

export default async function RecipientContextPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <HouseholdAccessApp initialScreen="context" householdId={householdId} />;
}
