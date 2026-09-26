import { MedicationReminderApp } from "../../../src/MedicationReminderApp";

export default async function MedicationReminderNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const query = await searchParams;
  return (
    <MedicationReminderApp
      mode="notifications"
      householdId={query.householdId ?? "household_demo"}
    />
  );
}
