import { ConsentPrivacyApp } from "../../../../src/ConsentPrivacyApp";

export default async function AuditPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  return <ConsentPrivacyApp view="audit" householdId={householdId} />;
}
