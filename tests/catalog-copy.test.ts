import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** James-signed catalog copy (website#17). Use these strings exactly. */
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

  it("documents the real app path vs AWS-still-missing without inventing prices", () => {
    expect(readme).toMatch(/v0 talks to \*\*midkernel\/app Scan APIs\*\*/i);
    expect(readme).toMatch(/AWS ECS agentflow is still unissued/i);
    expect(readme).toMatch(/Midkernel-as-AS/i);
    expect(readme).toContain("/oauth/authorize");
    expect(readme).not.toMatch(/accounts\.google\.com/);
  });

  it("does not invent prices or close website#17 from this stub", () => {
    const surfaces = [skill, manifest, readme];
    for (const text of surfaces) {
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/Fixes midkernel\/website#17/);
      expect(text).not.toMatch(/Closes midkernel\/website#17/);
      expect(text).not.toMatch(/James Miller/);
    }
  });
});
