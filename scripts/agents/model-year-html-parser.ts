import { createRequire } from 'node:module';
import type { HtmlParser } from '@compra-car/adapter-webmotors';
/** Composition-root bridge to the installed node-html-parser bundle. No HTML is executed.
 * Reuses the monorepo's pinned Next parser, keeping the provider/core independent of Next.
 */
export function modelYearHtmlParser(): HtmlParser {
  const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
  const parser = require('next/dist/compiled/node-html-parser') as { parse: HtmlParser };
  return parser.parse;
}
