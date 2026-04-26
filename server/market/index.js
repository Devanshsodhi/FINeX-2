import { fetchNewsForSymbol } from './newsClient.js';
import { analyzeArticles } from './sentimentAnalyzer.js';
import { getStockTwitsSentiment } from './stocktwits.js';

const CACHE_TTL = 15 * 60 * 1000; // 15 min
let _cache = { data: null, at: 0 };

const classifyRegime = (scores) => {
  const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  if (avg > 0.15) return { label: 'Risk-On', color: 'green', description: 'Broad positive sentiment across your holdings.' };
  if (avg < -0.15) return { label: 'Risk-Off', color: 'red', description: 'Caution — negative news pressure across your holdings.' };
  return { label: 'Neutral', color: 'yellow', description: 'Mixed signals — markets in wait-and-watch mode.' };
};

export async function getMarketData(symbols) {
  const now = Date.now();
  if (_cache.data && now - _cache.at < CACHE_TTL) return _cache.data;

  const apiKey = process.env.NEWSAPI_KEY;

  const symbolResults = await Promise.all(
    symbols.map(async (symbol) => {
      const [articles, twits] = await Promise.allSettled([
        fetchNewsForSymbol(symbol, apiKey),
        getStockTwitsSentiment(symbol),
      ]);

      const newsData = analyzeArticles(articles.status === 'fulfilled' ? articles.value : []);
      const twitsData = twits.status === 'fulfilled' ? twits.value : null;

      // Blend: 60% news, 40% social (only when social data available)
      let finalScore = newsData.score;
      if (twitsData) {
        finalScore = +((newsData.score * 0.6 + twitsData.score * 0.4)).toFixed(3);
      }

      const signal = finalScore > 0.12 ? 'BULLISH' : finalScore < -0.12 ? 'BEARISH' : 'NEUTRAL';

      return [symbol, { score: finalScore, signal, articles: newsData.articles, stocktwits: twitsData }];
    })
  );

  const symbolMap = Object.fromEntries(symbolResults);
  const regime = classifyRegime(Object.values(symbolMap).map(v => v.score));

  const data = { symbols: symbolMap, regime, cachedAt: new Date().toISOString() };
  _cache = { data, at: now };
  return data;
}
