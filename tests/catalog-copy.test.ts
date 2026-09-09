import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Fingerprints retain exact, case-sensitive substring protection without storing
// personal attribution in public test sources. No normalization is performed.
const PRIVATE_ATTRIBUTION = [{ length: 12, sha256: "1c5188a1f862fc6772e8651f4a3a4b99cdf50d4c690d5e476747a3752fbdb225" }];
export function containsPrivateAttribution(
  text: string,
  fingerprints: ReadonlyArray<{ length: number; sha256: string }> = PRIVATE_ATTRIBUTION,
): boolean {
  return fingerprints.some(({ length, sha256 }) => {
    for (let offset = 0; offset + length <= text.length; offset += 1) {
      const candidate = text.slice(offset, offset + length);
      if (createHash("sha256").update(candidate, "utf8").digest("hex") === sha256) {
        return true;
      }
    }
    return false;
  });
}


/** approved catalog copy (website#17). Use these strings exactly. */
export const CATALOG = {
  name: "Midkernel",
  blurb:
    "Scan a GitHub repository from your agent. Midkernel Scan runs an open workflow in an isolated sandbox and returns a report with the complete log. Credits meter the run.",
  skill:
    "Use this when the user wants to scan a repository for security issues with Midkernel Scan.",
  installConfirm:
    "Add the Midkernel connector? It lets this agent run Midkernel Scan on a GitHub repository you choose.",
  afterInstall:
    "Connect your Midkernel account, then pick a repository. The GitHub app is read-only. Then choose a workflow and a profile — `low`, `balanced`, or `max`. Credits are shown before a run starts. Optional `--threat <class>` pins an existing profile to a threat class; it is not a fourth profile.",
  micro: "Read-only GitHub app · credits per run · no write access",
} as const;

const skill = readFileSync("skills/scan-repo/SKILL.md", "utf8");
const manifest = readFileSync(".cursor-plugin/plugin.json", "utf8");
const readme = readFileSync("README.md", "utf8");

describe("signed catalog copy", () => {
  it("puts every signed string in SKILL.md", () => {
    expect(skill).toContain(CATALOG.name);
    expect(skill).toContain(CATALOG.blurb);
    expect(skill).toContain(CATALOG.skill);
    expect(skill).toContain(CATALOG.installConfirm);
    expect(skill).toContain(CATALOG.afterInstall);
    expect(skill).toContain(CATALOG.micro);
  });

  it("puts catalog name and blurb on the plugin manifest", () => {
    const parsed = JSON.parse(manifest) as { name: string; description: string; author: { name: string } };
    expect(parsed.author.name).toBe(CATALOG.name);
    expect(parsed.description).toBe(CATALOG.blurb);
    expect(parsed.name).toBe("midkernel");
  });

  it("puts install confirm, after install, and micro in the README", () => {
    expect(readme).toContain(CATALOG.installConfirm);
    expect(readme).toContain(CATALOG.afterInstall);
    expect(readme).toContain(CATALOG.micro);
    expect(readme).toContain(CATALOG.blurb);
    expect(readme).toContain(CATALOG.skill);
  });

  it("prefers security-review as the default Midkernel Scan playbook", () => {
    expect(skill).toContain("Prefer `security-review` as the default Midkernel Scan playbook");
    expect(skill).toContain("it runs `/security-review` one-shot");
    expect(readme).toMatch(/default playbook is `security-review` from the public registry/i);
  });

  it("documents the live Production Scan path without inventing prices", () => {
    expect(readme).toMatch(/v0 talks to \*\*midkernel\/app Scan APIs\*\*/i);
    expect(readme).toMatch(/Production Scan is live/i);
    expect(readme).toMatch(/app HTTP/i);
    expect(readme).toMatch(/ECS agentflow/i);
    expect(readme).toMatch(/report\.md/i);
    expect(readme).not.toMatch(/AWS ECS agentflow is still unissued/i);
    expect(readme).not.toMatch(/AWS-still-missing/i);
    expect(readme).not.toMatch(/Not a publish go/i);
    expect(skill).not.toMatch(/Not a publish go/i);
    expect(skill).not.toMatch(/AWS ECS agentflow is still unissued/i);
    expect(readme).toMatch(/Midkernel-as-AS/i);
    expect(readme).toContain("/oauth/authorize");
    expect(readme).toContain("/api/oauth/token");
    expect(readme).toContain("/api/oauth/register");
    expect(readme).toContain("/api/playbooks");
    expect(readme).toContain("https://www.cursor.com/agents/mcp/oauth/callback");
    expect(readme).toContain("https://www.cursor.com/bot/mcp/oauth/callback");
    expect(readme).toContain(".cursor-plugin/plugin.json");
    expect(readme).toContain("{MIDKERNEL_APP_URL}/mcp");
    expect(readme).not.toContain("http://localhost:8787/callback");
    expect(readme).not.toMatch(/accounts\.google\.com/);
  });

  it("does not invent prices or close website#17 from this stub", () => {
    const surfaces = [skill, manifest, readme];
    for (const text of surfaces) {
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/Fixes midkernel\/website#17/);
      expect(text).not.toMatch(/Closes midkernel\/website#17/);
      expect(containsPrivateAttribution(text)).toBe(false);
    }
  });
});


describe("private attribution fingerprint matching", () => {
  const synthetic = "Synthetic Contributor";
  const fingerprints = [{
    length: synthetic.length,
    sha256: createHash("sha256").update(synthetic, "utf8").digest("hex"),
  }];
  it("detects the exact synthetic text at every boundary", () => {
    for (const text of [synthetic, `prefix:${synthetic}`, `${synthetic}:suffix`, `🙂${synthetic}🙂`, `${synthetic}${synthetic}`]) {
      expect(containsPrivateAttribution(text, fingerprints)).toBe(true);
    }
  });
  it("preserves case-sensitive substring semantics and benign text", () => {
    for (const text of ["", "Synthetic", synthetic.toLowerCase(), "Synthetic  Contributor", "Project Contributor", "GitHub", "Claude"]) {
      expect(containsPrivateAttribution(text, fingerprints)).toBe(false);
    }
  });
});
