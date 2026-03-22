import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);

export function registerDiscoveryTools(server: McpServer): void {
  server.tool(
    'search_restaurants',
    'Search for restaurants on the specified food delivery platform near a location. Optionally filter by cuisine type or keyword, and sort results.',
    {
      platform: platformSchema,
      location: z.string().describe('Delivery address, e.g. "Amsterdam Centraal"'),
      cuisine: z.string().optional().describe('Cuisine filter, e.g. "Italian"'),
      query: z.string().optional().describe('Free-text keyword search'),
      sort_by: z.enum(['rating', 'delivery_time', 'delivery_fee']).optional(),
    },
    async ({ platform, location, cuisine, query, sort_by }) => {
      try {
        const client = getClient(platform);
        const results = await client.searchRestaurants({ location, cuisine, query, sort_by });
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      } catch (e: unknown) {
        return errorResponse(e);
      }
    },
  );

  server.tool(
    'get_restaurant',
    'Get full details for a restaurant including its categorized menu, item prices, and modifier option groups.',
    {
      platform: platformSchema,
      restaurant_id: z.string(),
    },
    async ({ platform, restaurant_id }) => {
      try {
        const client = getClient(platform);
        const result = await client.getRestaurant(restaurant_id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) {
        return errorResponse(e);
      }
    },
  );
}

function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }],
    isError: true,
  };
}
