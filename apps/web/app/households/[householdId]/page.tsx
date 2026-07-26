import { CareApp } from "../../../src/CareApp";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <CareApp view="dashboard" householdId={householdId} />;
}
