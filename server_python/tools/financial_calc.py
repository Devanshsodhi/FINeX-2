from __future__ import annotations
import math
import random
from typing import Literal

from agents import RunContextWrapper, function_tool
from db import crud


def _fmt_inr(n: float) -> str:
    return f"₹{round(n):,}"


def _years_since(date_str: str | None) -> float | None:
    if not date_str:
        return None
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days / 365.25
    except Exception:
        return None


# ── SIP Calculator ────────────────────────────────────────────────────────────

@function_tool
async def calculate_sip(
    monthly_amount: float,
    years: int,
    expected_annual_return_pct: float,
    existing_lumpsum: float = 0.0,
) -> dict:
    """Calculate future value of a SIP investment with pessimistic/base/optimistic scenarios."""
    r = expected_annual_return_pct / 100 / 12
    n = years * 12
    sip_fv = monthly_amount * (((1 + r) ** n - 1) / r * (1 + r)) if r > 0 else monthly_amount * n
    lump_fv = existing_lumpsum * (1 + expected_annual_return_pct / 100) ** years
    total_fv = sip_fv + lump_fv
    total_invested = monthly_amount * n + existing_lumpsum

    def scenario_fv(rate: float) -> int:
        r2 = rate / 100 / 12
        sip = monthly_amount * (((1 + r2) ** n - 1) / r2 * (1 + r2)) if r2 > 0 else monthly_amount * n
        return round(sip + existing_lumpsum * (1 + rate / 100) ** years)

    return {
        "currency": "INR",
        "total_future_value": round(total_fv),
        "total_future_value_fmt": _fmt_inr(total_fv),
        "total_invested": round(total_invested),
        "total_invested_fmt": _fmt_inr(total_invested),
        "wealth_gained": round(total_fv - total_invested),
        "wealth_gained_fmt": _fmt_inr(total_fv - total_invested),
        "return_multiple": round(total_fv / max(1, total_invested), 2),
        "scenarios": {
            "pessimistic": {"rate_pct": expected_annual_return_pct - 2, "future_value": scenario_fv(expected_annual_return_pct - 2), "future_value_fmt": _fmt_inr(scenario_fv(expected_annual_return_pct - 2))},
            "base":        {"rate_pct": expected_annual_return_pct,     "future_value": round(total_fv),                             "future_value_fmt": _fmt_inr(total_fv)},
            "optimistic":  {"rate_pct": expected_annual_return_pct + 2, "future_value": scenario_fv(expected_annual_return_pct + 2), "future_value_fmt": _fmt_inr(scenario_fv(expected_annual_return_pct + 2))},
        },
        "inputs": {"monthly_amount": monthly_amount, "years": years, "expected_annual_return_pct": expected_annual_return_pct, "existing_lumpsum": existing_lumpsum},
    }


# ── Income Tax ────────────────────────────────────────────────────────────────

NEW_SLABS = [(0, 400000, 0.00), (400000, 800000, 0.05), (800000, 1200000, 0.10),
             (1200000, 1600000, 0.15), (1600000, 2000000, 0.20), (2000000, 2400000, 0.25), (2400000, float("inf"), 0.30)]
OLD_SLABS = [(0, 250000, 0.00), (250000, 500000, 0.05), (500000, 1000000, 0.20), (1000000, float("inf"), 0.30)]

def _slab_tax(income: float, slabs: list) -> float:
    tax = 0.0
    for lo, hi, rate in slabs:
        if income <= lo: break
        tax += (min(income, hi) - lo) * rate
    return tax

def _surcharge(tax: float, income: float) -> float:
    if income > 20_000_000: return tax * 1.25
    if income > 10_000_000: return tax * 1.15
    if income >  5_000_000: return tax * 1.10
    return tax


