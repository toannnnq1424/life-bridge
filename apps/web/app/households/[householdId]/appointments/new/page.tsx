import { AppointmentApp } from "../../../../../src/AppointmentApp";

export default async function NewAppointmentPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <AppointmentApp mode="create" householdId={householdId} />;
}
