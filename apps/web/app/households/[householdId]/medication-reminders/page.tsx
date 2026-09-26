import { MedicationReminderApp } from "../../../../src/MedicationReminderApp";

export default async function MedicationReminderSchedulePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <MedicationReminderApp mode="schedule" householdId={householdId} />;
}
