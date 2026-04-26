export function proxyUrl(url: string) {
  if (!url) return '';
  if (url.match(/^\/product-images(?:-\d+)?\//)) return url;
  return url;
}
