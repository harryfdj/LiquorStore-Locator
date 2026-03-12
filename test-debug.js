import https from 'https';
import http from 'http';

function fetchUrl(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function bingImageSearch(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const html = await fetchUrl(url);
  
  // Bing stores image data in m attributes of <a> tags
  const mRegex = /<a[^>]*class="iusc"[^>]*m="([^"]+)"/gi;
  const matches = [...html.matchAll(mRegex)];
  
  const images = matches.map(m => {
    try {
      const data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      return {
        url: data.murl, // full resolution URL
        title: data.t || '',  // title
        domain: data.md || '', // domain
      };
    } catch { return null; }
  }).filter(Boolean);
  
  return images;
}

const query = '1800 Mango Margatita 1.75 Lt Single bottle';
console.log(`Query: ${query}\n`);

const results = await bingImageSearch(query);
console.log(`Found ${results.length} images from Bing\n`);

results.slice(0, 10).forEach((img, i) => {
  console.log(`${i+1}. "${img.title}"`);
  console.log(`   ${img.url?.substring(0, 100)}`);
  console.log('');
});
