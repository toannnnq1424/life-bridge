import { ConsentPrivacyApp } from "../../src/ConsentPrivacyApp";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const { householdId } = await searchParams;
  const safeHouseholdId =
    householdId && /^[a-z][a-z0-9_-]{2,79}$/.test(householdId) ? householdId : undefined;
  return (
    <ConsentPrivacyApp
      view="settings"
      {...(safeHouseholdId ? { householdId: safeHouseholdId } : {})}
    />
  );
}
