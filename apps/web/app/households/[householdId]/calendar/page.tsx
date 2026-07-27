import { AppointmentApp } from "../../../../src/AppointmentApp";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <AppointmentApp mode="calendar" householdId={householdId} />;
}
