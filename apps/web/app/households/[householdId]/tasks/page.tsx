import { CareApp } from "../../../../src/CareApp";

export default async function TasksPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  return <CareApp view="tasks" householdId={householdId} />;
}
