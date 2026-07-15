const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  
  // Try to login if we can
  try {
    await page.waitForSelector('input[type="text"]', { timeout: 2000 });
    await page.type('input[type="text"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
  } catch (e) {
    console.log('Login skip:', e.message);
  }

  // Click on 'Tài khoản KH'
  try {
    const texts = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      return links.map(l => l.innerText);
    });
    console.log('Available links:', texts);

    // Let's just click the link with text 'Tài khoản KH'
    const linkHandlers = await page.$x("//button[contains(text(), 'Tài khoản KH')] | //a[contains(text(), 'Tài khoản KH')] | //*[contains(text(), 'Tài khoản KH')]");
    if (linkHandlers.length > 0) {
      await linkHandlers[0].click();
      await page.waitForTimeout(2000); // Wait for render
    }
  } catch (e) {
    console.log('Click error:', e.message);
  }

  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('BODY HTML:', bodyHTML.substring(0, 500));

  await browser.close();
})();
