import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);
function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }], isError: true };
}

export function registerAccountTools(server: McpServer): void {
  server.tool(
    'get_saved_addresses',
    'List saved delivery addresses for the authenticated account on the specified platform.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        const result = await getClient(platform).getSavedAddresses();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'get_payment_methods',
    'List saved payment methods for the authenticated account. Use the returned id values when calling place_order.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        const result = await getClient(platform).getPaymentMethods();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );
}