@function_tool
async def compute_income_tax(
    annual_income: float,
    regime: Literal["new", "old", "compare"] = "compare",
    section_80c: float = 0.0,
    section_80d: float = 0.0,
    nps_80ccd1b: float = 0.0,
    hra: float = 0.0,
    home_loan_interest: float = 0.0,
) -> dict:
    """Compute exact income tax liability under new/old regime for FY 2025-26."""
    CESS = 0.04
    result: dict = {"currency": "INR", "annual_income": annual_income, "assessment_year": "AY 2026-27 (FY 2025-26)"}

    if regime in ("new", "compare"):
        ti = max(0, annual_income - 75000)
        base = _slab_tax(ti, NEW_SLABS)
        rebate = min(base, 60000) if ti <= 1200000 else 0
        base = max(0, base - rebate)
        ws = _surcharge(base, annual_income)
        total = round(ws * (1 + CESS))
        result["new_regime"] = {
            "taxable_income": ti, "taxable_income_fmt": _fmt_inr(ti),
            "total_tax_liability": total, "total_tax_liability_fmt": _fmt_inr(total),
            "effective_rate_pct": round(total / annual_income * 100, 2),
            "rebate_87a_applied": rebate > 0, "rebate_87a_amount": round(rebate),
        }

    if regime in ("old", "compare"):
        ded = (50000 + min(section_80c, 150000) + min(section_80d, 25000)
               + min(nps_80ccd1b, 50000) + hra + min(home_loan_interest, 200000))
        ti = max(0, annual_income - ded)
        base = _slab_tax(ti, OLD_SLABS)
        rebate = min(base, 12500) if ti <= 500000 else 0
        base = max(0, base - rebate)
        ws = _surcharge(base, annual_income)
        total = round(ws * (1 + CESS))
        result["old_regime"] = {
            "taxable_income": ti, "taxable_income_fmt": _fmt_inr(ti),
            "total_deductions": round(ded), "total_deductions_fmt": _fmt_inr(ded),
            "total_tax_liability": total, "total_tax_liability_fmt": _fmt_inr(total),
            "effective_rate_pct": round(total / annual_income * 100, 2),
        }

    if regime == "compare" and "new_regime" in result and "old_regime" in result:
        new_t = result["new_regime"]["total_tax_liability"]
        old_t = result["old_regime"]["total_tax_liability"]
        better = "new" if new_t <= old_t else "old"
        result["comparison"] = {
            "better_regime": better,
            "tax_saving": abs(new_t - old_t),
            "tax_saving_fmt": _fmt_inr(abs(new_t - old_t)),
            "summary": f"{'New' if better == 'new' else 'Old'} regime saves {_fmt_inr(abs(new_t - old_t))} in tax for FY 2025-26",
        }

    return result


# ── Tax Insights ──────────────────────────────────────────────────────────────

ELSS_PATTERNS = ["elss", "tax saver", "tax saving", "tax plan", "taxsaver", "long term equity", "80c fund"]

def _is_elss(mf: dict) -> bool:
    name = mf.get("scheme_name", "").lower()
    cat  = mf.get("category", "").lower()
    return cat == "elss" or any(p in name or p in cat for p in ELSS_PATTERNS)


