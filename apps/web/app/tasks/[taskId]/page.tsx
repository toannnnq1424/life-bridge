import { CareApp } from "../../../src/CareApp";

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <CareApp view="detail" householdId="hh_minh_an" taskId={taskId} />;
}
