import { DocumentVaultApp } from "../../../../src/DocumentVaultApp";

export default async function DocumentVaultPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <DocumentVaultApp householdId={householdId} />;
}
