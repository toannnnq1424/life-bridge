import { EmergencyReadinessApp } from "../../../../src/EmergencyReadinessApp";

export default async function EmergencyPlanPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <EmergencyReadinessApp householdId={householdId} view="plan" />;
}
