import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("midkernel MCP server running on stdio (scan infra unissued)");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
