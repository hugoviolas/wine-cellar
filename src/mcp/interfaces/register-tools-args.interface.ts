import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './tool-context.interface';

export interface RegisterToolsArgs {
  server: McpServer;
  context: ToolContext;
}
