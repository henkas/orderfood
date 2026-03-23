import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, RateLimitError } from '@orderfood/shared';

// Mock getClient before importing the module under test
vi.mock('../src/config.js', () => ({
  getClient: vi.fn(),
}));

// We test the tool handler directly — extract it by capturing server.tool calls
import * as config from '../src/config.js';

// Minimal McpServer stub that captures registered tool handlers
function makeServerStub() {
  const handlers: Record<string, (params: Record<string, string>) => Promise<unknown>> = {};
  return {
    tool: (_name: string, _desc: string, _schema: unknown, handler: (p: Record<string, string>) => Promise<unknown>) => {
      handlers[_name] = handler;
    },
    handlers,
  };
}

describe('ping_platform', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns status ok when getPaymentMethods resolves', async () => {
    const mockClient = { getPaymentMethods: vi.fn().mockResolvedValue([]) };
    vi.mocked(config.getClient).mockReturnValue(mockClient as never);

    const { registerHealthTools } = await import('../src/tools/health.js');
    const server = makeServerStub();
    registerHealthTools(server as never);

    const result = await server.handlers['ping_platform']({ platform: 'ubereats' }) as { content: { text: string }[] };
    const body = JSON.parse(result.content[0].text);

    expect(body.status).toBe('ok');
    expect(body.platform).toBe('ubereats');
    expect(typeof body.latency_ms).toBe('number');
    expect((result as { isError?: boolean }).isError).toBeFalsy();
  });

  it('returns status auth_error when AuthError is thrown', async () => {
    const mockClient = {
      getPaymentMethods: vi.fn().mockRejectedValue(new AuthError('expired', 'AUTH_EXPIRED')),
    };
    vi.mocked(config.getClient).mockReturnValue(mockClient as never);

    const { registerHealthTools } = await import('../src/tools/health.js');
    const server = makeServerStub();
    registerHealthTools(server as never);

    const result = await server.handlers['ping_platform']({ platform: 'thuisbezorgd' }) as { content: { text: string }[]; isError: boolean };
    const body = JSON.parse(result.content[0].text);

    expect(body.status).toBe('auth_error');
    expect(body.message).toContain('npx @henkas/orderfood setup');
    expect(result.isError).toBe(true);
    expect(body.platform).toBe('thuisbezorgd');
  });

  it('returns status error for non-auth failures', async () => {
    const mockClient = {
      getPaymentMethods: vi.fn().mockRejectedValue(new Error('network timeout')),
    };
    vi.mocked(config.getClient).mockReturnValue(mockClient as never);

    const { registerHealthTools } = await import('../src/tools/health.js');
    const server = makeServerStub();
    registerHealthTools(server as never);

    const result = await server.handlers['ping_platform']({ platform: 'ubereats' }) as { content: { text: string }[]; isError: boolean };
    const body = JSON.parse(result.content[0].text);

    expect(body.status).toBe('error');
    expect(body.message).toBe('network timeout');
    expect(result.isError).toBe(true);
  });

  it('returns status rate_limited with retry_after when RateLimitError is thrown', async () => {
    const mockClient = {
      getPaymentMethods: vi.fn().mockRejectedValue(new RateLimitError('rate limited', 30)),
    };
    vi.mocked(config.getClient).mockReturnValue(mockClient as never);

    const { registerHealthTools } = await import('../src/tools/health.js');
    const server = makeServerStub();
    registerHealthTools(server as never);

    const result = await server.handlers['ping_platform']({ platform: 'ubereats' }) as { content: { text: string }[]; isError: boolean };
    const body = JSON.parse(result.content[0].text);

    expect(body.status).toBe('rate_limited');
    expect(body.retry_after).toBe(30);
    expect(result.isError).toBe(true);
  });
});
