import { ConsentPrivacyApp } from "../../../../src/ConsentPrivacyApp";

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <ConsentPrivacyApp view="consent" householdId={householdId} />;
}
