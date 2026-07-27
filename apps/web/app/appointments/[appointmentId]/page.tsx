import { AppointmentApp } from "../../../src/AppointmentApp";

export default async function AppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ householdId?: string }>;
}) {
  const [{ appointmentId }, query] = await Promise.all([params, searchParams]);
  return (
    <AppointmentApp
      mode="detail"
      householdId={query.householdId ?? "household_demo"}
      appointmentId={appointmentId}
    />
  );
}
