const fs = require('fs');

let code = fs.readFileSync('src/lib/api.ts', 'utf8');

// Fix 1: URLSearchParams -> buildQueryString
code = code.replace(/const query = params \? `\?\$\{new URLSearchParams\(params as any\)\.toString\(\)\}` : '';/g, 'const query = buildQueryString(params);');

// Fix 2: request Content-Type handling for FormData
code = code.replace(
  /async function request<T>\(path: string, options: RequestInit = \{\}\): Promise<T> \{\n  const headers = \{\n    'Content-Type': 'application\/json',\n    \.\.\.\(options\.headers \|\| \{\}\),\n  \};/,
  `async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }`
);

// Fix 3: createRoom and updateRoom
code = code.replace(
  /export async function createRoom\(room: Partial<Room>\): Promise<Room> \{\n  return request<Room>\('\/rooms', \{\n    method: 'POST',\n    body: JSON\.stringify\(room\),\n  \}\);\n\}/,
  `export async function createRoom(room: FormData | Partial<Room>): Promise<Room> {
  const isFormData = room instanceof FormData;
  return request<Room>('/rooms', {
    method: 'POST',
    body: isFormData ? (room as FormData) : JSON.stringify(room),
  });
}`
);

code = code.replace(
  /export async function updateRoom\(id: string, room: Partial<Room>\): Promise<Room> \{\n  return request<Room>\(`\/rooms\/\$\{id\}`\, \{\n    method: 'PUT',\n    body: JSON\.stringify\(room\),\n  \}\);\n\}/,
  `export async function updateRoom(id: string, room: FormData | Partial<Room>): Promise<Room> {
  const isFormData = room instanceof FormData;
  return request<Room>(\`/rooms/\${id}\`, {
    method: 'PUT',
    body: isFormData ? (room as FormData) : JSON.stringify(room),
  });
}`
);

fs.writeFileSync('src/lib/api.ts', code);
console.log('Done patching api.ts!');
