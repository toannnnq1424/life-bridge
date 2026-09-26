import { CoordinationApp } from "../../../../../src/CoordinationApp";

export default async function HandoffTaskPage({
  params,
}: {
  params: Promise<{ householdId: string; taskId: string }>;
}) {
  const { householdId, taskId } = await params;
  return <CoordinationApp mode="handoff" householdId={householdId} taskId={taskId} />;
}
