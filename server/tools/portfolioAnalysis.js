/**
 * Portfolio analysis — pre-computes all metrics before passing to the LLM.
 * No LLM calls here; pure data computation.
 */

export const computeAnalysis = (p) => {
  const stocksValue = p.stocks.reduce((s, h) => s + h.quantity * h.current_price, 0);
  const mfValue     = p.mutual_funds.reduce((s, h) => s + h.units * h.nav, 0);
  const fdValue     = p.fixed_deposits.reduce((s, h) => s + h.principal, 0);
  const cryptoValue = p.crypto.reduce((s, h) => s + h.quantity * h.current_price_inr, 0);
  const cashValue   = p.savings_accounts.reduce((s, a) => s + a.balance, 0);
  const totalAssets = stocksValue + mfValue + fdValue + cryptoValue + cashValue;
  const totalLiabilities = p.liabilities.reduce((s, l) => s + l.outstanding, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Asset class breakdown with concentration flag (>40% = high concentration)
  const assetClasses = { stocks: stocksValue, mutual_funds: mfValue, fixed_deposits: fdValue, crypto: cryptoValue, cash: cashValue };
  const concentration = Object.entries(assetClasses).map(([cls, val]) => ({
    asset_class: cls,
    value: Math.round(val),
    pct: +((val / totalAssets) * 100).toFixed(1),
    high_concentration: val / totalAssets > 0.4,
  }));

  // Liquidity: savings accounts accessible within 30 days
  const liquidityRatioPct = +((cashValue / totalAssets) * 100).toFixed(1);

  // Debt burden
  const debtToAssetPct = +((totalLiabilities / totalAssets) * 100).toFixed(1);
  const totalMonthlyEmi = p.liabilities.reduce((s, l) => s + (l.emi || 0), 0);

  // Stock performance — sorted best to worst
  const stocksPerformance = p.stocks
    .map(h => ({
      symbol: h.symbol,
      name: h.name,
      pnl: Math.round((h.current_price - h.avg_buy_price) * h.quantity),
      pnl_pct: +(((h.current_price - h.avg_buy_price) / h.avg_buy_price) * 100).toFixed(2),
      current_value: Math.round(h.quantity * h.current_price),
    }))
    .sort((a, b) => b.pnl_pct - a.pnl_pct);

  // MF performance
  const mfPerformance = p.mutual_funds
    .map(h => ({
      scheme: h.scheme_name,
      category: h.category,
      returns: Math.round(h.units * h.nav - h.invested_amount),
      returns_pct: +(((h.units * h.nav - h.invested_amount) / h.invested_amount) * 100).toFixed(2),
      current_value: Math.round(h.units * h.nav),
    }))
    .sort((a, b) => b.returns_pct - a.returns_pct);

  // Crypto performance
  const cryptoPerformance = p.crypto
    .map(h => ({
      coin: h.coin,
      symbol: h.symbol,
      pnl: Math.round((h.current_price_inr - h.avg_buy_price_inr) * h.quantity),
      pnl_pct: +(((h.current_price_inr - h.avg_buy_price_inr) / h.avg_buy_price_inr) * 100).toFixed(2),
      current_value: Math.round(h.quantity * h.current_price_inr),
    }))
    .sort((a, b) => b.pnl_pct - a.pnl_pct);

  // Total unrealised P&L across all tradeable assets
  const totalPnl =
    stocksPerformance.reduce((s, h) => s + h.pnl, 0) +
    mfPerformance.reduce((s, h) => s + h.returns, 0) +
    cryptoPerformance.reduce((s, h) => s + h.pnl, 0);

  // Goal projections
  const today = new Date();
  const goalProjections = p.goals.map(g => {
    const deadline = new Date(g.deadline);
    const daysRemaining   = Math.max(0, Math.round((deadline - today) / 86400000));
    const monthsRemaining = +(daysRemaining / 30).toFixed(1);
    const amountRemaining = g.target - g.current;
    const requiredMonthly = monthsRemaining > 0 ? Math.round(amountRemaining / monthsRemaining) : null;
    const progressPct     = +((g.current / g.target) * 100).toFixed(1);

    let status = 'unknown';
    if (daysRemaining === 0) status = progressPct >= 100 ? 'completed' : 'overdue';
    else if (progressPct >= 100) status = 'completed';
    else if (progressPct >= (100 * (1 - daysRemaining / ((deadline - new Date(g.deadline).setFullYear(today.getFullYear() - 1)) / 86400000)))) status = 'on_track';
    else status = 'behind';

    return {
      name: g.name,
      target: g.target,
      current: g.current,
      progress_pct: progressPct,
      days_remaining: daysRemaining,
      months_remaining: monthsRemaining,
      amount_remaining: amountRemaining,
      required_monthly_contribution: requiredMonthly,
      deadline: g.deadline,
    };
  });

  return {
    snapshot: {
      net_worth: Math.round(netWorth),
      total_assets: Math.round(totalAssets),
      total_liabilities: Math.round(totalLiabilities),
      total_unrealised_pnl: Math.round(totalPnl),
      liquidity_ratio_pct: liquidityRatioPct,
      debt_to_asset_ratio_pct: debtToAssetPct,
      total_monthly_emi: Math.round(totalMonthlyEmi),
    },
    concentration,
    stocks_performance: stocksPerformance,
    mf_performance: mfPerformance,
    crypto_performance: cryptoPerformance,
    goal_projections: goalProjections,
  };
};
