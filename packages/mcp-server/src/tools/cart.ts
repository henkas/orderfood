import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);

function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }],
    isError: true,
  };
}

export function registerCartTools(server: McpServer): void {
  server.tool(
    'get_cart',
    'Get the current cart state on the specified platform, including items, quantities, selected options, and price totals. Returns null if the cart is empty.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        const result = await getClient(platform).getCart();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'add_to_cart',
    'Add a menu item to the cart on the specified platform. Provide option selections as { group_id, option_id } pairs. Required option groups must be satisfied.',
    {
      platform: platformSchema,
      restaurant_id: z.string(),
      item_id: z.string(),
      quantity: z.number().int().min(1),
      options: z.array(z.object({ group_id: z.string(), option_id: z.string() })).optional(),
    },
    async ({ platform, restaurant_id, item_id, quantity, options }) => {
      try {
        const result = await getClient(platform).addToCart(restaurant_id, item_id, quantity, options);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'clear_cart',
    'Remove all items from the cart on the specified platform.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        await getClient(platform).clearCart();
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );
}
