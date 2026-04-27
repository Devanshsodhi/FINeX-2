import Parser from 'rss-parser';

const parser = new Parser({ timeout: 8000 });

const RSS_FEEDS = [
  'https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2148327.cms',
  'https://www.livemint.com/rss/markets',
  'https://feeds.feedburner.com/ndtvprofit-latest',
];

export async function fetchNewsForSymbol(symbol, name, apiKey) {
  // Use full name as primary query, symbol as fallback
  const queries = name && name !== symbol ? [name, symbol] : [symbol];
  const articles = [];

  // 1. NewsAPI
  if (apiKey) {
    try {
      const q = queries[0];
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&apiKey=${apiKey}&sortBy=publishedAt&language=en&pageSize=6`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (Array.isArray(data.articles)) {
        articles.push(...data.articles.map(a => ({
          title: a.title || '',
          source: a.source?.name || 'NewsAPI',
          publishedAt: a.publishedAt,
          url: a.url,
          description: a.description || '',
        })));
      }
    } catch {}
  }

  // 2. RSS fallback — scan feeds for any matching term
  if (articles.length < 3) {
    for (const feedUrl of RSS_FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const hits = feed.items
          .filter(item => {
            const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
            return queries.some(q => text.includes(q.toLowerCase()));
          })
          .slice(0, 4)
          .map(item => ({
            title: item.title || '',
            source: feed.title || 'RSS',
            publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
            url: item.link || '',
            description: item.contentSnippet || '',
          }));
        articles.push(...hits);
        if (articles.length >= 6) break;
      } catch {}
    }
  }

  return articles.slice(0, 8);
}
