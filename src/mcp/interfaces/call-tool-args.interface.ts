import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface CallToolArgs {
  client: Client;
  name: string;
  args?: Record<string, unknown>;
}
