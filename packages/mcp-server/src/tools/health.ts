import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuthError } from '@orderfood/shared';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);

export function registerHealthTools(server: McpServer): void {
  server.tool(
    'ping_platform',
    'Check whether a platform is reachable and credentials are valid. Returns { platform, status, latency_ms }. ' +
    'Call this when you receive auth or network errors to diagnose the issue before retrying a complex flow. ' +
    'status values: "ok" | "auth_error" | "error"',
    { platform: platformSchema },
    async ({ platform }) => {
      const start = Date.now();
      try {
        const client = getClient(platform);
        await client.getPaymentMethods();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ platform, status: 'ok', latency_ms: Date.now() - start }),
          }],
        };
      } catch (e: unknown) {
        const latency_ms = Date.now() - start;
        if (e instanceof AuthError) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                platform,
                status: 'auth_error',
                message: `Credentials missing or expired. Run: npx @henkas/orderfood setup --platform ${platform}`,
                latency_ms,
              }),
            }],
            isError: true,
          };
        }
        const err = e as { message?: string };
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              platform,
              status: 'error',
              message: err.message ?? String(e),
              latency_ms,
            }),
          }],
          isError: true,
        };
      }
    },
  );
}
