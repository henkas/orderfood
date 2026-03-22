import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerCartTools } from './tools/cart.js';
import { registerOrderTools } from './tools/orders.js';
import { registerAccountTools } from './tools/account.js';

const server = new McpServer({
  name: 'orderfood',
  version: '0.1.0',
});

registerDiscoveryTools(server);
registerCartTools(server);
registerOrderTools(server);
registerAccountTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
