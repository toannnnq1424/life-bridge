import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const packages: Record<string, string | null> = {
  web: "apps/web/package.json",
  gateway: "apps/gateway/package.json",
  "identity-consent": "services/identity-consent/package.json",
  "care-coordination": "services/care-coordination/package.json",
  notification: "services/notification/package.json",
  community: null,
};

export async function generateSboms(outputRoot: string, only?: string): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  for (const [artifact, packagePath] of Object.entries(packages)) {
    if (only && artifact !== only) continue;
    const components = packagePath ? await nodeComponents(packagePath) : await javaComponents();
    const bom = {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      version: 1,
      metadata: {
        component: { type: "application", name: `lifebridge-${artifact}`, version: "1.0.0" },
      },
      components,
    };
    await writeFile(
      resolve(outputRoot, `${artifact}.cdx.json`),
      `${JSON.stringify(bom, null, 2)}\n`,
    );
  }
}

async function nodeComponents(packagePath: string) {
  const pkg = JSON.parse(await readFile(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return Object.entries(pkg.dependencies ?? {})
    .filter(([, version]) => !version.startsWith("workspace:"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => ({
      type: "library",
      name,
      version,
      purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
    }));
}

async function javaComponents() {
  const pom = await readFile("services/community/pom.xml", "utf8");
  return [
    ...pom.matchAll(
      /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>/gu,
    ),
  ]
    .map((match) => ({ type: "library", group: match[1], name: match[2] }))
    .sort((a, b) => `${a.group}:${a.name}`.localeCompare(`${b.group}:${b.name}`));
}

if (process.argv[1] && basename(process.argv[1]).startsWith("p6-s2-sbom")) {
  await generateSboms(process.argv[2] ?? ".lifebridge-local/p6-s2/sbom", process.argv[3]);
}
