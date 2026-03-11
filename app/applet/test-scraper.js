import Scraper from 'images-scraper';

const google = new Scraper({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

(async () => {
  try {
    const results = await google.scrape('Aristocrat Gin 1.75L', 5);
    console.log('SUCCESS:', results);
  } catch (e) {
    console.error('ERROR:', e);
  }
  process.exit(0);
})();
