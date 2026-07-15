const fs = require('fs');

let code = fs.readFileSync('src/lib/api.ts', 'utf8');

// Insert buildQueryString function
if (!code.includes('export function buildQueryString')) {
  code = code.replace(
    /export const BASE_URL = .*;/,
    `$&

export function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const cleanParams: Record<string, string> = {};
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = String(params[key]);
    }
  }
  const str = new URLSearchParams(cleanParams).toString();
  return str ? '?' + str : '';
}
`
  );
}

// Replace occurrences
code = code.replace(/const query = params \? `\?\$\{new URLSearchParams\(params as any\)\.toString\(\)\}` : '';/g, 'const query = buildQueryString(params);');

code = code.replace(/const query = `\?\$\{new URLSearchParams\(queryParams\)\.toString\(\)\}`;/g, 'const query = buildQueryString(queryParams);');

code = code.replace(/const query = new URLSearchParams\(queryParams\)\.toString\(\);/g, 'const query = buildQueryString(queryParams).replace(/^\\?/, "");');

fs.writeFileSync('src/lib/api.ts', code);
console.log('Patched api.ts successfully');
