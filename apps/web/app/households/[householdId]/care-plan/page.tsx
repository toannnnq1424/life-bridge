import { CarePlanApp } from "../../../../src/CarePlanApp";

export default async function CarePlanPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <CarePlanApp householdId={householdId} />;
}
