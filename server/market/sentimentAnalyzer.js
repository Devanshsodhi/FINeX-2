import Sentiment from 'sentiment';

const analyzer = new Sentiment();

// Temporal decay weight: newer = higher weight
const decayWeight = (publishedAt, λ = 0.04) => {
  const hours = (Date.now() - new Date(publishedAt || Date.now()).getTime()) / 3_600_000;
  return Math.exp(-λ * Math.max(0, hours));
};

// Normalize the sentiment comparative score to [-1, 1]
const normalize = (comparative) => Math.max(-1, Math.min(1, comparative * 0.4));

export function analyzeArticles(articles) {
  if (!articles.length) return { score: 0, signal: 'NEUTRAL', articles: [] };

  const scored = articles.map(a => {
    const text = `${a.title} ${a.description || ''}`;
    const result = analyzer.analyze(text);
    const raw = normalize(result.comparative);
    const weight = decayWeight(a.publishedAt);
    return { ...a, sentiment: +raw.toFixed(3), weight };
  });

  const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
  const weightedScore = totalWeight > 0
    ? scored.reduce((s, a) => s + a.sentiment * a.weight, 0) / totalWeight
    : 0;

  const score = +weightedScore.toFixed(3);
  const signal = score > 0.12 ? 'BULLISH' : score < -0.12 ? 'BEARISH' : 'NEUTRAL';

  return { score, signal, articles: scored };
}
