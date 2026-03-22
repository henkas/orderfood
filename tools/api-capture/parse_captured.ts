import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface CapturedEntry {
  method: string;
  url: string;
  request_headers: Record<string, string>;
  request_body: string;
  response_status: number | null;
  response_body: string;
}

export interface EndpointGroup {
  method: string;
  pattern: string;
  examples: CapturedEntry[];
}

/** Replace UUID and long-numeric path segments with {id}. */
export function toPattern(url: string): string {
  return url
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '{id}',
    )
    .replace(/(\/|=)[0-9]{5,}/g, (m, sep) => `${sep}{id}`);
}

/** Group entries by "METHOD normalized-url-pattern". */
export function groupByPattern(
  entries: CapturedEntry[],
): Map<string, EndpointGroup> {
  const groups = new Map<string, EndpointGroup>();
  for (const entry of entries) {
    const pattern = toPattern(entry.url);
    const key = `${entry.method} ${pattern}`;
    if (!groups.has(key)) {
      groups.set(key, { method: entry.method, pattern, examples: [] });
    }
    groups.get(key)!.examples.push(entry);
  }
  return groups;
}

/** Render grouped endpoints as a markdown reference document. */
export function renderMarkdown(
  platform: string,
  groups: Map<string, EndpointGroup>,
): string {
  const lines: string[] = [
    `# ${platform} API Reference`,
    '',
    `> Auto-generated from mitmproxy capture. ${groups.size} unique endpoint patterns.`,
    '',
  ];

  for (const [key, group] of [...groups.entries()].sort()) {
    const ex = group.examples[0];
    lines.push(`## \`${key}\``);
    lines.push('');
    lines.push(`**Captured calls:** ${group.examples.length}`);
    lines.push(`**Status:** ${ex.response_status ?? 'unknown'}`);
    lines.push('');

    if (ex.request_body && ex.request_body !== '<binary>') {
      lines.push('**Request body (first example):**');
      lines.push('```json');
      try {
        lines.push(JSON.stringify(JSON.parse(ex.request_body), null, 2));
      } catch {
        lines.push(ex.request_body.slice(0, 500));
      }
      lines.push('```');
      lines.push('');
    }

    if (ex.response_body && ex.response_body !== '<binary>') {
      lines.push('**Response body (first example):**');
      lines.push('```json');
      try {
        lines.push(
          JSON.stringify(JSON.parse(ex.response_body), null, 2).slice(0, 2000),
        );
      } catch {
        lines.push(ex.response_body.slice(0, 500));
      }
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export async function loadEntries(inputDir: string): Promise<CapturedEntry[]> {
  const files = await readdir(inputDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  const entries = await Promise.all(
    jsonFiles.map(async (f) => {
      const raw = await readFile(join(inputDir, f), 'utf-8');
      return JSON.parse(raw) as CapturedEntry;
    }),
  );
  return entries;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const outputIdx = args.indexOf('--output');

  if (inputIdx === -1 || outputIdx === -1) {
    console.error(
      'Usage: tsx parse_captured.ts --input <dir> --output <file.md>',
    );
    process.exit(1);
  }

  const inputDir = args[inputIdx + 1];
  const outputFile = args[outputIdx + 1];
  const platformGuess =
    inputDir
      .split('/')
      .find((p) => ['ubereats', 'thuisbezorgd'].includes(p)) ?? 'unknown';

  const entries = await loadEntries(inputDir);
  console.log(`Loaded ${entries.length} captured entries`);

  const groups = groupByPattern(entries);
  console.log(`Found ${groups.size} unique endpoint patterns`);

  const markdown = renderMarkdown(platformGuess, groups);
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, markdown, 'utf-8');
  console.log(`Written to ${outputFile}`);
}

// Run as CLI only when executed directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch(console.error);
}
