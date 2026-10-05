import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cursorManifest = JSON.parse(readFileSync(".cursor-plugin/plugin.json", "utf8")) as {
  description: string;
};

const HOSTED_MCP = "https://www.midkernel.com/app/mcp";
const DOCS = "https://midkernel.com/docs/mcp";
const BLURB = cursorManifest.description;
const NAME_PATTERN = /^(?!.*(?:--|\\.\\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const TOOLS = ["connect_repo", "list_playbooks", "start_run", "fetch_run"] as const;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("ChatGPT, Codex, and Claude packaging", () => {
  it("keeps the signed skill and catalog blurb on every platform package", () => {
    const canonical = read("skills/scan-repo/SKILL.md");
    for (const dir of ["platforms/chatgpt", "platforms/codex", "platforms/claude"]) {
      expect(read(`${dir}/skills/scan-repo/SKILL.md`)).toBe(canonical);
      expect(read(`${dir}/README.md`)).toContain(DOCS);
      expect(read(`${dir}/README.md`)).toContain(HOSTED_MCP);
      for (const tool of TOOLS) {
        expect(read(`${dir}/README.md`)).toContain(tool);
      }
    }
  });

  it("points portable ChatGPT and Codex mcp.json at the hosted Scan MCP", () => {
    for (const path of ["platforms/chatgpt/mcp.json", "platforms/codex/mcp.json"]) {
      const mcp = readJson(path);
      expect(mcp.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
      const servers = mcp.mcpServers as Record<string, { type: string; url: string }>;
      expect(Object.keys(servers)).toEqual(["midkernel"]);
      expect(servers.midkernel.type).toBe("streamable-http");
      expect(servers.midkernel.url).toBe(HOSTED_MCP);
      expect(Object.keys(servers.midkernel).sort()).toEqual(["type", "url"]);
    }
  });

  it("uses the Agent Plugins manifest for ChatGPT and Codex", () => {
    const chatgpt = readJson("platforms/chatgpt/plugin.json");
    const codex = readJson("platforms/codex/plugin.json");
    for (const manifest of [chatgpt, codex]) {
      expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
      expect(manifest.version).toBe("0.1.0");
      expect(manifest.description).toBe(BLURB);
      expect(manifest.homepage).toBe(DOCS);
      expect(NAME_PATTERN.test(String(manifest.name))).toBe(true);
      const extensions = manifest.extensions as {
        "com.openai": { interface: Record<string, unknown> };
      };
      const iface = extensions["com.openai"].interface;
      expect(iface.displayName).toBe("Midkernel");
      expect(iface.developerName).toBe("Midkernel");
      expect(iface.category).toBe("Security");
      expect(iface.longDescription).toBe(BLURB);
      expect(String(iface.shortDescription).length).toBeLessThanOrEqual(30);
      expect(iface.websiteURL).toBe(DOCS);
      expect(iface.logo).toBe("./assets/icon.png");
      expect(iface.composerIcon).toBe("./assets/icon.png");
      expect(iface.privacyPolicyURL).toBe("https://www.midkernel.com/legal/privacy");
      expect(iface.termsOfServiceURL).toBe("https://www.midkernel.com/legal/terms");
      expect(manifest).not.toHaveProperty("apps");
    }
    expect(chatgpt.name).toBe("midkernel");
    expect(codex.name).toBe("midkernel-codex");
  });

  it("keeps the Codex compatibility layout on .mcp.json type http", () => {
    const overlay = readJson("platforms/codex/.codex-plugin/plugin.json");
    expect(overlay.name).toBe("midkernel-codex");
    expect(overlay.skills).toBe("./skills/");
    expect(overlay.mcpServers).toBe("./.mcp.json");
    expect(overlay).not.toHaveProperty("apps");
    expect(overlay.description).toBe(BLURB);
    const iface = overlay.interface as Record<string, unknown>;
    expect(iface.displayName).toBe("Midkernel");
    expect(iface.category).toBe("Security");
    expect(iface.privacyPolicyURL).toBe("https://www.midkernel.com/legal/privacy");
    expect(iface.termsOfServiceURL).toBe("https://www.midkernel.com/legal/terms");

    const mcp = readJson("platforms/codex/.mcp.json");
    const servers = mcp.mcpServers as Record<string, { type: string; url: string }>;
    expect(servers.midkernel.type).toBe("http");
    expect(servers.midkernel.url).toBe(HOSTED_MCP);

    const example = read("platforms/codex/config.example.toml");
    expect(example).toContain('url = "https://www.midkernel.com/app/mcp"');
    expect(example).toContain("[mcp_servers.midkernel]");
  });

  it("packages Claude Code as an HTTP plugin against the hosted MCP", () => {
    const manifest = readJson("platforms/claude/.claude-plugin/plugin.json");
    expect(manifest.name).toBe("midkernel");
    expect(manifest.displayName).toBe("Midkernel");
    expect(manifest.description).toBe(BLURB);
    expect(manifest.homepage).toBe(DOCS);
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.mcpServers).toBe("./.mcp.json");

    const mcp = readJson("platforms/claude/.mcp.json");
    const servers = mcp.mcpServers as Record<
      string,
      { type: string; url: string; oauth: { scopes: string } }
    >;
    expect(servers.midkernel.type).toBe("http");
    expect(servers.midkernel.url).toBe(HOSTED_MCP);
    expect(servers.midkernel.oauth.scopes).toBe("scan");

    const marketplace = readJson(".claude-plugin/marketplace.json");
    expect(marketplace.name).toBe("midkernel");
    const plugins = marketplace.plugins as Array<{ name: string; source: string }>;
    expect(plugins).toEqual([
      expect.objectContaining({ name: "midkernel", source: "./platforms/claude" }),
    ]);
  });

  it("lists ChatGPT and Codex in the repo marketplace", () => {
    const marketplace = readJson(".agents/plugins/marketplace.json");
    expect(marketplace.name).toBe("midkernel");
    const plugins = marketplace.plugins as Array<{
      name: string;
      source: { path: string };
      policy: { installation: string; authentication: string };
      category: string;
    }>;
    expect(plugins.map((plugin) => plugin.name)).toEqual(["midkernel", "midkernel-codex"]);
    expect(plugins[0].source.path).toBe("./platforms/chatgpt");
    expect(plugins[1].source.path).toBe("./platforms/codex");
    for (const plugin of plugins) {
      expect(plugin.policy.installation).toBe("AVAILABLE");
      expect(plugin.policy.authentication).toBe("ON_INSTALL");
      expect(plugin.category).toBe("Security");
    }
  });

  it("records only verified exact redirect URIs", () => {
    const record = readJson("platforms/oauth-redirects.json");
    const exact = (record.exact_redirect_uris as Array<{ uri: string }>).map((entry) => entry.uri);
    expect(exact).toEqual([
      "https://chatgpt.com/connector_platform_oauth_redirect",
      "https://claude.ai/api/mcp/auth_callback",
    ]);
    const templates = record.redirect_templates as Array<{ template: string; prefix?: string }>;
    expect(templates.map((entry) => entry.template)).toEqual([
      "https://chatgpt.com/connector/oauth/{callback_id}",
      "http://127.0.0.1/callback",
      "http://127.0.0.1/callback/{callback_id}",
      "http://localhost/callback",
      "http://127.0.0.1/callback",
    ]);
    expect(templates[0].prefix).toBe("https://chatgpt.com/connector/oauth/");
    const serialized = JSON.stringify(record);
    expect(serialized).not.toMatch(/connector\/oauth\/[a-zA-Z0-9]{6,}/);
    expect(serialized).not.toContain("http://localhost:8787/callback");
    expect(serialized).not.toContain("http://localhost:3118/callback");

    const doc = read("platforms/OAUTH-REDIRECTS.md");
    expect(doc).toContain("https://chatgpt.com/connector_platform_oauth_redirect");
    expect(doc).toContain("https://claude.ai/api/mcp/auth_callback");
    expect(doc).toContain("https://chatgpt.com/connector/oauth/{callback_id}");
    expect(doc).toContain(DOCS);
    expect(doc).toContain("app#260");
    expect(read("README.md")).toContain(DOCS);
    expect(read("README.md")).toContain("platforms/OAUTH-REDIRECTS.md");
  });
});
