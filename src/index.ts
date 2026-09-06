import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isScanApiConfigured, readPluginConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = readPluginConfig();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const mode = isScanApiConfigured(config)
    ? "midkernel app Scan API configured"
    : "midkernel app Scan API not configured (no invented runs)";
  console.error(`midkernel MCP server running on stdio (${mode})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
