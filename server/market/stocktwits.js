// StockTwits free public API — no key needed, rate-limited
// Crypto symbols use .X suffix on StockTwits

const SYMBOL_MAP = {
  BTC: 'BTC.X',
  ETH: 'ETH.X',
  SOL: 'SOL.X',
};

export async function getStockTwitsSentiment(symbol) {
  const stSymbol = SYMBOL_MAP[symbol] || symbol;
  try {
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${stSymbol}.json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const messages = data.messages || [];
    if (!messages.length) return null;

    let bullish = 0, bearish = 0;
    for (const msg of messages) {
      const sentiment = msg.entities?.sentiment?.basic;
      if (sentiment === 'Bullish') bullish++;
      else if (sentiment === 'Bearish') bearish++;
    }
    const total = bullish + bearish;
    if (!total) return null;

    const score = +(((bullish - bearish) / total)).toFixed(3);
    return { score, bullish, bearish, total };
  } catch {
    return null;
  }
}
