import { HouseholdAccessApp } from "../../../../src/HouseholdAccessApp";

export default async function HouseholdInvitationsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <HouseholdAccessApp initialScreen="invitations" householdId={householdId} />;
}
