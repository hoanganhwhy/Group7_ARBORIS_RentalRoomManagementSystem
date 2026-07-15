const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import { ErrorBoundary }')) {
  code = code.replace(
    /import \{ Sidebar \} from '\.\/components\/ui\/Sidebar';/,
    `import { ErrorBoundary } from './components/ErrorBoundary';\nimport { Sidebar } from './components/ui/Sidebar';`
  );
  
  code = code.replace(
    /<main className="flex-1 overflow-hidden bg-cream-50">\n\s*<div className="h-full overflow-y-auto">\n\s*\{renderPage\(\)\}\n\s*<\/div>\n\s*<\/main>/,
    `<main className="flex-1 overflow-hidden bg-cream-50">\n          <div className="h-full overflow-y-auto">\n            <ErrorBoundary>\n              {renderPage()}\n            </ErrorBoundary>\n          </div>\n        </main>`
  );

  fs.writeFileSync('src/App.tsx', code);
  console.log('Patched App.tsx with ErrorBoundary');
}
