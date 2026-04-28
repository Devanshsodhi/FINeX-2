from __future__ import annotations
import asyncio
import math
import time
from datetime import datetime, timezone

import feedparser
import httpx
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from agents import RunContextWrapper, function_tool
from db import crud

_vader = SentimentIntensityAnalyzer()
_cache: dict = {"data": None, "at": 0}
CACHE_TTL = 15 * 60  # 15 min

RSS_FEEDS = [
    "https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2148327.cms",
    "https://www.livemint.com/rss/markets",
    "https://feeds.feedburner.com/ndtvprofit-latest",
]


def _decay_weight(published_at: str, lam: float = 0.04) -> float:
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        return math.exp(-lam * max(0, hours))
    except Exception:
        return 1.0


def _score_articles(articles: list[dict]) -> dict:
    if not articles:
        return {"score": 0.0, "articles": []}
    scored = []
    for a in articles:
        text = f"{a.get('title', '')} {a.get('description', '')}"
        compound = _vader.polarity_scores(text)["compound"]
        weight = _decay_weight(a.get("published_at", ""))
        scored.append({**a, "sentiment": round(compound, 3), "weight": round(weight, 3)})
    total_w = sum(s["weight"] for s in scored)
    weighted = sum(s["sentiment"] * s["weight"] for s in scored) / total_w if total_w > 0 else 0
    return {"score": round(weighted, 3), "articles": scored}


async def _fetch_news(symbol: str, name: str, api_key: str) -> list[dict]:
    articles: list[dict] = []
    queries = [name, symbol] if name and name != symbol else [symbol]

    if api_key:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.get(
                    "https://newsapi.org/v2/everything",
                    params={"q": queries[0], "apiKey": api_key, "sortBy": "publishedAt", "language": "en", "pageSize": 6},
                )
                data = res.json()
                for a in data.get("articles", []):
                    articles.append({"title": a.get("title", ""), "source": a.get("source", {}).get("name", "NewsAPI"),
                                     "published_at": a.get("publishedAt", ""), "url": a.get("url", ""), "description": a.get("description", "")})
        except Exception:
            pass

    if len(articles) < 3:
        for feed_url in RSS_FEEDS:
            try:
                feed = feedparser.parse(feed_url)
                for entry in feed.entries:
                    text = f"{entry.get('title', '')} {entry.get('summary', '')}".lower()
                    if any(q.lower() in text for q in queries):
                        articles.append({"title": entry.get("title", ""), "source": feed.feed.get("title", "RSS"),
                                         "published_at": entry.get("published", ""), "url": entry.get("link", ""), "description": entry.get("summary", "")})
                if len(articles) >= 6:
                    break
            except Exception:
                pass

    return articles[:8]


def _classify_regime(scores: list[float]) -> dict:
    avg = sum(scores) / len(scores) if scores else 0
    if avg > 0.15:  return {"label": "Risk-On",  "color": "green",  "description": "Broad positive sentiment across your holdings."}
    if avg < -0.15: return {"label": "Risk-Off", "color": "red",    "description": "Caution — negative news pressure across your holdings."}
    return             {"label": "Neutral",   "color": "yellow", "description": "Mixed signals — markets in wait-and-watch mode."}


@function_tool
async def get_market_sentiment(ctx: RunContextWrapper) -> dict:
    """Fetch live news sentiment, regime classification, and per-symbol signals for portfolio holdings."""
    global _cache
    now = time.time()
    if _cache["data"] and now - _cache["at"] < CACHE_TTL:
        return _cache["data"]

    from config import NEWSAPI_KEY
    p = await crud.get_portfolio(ctx.context.db, ctx.context.user_id)
    holdings = []
    if p:
        holdings = [{"symbol": s["symbol"], "name": s.get("name", s["symbol"])} for s in p.get("stocks", [])] + \
                   [{"symbol": c["symbol"], "name": c.get("coin", c["symbol"])} for c in p.get("crypto", [])]

    tasks = [_fetch_news(h["symbol"], h["name"], NEWSAPI_KEY) for h in holdings]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    symbol_map: dict = {}
    for holding, articles in zip(holdings, results):
        if isinstance(articles, Exception):
            articles = []
        scored = _score_articles(articles)
        signal = "BULLISH" if scored["score"] > 0.12 else "BEARISH" if scored["score"] < -0.12 else "NEUTRAL"
        symbol_map[holding["symbol"]] = {**scored, "signal": signal}

    regime = _classify_regime([v["score"] for v in symbol_map.values()])
    data = {"symbols": symbol_map, "regime": regime, "cached_at": datetime.now(timezone.utc).isoformat()}
    _cache = {"data": data, "at": now}
    return data
