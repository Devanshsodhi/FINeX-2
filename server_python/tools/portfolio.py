from __future__ import annotations
import math
from agents import RunContextWrapper, function_tool
from db import crud


def _years_since(date_str: str | None) -> float | None:
    if not date_str:
        return None
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days / 365.25
    except Exception:
        return None


def _cagr(current: float, cost: float, years: float | None) -> float | None:
    if years is None or years < 0.08 or cost <= 0 or current <= 0:
        return None
    return round((math.pow(current / cost, 1 / years) - 1) * 100, 2)


def _fmt_inr(n: float) -> str:
    return f"₹{round(n):,}"


def _randn() -> float:
    import random
    u1 = max(1e-10, random.random())
    u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


def _monte_carlo(goal: dict, simulations: int = 1000) -> dict:
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc)
    deadline = datetime.fromisoformat(goal["deadline"].replace("Z", "+00:00"))
    months = max(1, round((deadline - today).days / 30))
    mu = math.log(1 + 0.10) / 12
    sigma = 0.15 / math.sqrt(12)

    results = []
    for _ in range(simulations):
        value = goal.get("current", 0)
        for _ in range(months):
            value *= math.exp(mu + sigma * _randn())
        results.append(value)
    results.sort()
    successes = sum(1 for v in results if v >= goal["target"])
    return {
        "success_probability_pct": round(successes / simulations * 100),
        "p10_outcome": round(results[int(simulations * 0.10)]),
        "p50_outcome": round(results[int(simulations * 0.50)]),
        "p90_outcome": round(results[int(simulations * 0.90)]),
        "months_to_deadline": months,
    }


def compute_summary(p: dict) -> dict:
    stocks_val  = sum(h["quantity"] * h["current_price"] for h in p.get("stocks", []))
    mf_val      = sum(h["units"] * h["nav"] for h in p.get("mutual_funds", []))
    fd_val      = sum(h["principal"] for h in p.get("fixed_deposits", []))
    crypto_val  = sum(h["quantity"] * h["current_price_inr"] for h in p.get("crypto", []))
    cash_val    = sum(a["balance"] for a in p.get("savings_accounts", []))
    total_assets = stocks_val + mf_val + fd_val + crypto_val + cash_val
    total_liab   = sum(l["outstanding"] for l in p.get("liabilities", []))
    net_worth    = total_assets - total_liab

    stocks_pnl = sum(h["quantity"] * (h["current_price"] - h["avg_buy_price"]) for h in p.get("stocks", []))
    mf_pnl     = sum(h["units"] * h["nav"] - h["invested_amount"] for h in p.get("mutual_funds", []))
    crypto_pnl = sum(h["quantity"] * (h["current_price_inr"] - h["avg_buy_price_inr"]) for h in p.get("crypto", []))

    stocks_cagr = [
        {"symbol": s["symbol"],
         "cagr_pct": _cagr(s["quantity"] * s["current_price"], s["quantity"] * s["avg_buy_price"], _years_since(s.get("buy_date"))),
         "years_held": round(_years_since(s.get("buy_date")) or 0, 2)}
        for s in p.get("stocks", [])
    ]
    mf_cagr = [
        {"scheme": mf["scheme_name"],
         "cagr_pct": _cagr(mf["units"] * mf["nav"], mf["invested_amount"], _years_since(mf.get("start_date"))),
         "years_held": round(_years_since(mf.get("start_date")) or 0, 2)}
        for mf in p.get("mutual_funds", [])
    ]
    crypto_cagr = [
        {"coin": c["coin"],
         "cagr_pct": _cagr(c["quantity"] * c["current_price_inr"], c["quantity"] * c["avg_buy_price_inr"], _years_since(c.get("buy_date"))),
         "years_held": round(_years_since(c.get("buy_date")) or 0, 2)}
        for c in p.get("crypto", [])
    ]

    all_cagrs = [x["cagr_pct"] for x in stocks_cagr + mf_cagr + crypto_cagr if x["cagr_pct"] is not None]
    sharpe = None
    if len(all_cagrs) >= 2:
        risk_free = 7.0
        avg = sum(all_cagrs) / len(all_cagrs)
        variance = sum((r - avg) ** 2 for r in all_cagrs) / len(all_cagrs)
        std_dev = math.sqrt(variance)
        sharpe = round((avg - risk_free) / std_dev, 2) if std_dev > 0 else None

    all_returns = [
        *[(s["current_price"] - s["avg_buy_price"]) / s["avg_buy_price"] * 100 for s in p.get("stocks", [])],
        *[(mf["units"] * mf["nav"] - mf["invested_amount"]) / mf["invested_amount"] * 100 for mf in p.get("mutual_funds", [])],
        *[(c["current_price_inr"] - c["avg_buy_price_inr"]) / c["avg_buy_price_inr"] * 100 for c in p.get("crypto", [])],
    ]
    max_drawdown = round(min(all_returns), 2) if all_returns else None

    from datetime import datetime, timezone
    today = datetime.now(timezone.utc)
    goals = []
    for g in p.get("goals", []):
        deadline = datetime.fromisoformat(g["deadline"].replace("Z", "+00:00"))
        days_left = max(0, (deadline - today).days)
        months_left = round(days_left / 30, 1)
        amount_left = g["target"] - g.get("current", 0)
        required_monthly = round(amount_left / months_left) if months_left > 0 else None
        goals.append({
            **g,
            "progress_pct": round(g.get("current", 0) / g["target"] * 100, 1),
            "days_remaining": days_left,
            "months_remaining": months_left,
            "amount_remaining": amount_left,
            "required_monthly_contribution": required_monthly,
            "monte_carlo": _monte_carlo(g),
        })

    return {
        "net_worth": round(net_worth),
        "total_assets": round(total_assets),
        "total_liabilities": round(total_liab),
        "allocation": {
            "stocks":         {"value": round(stocks_val), "pct": round(stocks_val / total_assets * 100, 1)},
            "mutual_funds":   {"value": round(mf_val),     "pct": round(mf_val / total_assets * 100, 1)},
            "fixed_deposits": {"value": round(fd_val),     "pct": round(fd_val / total_assets * 100, 1)},
            "crypto":         {"value": round(crypto_val), "pct": round(crypto_val / total_assets * 100, 1)},
            "cash":           {"value": round(cash_val),   "pct": round(cash_val / total_assets * 100, 1)},
        },
        "pnl": {
            "stocks": round(stocks_pnl), "mutual_funds": round(mf_pnl),
            "crypto": round(crypto_pnl), "total": round(stocks_pnl + mf_pnl + crypto_pnl),
        },
        "performance_metrics": {
            "cagr_by_holding": {"stocks": stocks_cagr, "mutual_funds": mf_cagr, "crypto": crypto_cagr},
            "sharpe_ratio": sharpe,
            "max_drawdown_pct": max_drawdown,
        },
        "goals": goals,
    }


@function_tool
async def get_portfolio(ctx: RunContextWrapper) -> dict:
    """Return the user's full investment portfolio."""
    p = await crud.get_portfolio(ctx.context.db, ctx.context.user_id)
    return p or {}


@function_tool
async def get_portfolio_summary(ctx: RunContextWrapper) -> dict:
    """Return net worth, P&L, allocation, CAGR, Sharpe ratio, drawdown, and goal progress."""
    p = await crud.get_portfolio(ctx.context.db, ctx.context.user_id)
    if not p:
        return {"error": "No portfolio data found."}
    return compute_summary(p)