@function_tool
async def get_tax_insights(ctx: RunContextWrapper) -> dict:
    """LTCG harvesting opportunities, 80C gap, FD TDS exposure, and crypto tax for the user's portfolio."""
    p = await crud.get_portfolio(ctx.context.db, ctx.context.user_id)
    if not p:
        return {"error": "No portfolio data found."}

    LTCG_EXEMPTION = 100_000
    FD_TDS_THRESHOLD = 40_000

    ltcg = []
    total_harvest = 0.0
    for s in p.get("stocks", []):
        yrs = _years_since(s.get("buy_date"))
        gain = (s["current_price"] - s["avg_buy_price"]) * s["quantity"]
        if yrs and yrs >= 1 and gain > 0:
            ltcg.append({"name": s["name"], "symbol": s["symbol"], "gain": round(gain), "gain_fmt": _fmt_inr(gain), "years_held": round(yrs, 1)})
            total_harvest += gain

    for mf in p.get("mutual_funds", []):
        yrs = _years_since(mf.get("start_date"))
        gain = mf["units"] * mf["nav"] - mf["invested_amount"]
        if yrs and yrs >= 1 and gain > 0:
            ltcg.append({"name": mf["scheme_name"], "gain": round(gain), "gain_fmt": _fmt_inr(gain), "years_held": round(yrs, 1)})
            total_harvest += gain

    crypto_gains = [
        {"coin": c["coin"], "gain": round((c["current_price_inr"] - c["avg_buy_price_inr"]) * c["quantity"]),
         "gain_fmt": _fmt_inr((c["current_price_inr"] - c["avg_buy_price_inr"]) * c["quantity"])}
        for c in p.get("crypto", []) if (c["current_price_inr"] - c["avg_buy_price_inr"]) * c["quantity"] > 0
    ]

    fd_tds = []
    for fd in p.get("fixed_deposits", []):
        annual_int = round(fd["principal"] * fd["interest_rate"] / 100)
        tds = round(annual_int * 0.10) if annual_int > FD_TDS_THRESHOLD else 0
        fd_tds.append({"bank": fd["bank"], "annual_interest": annual_int, "annual_interest_fmt": _fmt_inr(annual_int), "tds_amount": tds, "tds_amount_fmt": _fmt_inr(tds)})

    elss_invested = sum(mf["invested_amount"] for mf in p.get("mutual_funds", []) if _is_elss(mf))
    gap_80c = max(0, 150_000 - elss_invested)

    return {
        "currency": "INR",
        "ltcg_harvesting": {"candidates": ltcg, "total_harvestable_gains": round(total_harvest), "annual_exemption": LTCG_EXEMPTION,
                            "recommendation": f"Book up to {_fmt_inr(LTCG_EXEMPTION)} tax-free." if total_harvest > 0 else "No LTCG harvesting opportunities."},
        "crypto_tax": {"holdings": crypto_gains, "note": "Crypto taxed at 30% flat under Section 115BBH."},
        "fd_tds": {"details": fd_tds, "total_tds": sum(f["tds_amount"] for f in fd_tds), "total_tds_fmt": _fmt_inr(sum(f["tds_amount"] for f in fd_tds))},
        "section_80c": {"elss_invested": round(elss_invested), "elss_invested_fmt": _fmt_inr(elss_invested), "remaining_limit": round(gap_80c), "remaining_limit_fmt": _fmt_inr(gap_80c)},
    }


# ── Goal Probability ──────────────────────────────────────────────────────────

def _randn() -> float:
    u1 = max(1e-10, random.random())
    u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


@function_tool
async def calculate_goal_probability(
    ctx: RunContextWrapper,
    goal_name: str,
    monthly_contribution: float,
    expected_annual_return_pct: float = 10.0,
    annual_volatility_pct: float = 15.0,
    simulations: int = 1000,
) -> dict:
    """Monte Carlo simulation for probability of reaching a savings goal."""
    from datetime import datetime, timezone
    p = await crud.get_portfolio(ctx.context.db, ctx.context.user_id)
    if not p:
        return {"error": "No portfolio data found."}

    goals = p.get("goals", [])
    goal = next((g for g in goals if goal_name.lower() in g["name"].lower()), None)
    if not goal:
        return {"error": f"Goal '{goal_name}' not found. Available: {[g['name'] for g in goals]}"}

    today = datetime.now(timezone.utc)
    deadline = datetime.fromisoformat(goal["deadline"].replace("Z", "+00:00"))
    months = max(1, round((deadline - today).days / 30.44))

    mu = expected_annual_return_pct / 100 / 12
    sigma = annual_volatility_pct / 100 / math.sqrt(12)

    outcomes = []
    for _ in range(simulations):
        corpus = goal.get("current_amount", 0)
        for _ in range(months):
            corpus += monthly_contribution
            corpus *= (1 + mu + sigma * _randn())
        outcomes.append(corpus)
    outcomes.sort()
    successes = sum(1 for v in outcomes if v >= goal["target_amount"])

    lo, hi = 0.0, goal["target_amount"] / months * 2
    for _ in range(20):
        mid = (lo + hi) / 2
        sims = []
        for _ in range(simulations):
            c = goal.get("current_amount", 0)
            for _ in range(months):
                c += mid; c *= (1 + mu + sigma * _randn())
            sims.append(c)
        if sum(1 for v in sims if v >= goal["target_amount"]) / simulations >= 0.80:
            hi = mid
        else:
            lo = mid

    return {
        "goal_name": goal["name"],
        "target_amount": goal["target_amount"], "target_amount_fmt": _fmt_inr(goal["target_amount"]),
        "months_to_deadline": months,
        "success_probability_pct": round(successes / simulations * 100, 1),
        "p10_outcome_fmt": _fmt_inr(outcomes[int(simulations * 0.10)]),
        "p50_outcome_fmt": _fmt_inr(outcomes[int(simulations * 0.50)]),
        "p90_outcome_fmt": _fmt_inr(outcomes[int(simulations * 0.90)]),
        "recommended_monthly_for_80pct": round((lo + hi) / 2),
        "recommended_monthly_fmt": _fmt_inr((lo + hi) / 2),
    }


