const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if (!response.ok()) console.log('HTTP ERROR:', response.url(), response.status());
  });

  try {
    await page.goto('http://localhost:5173/login');
    // Login
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('Logged in. Current URL:', page.url());
    
    // Check if there is an error boundary element or white screen
    const html = await page.evaluate(() => document.body.innerHTML);
    if (html.includes('Đã có lỗi xảy ra')) {
      console.log('ErrorBoundary triggered!');
    } else if (html.length < 1000) {
      console.log('Possible white screen:', html);
    } else {
      console.log('Page loaded properly.');
    }
  } catch (err) {
    console.error('Script error:', err.message);
  } finally {
    await browser.close();
  }
})();
