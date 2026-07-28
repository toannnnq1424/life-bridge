import { MedicationReminderApp } from "../../../src/MedicationReminderApp";

export default async function MedicationReminderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reminderId: string }>;
  searchParams: Promise<{ householdId?: string }>;
}) {
  const [{ reminderId }, query] = await Promise.all([params, searchParams]);
  return (
    <MedicationReminderApp
      mode="detail"
      householdId={query.householdId ?? "household_demo"}
      reminderId={reminderId}
    />
  );
}