# ── Rebalancing Advice ────────────────────────────────────────────────────────

@function_tool
async def get_rebalancing_advice(ctx: RunContextWrapper) -> dict:
    """Current vs target allocation, drift amounts in INR, and tax implications."""
    p = await crud.get_portfolio(ctx.context.db, ctx.context.user_id)
    if not p:
        return {"error": "No portfolio data found."}

    stocks_val  = sum(h["quantity"] * h["current_price"] for h in p.get("stocks", []))
    mf_val      = sum(h["units"] * h["nav"] for h in p.get("mutual_funds", []))
    fd_val      = sum(h["principal"] for h in p.get("fixed_deposits", []))
    crypto_val  = sum(h["quantity"] * h["current_price_inr"] for h in p.get("crypto", []))
    cash_val    = sum(a["balance"] for a in p.get("savings_accounts", []))
    total = stocks_val + mf_val + fd_val + crypto_val + cash_val

    current = {
        "equity": round(stocks_val / total * 100, 1),
        "mutual_funds": round(mf_val / total * 100, 1),
        "fixed_income": round(fd_val / total * 100, 1),
        "crypto": round(crypto_val / total * 100, 1),
        "cash": round(cash_val / total * 100, 1),
    }
    target = p.get("target_allocation", {"equity": 55, "mutual_funds": 15, "fixed_income": 15, "crypto": 10, "cash": 5})

    recs = []
    for cls, tgt_pct in target.items():
        actual_pct = current.get(cls, 0)
        drift = round(actual_pct - tgt_pct, 1)
        if abs(drift) >= 5:
            action = "reduce" if drift > 0 else "increase"
            recs.append({
                "asset_class": cls, "current_pct": actual_pct, "target_pct": tgt_pct,
                "drift_pct": drift, "action": action,
                "amount_inr": round(abs(drift / 100) * total), "amount_fmt": _fmt_inr(abs(drift / 100) * total),
            })
    recs.sort(key=lambda r: abs(r["drift_pct"]), reverse=True)

    return {
        "currency": "INR", "portfolio_value": round(total), "portfolio_value_fmt": _fmt_inr(total),
        "current_allocation": current, "target_allocation": target,
        "needs_rebalancing": len(recs) > 0, "recommendations": recs,
        "summary": f"{len(recs)} asset class(es) need rebalancing." if recs else "Portfolio within drift threshold.",
    }


# ── Exchange Rates ────────────────────────────────────────────────────────────

@function_tool
async def get_exchange_rates(from_currency: str, to_currency: str) -> dict:
    """Get live exchange rate between two currencies."""
    import httpx
    from_c = from_currency.upper()
    to_c = to_currency.upper()
    async with httpx.AsyncClient(timeout=8) as client:
        res = await client.get(f"https://api.exchangerate-api.com/v4/latest/{from_c}")
        res.raise_for_status()
        data = res.json()
    rate = data["rates"].get(to_c)
    if not rate:
        return {"error": f"Rate not found for {from_c} → {to_c}"}
    return {"from_currency": from_c, "to_currency": to_c, "rate": round(rate, 4), "example": f"1 {from_c} = {round(rate, 2)} {to_c}", "date": data.get("date")}
