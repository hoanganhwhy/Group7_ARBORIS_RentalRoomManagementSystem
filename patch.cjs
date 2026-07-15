const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(/const BASE_URL = .*/, `const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function buildQueryString(params?: Record<string, any>) {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? '?' + queryString : '';
}

function getHeaders() {
  return { 'Content-Type': 'application/json' };
}

export function getImageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return 'http://localhost:5000' + path;
}`);

code = code.replace(/async function request<T>\(path: string, options: RequestInit = \{\}\): Promise<T> \{\n  const headers = \{\n    'Content-Type': 'application\/json',\n    \.\.\.\(options\.headers \|\| \{\}\),\n  \};/, `async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: any = {
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }`);

code = code.replace(/export async function createRoom\(room: Partial<Room>\): Promise<Room> \{\n  return request<Room>\('\/rooms', \{\n    method: 'POST',\n    body: JSON\.stringify\(room\),\n  \}\);\n\}/, `export async function createRoom(room: Partial<Room> | FormData): Promise<Room> {
  return request<Room>('/rooms', {
    method: 'POST',
    body: room instanceof FormData ? room : JSON.stringify(room),
  });
}`);

code = code.replace(/export async function updateRoom\(id: string, room: Partial<Room>\): Promise<Room> \{\n  return request<Room>\(`\/\/rooms\/\\${id}`\, \{\n    method: 'PUT',\n    body: JSON\.stringify\(room\),\n  \}\);\n\}/, `export async function updateRoom(id: string, room: Partial<Room> | FormData): Promise<Room> {
  return request<Room>(\`/rooms/\${id}\`, {
    method: 'PUT',
    body: room instanceof FormData ? room : JSON.stringify(room),
  });
}`);

code = code.replace(/export async function loginUser\(data: any\): Promise<any> \{\n  return request<any>\('\/auth\/login', \{\n    method: 'POST',\n    body: JSON\.stringify\(data\)\n  \}\);\n\}/, `export async function loginUser(data: any): Promise<any> {
  return request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<any> {
  return request<any>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword })
  });
}`);

code = code.replace(/recentRepairs: repairs\.slice\(0, 5\),\n\s*recentInvoices: invoices\.slice\(0, 5\),/, `recentRepairs: repairs.filter(r => r.status !== 'closed').slice(0, 5),
    recentInvoices: invoices.filter(i => i.status !== 'paid').slice(0, 5),`);

code = code.replace(/const query = params \? `\?\\$\\{new URLSearchParams\(params as any\)\.toString\(\)\}` : '';/g, `const query = buildQueryString(params);`);
code = code.replace(/const query = `\?\\$\\{new URLSearchParams\(queryParams\)\.toString\(\)\}`;/g, `const query = buildQueryString(queryParams);`);
code = code.replace(/const query = new URLSearchParams\(queryParams\)\.toString\(\);/g, `const query = buildQueryString(queryParams).replace(/^\\?/, '');`);

fs.writeFileSync('src/lib/api.ts', code);
console.log('Done!');
