import { CoordinationApp } from "../../../../src/CoordinationApp";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <CoordinationApp mode="timeline" householdId={householdId} />;
}
