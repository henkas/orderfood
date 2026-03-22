import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);
function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }], isError: true };
}

export function registerOrderTools(server: McpServer): void {
  server.tool(
    'place_order',
    'Place the current cart as a delivery order to the specified address using the specified payment method. Returns the created order.',
    {
      platform: platformSchema,
      address_id: z.string().describe('Address ID from get_saved_addresses, or a free-form address string'),
      payment_method_id: z.string().describe('Payment method UUID from get_payment_methods'),
    },
    async ({ platform, address_id, payment_method_id }) => {
      try {
        const result = await getClient(platform).placeOrder(address_id, payment_method_id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'track_order',
    'Get the current delivery status of an order.',
    { platform: platformSchema, order_id: z.string() },
    async ({ platform, order_id }) => {
      try {
        const result = await getClient(platform).trackOrder(order_id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'get_order_history',
    'Retrieve past orders for the authenticated account on the specified platform.',
    {
      platform: platformSchema,
      limit: z.number().int().min(1).max(50).optional().default(10),
    },
    async ({ platform, limit }) => {
      try {
        const result = await getClient(platform).getOrderHistory(limit);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'cancel_order',
    'Cancel an order if it is still within the cancellable window. Throws if cancellation is no longer possible.',
    { platform: platformSchema, order_id: z.string() },
    async ({ platform, order_id }) => {
      try {
        await getClient(platform).cancelOrder(order_id);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );
}
