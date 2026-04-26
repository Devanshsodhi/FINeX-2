import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_FILE = path.join(__dirname, '..', 'db', 'portfolio.json');
const readPortfolio = () => JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));

const fmtInr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const yearsSince = (dateStr) => {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / (365.25 * 86400000);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. SIP / Compound Calculator
// ─────────────────────────────────────────────────────────────────────────────

export const calculate_sip = async ({ monthly_amount, years, expected_annual_return_pct, existing_lumpsum = 0 }) => {
  const r = expected_annual_return_pct / 100 / 12;
  const n = years * 12;

  const sipFV  = r > 0
    ? monthly_amount * (((Math.pow(1 + r, n) - 1) / r) * (1 + r))
    : monthly_amount * n;
  const lumpFV        = existing_lumpsum * Math.pow(1 + expected_annual_return_pct / 100, years);
  const totalFV       = sipFV + lumpFV;
  const totalInvested = monthly_amount * n + existing_lumpsum;

  const scenarioFV = (rate) => {
    const r2  = rate / 100 / 12;
    const sip = r2 > 0
      ? monthly_amount * (((Math.pow(1 + r2, n) - 1) / r2) * (1 + r2))
      : monthly_amount * n;
    return Math.round(sip + existing_lumpsum * Math.pow(1 + rate / 100, years));
  };

  return {
    currency: 'INR',
    total_future_value:      Math.round(totalFV),
    total_future_value_fmt:  fmtInr(totalFV),
    total_invested:          Math.round(totalInvested),
    total_invested_fmt:      fmtInr(totalInvested),
    wealth_gained:           Math.round(totalFV - totalInvested),
    wealth_gained_fmt:       fmtInr(totalFV - totalInvested),
    return_multiple:         +((totalFV / Math.max(1, totalInvested)).toFixed(2)),
    scenarios: {
      pessimistic: { rate_pct: expected_annual_return_pct - 2, future_value: scenarioFV(expected_annual_return_pct - 2), future_value_fmt: fmtInr(scenarioFV(expected_annual_return_pct - 2)) },
      base:        { rate_pct: expected_annual_return_pct,     future_value: Math.round(totalFV),                        future_value_fmt: fmtInr(totalFV) },
      optimistic:  { rate_pct: expected_annual_return_pct + 2, future_value: scenarioFV(expected_annual_return_pct + 2), future_value_fmt: fmtInr(scenarioFV(expected_annual_return_pct + 2)) },
    },
    inputs: { monthly_amount, years, expected_annual_return_pct, existing_lumpsum },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Income Tax Computation — FY 2025-26 (AY 2026-27)
// ─────────────────────────────────────────────────────────────────────────────

const NEW_REGIME_SLABS = [
  { from: 0,         to: 400000,   rate: 0.00 },
  { from: 400000,    to: 800000,   rate: 0.05 },
  { from: 800000,    to: 1200000,  rate: 0.10 },
  { from: 1200000,   to: 1600000,  rate: 0.15 },
  { from: 1600000,   to: 2000000,  rate: 0.20 },
  { from: 2000000,   to: 2400000,  rate: 0.25 },
  { from: 2400000,   to: Infinity, rate: 0.30 },
];

const OLD_REGIME_SLABS = [
  { from: 0,         to: 250000,   rate: 0.00 },
  { from: 250000,    to: 500000,   rate: 0.05 },
  { from: 500000,    to: 1000000,  rate: 0.20 },
  { from: 1000000,   to: Infinity, rate: 0.30 },
];

const slabTax = (income, slabs) => {
  let tax = 0;
  for (const s of slabs) {
    if (income <= s.from) break;
    tax += (Math.min(income, s.to) - s.from) * s.rate;
  }
  return tax;
};

const addSurcharge = (tax, income) => {
  if (income > 20000000)      return tax * 1.25; // 25%
  if (income > 10000000)      return tax * 1.15; // 15%
  if (income > 5000000)       return tax * 1.10; // 10%
  return tax;
};

export const compute_income_tax = async ({
  annual_income,
  regime = 'compare',
  deductions = {},
}) => {
  const CESS = 0.04;
  const result = {
    currency: 'INR',
    annual_income,
    annual_income_fmt: fmtInr(annual_income),
    assessment_year: 'AY 2026-27 (FY 2025-26)',
  };

  // ── New regime ────────────────────────────────────────────────────────────
  if (regime === 'new' || regime === 'compare') {
    const stdDed        = 75000;
    const taxableIncome = Math.max(0, annual_income - stdDed);
    let baseTax         = slabTax(taxableIncome, NEW_REGIME_SLABS);
    // Section 87A rebate: full rebate up to ₹60,000 if taxable income ≤ ₹12L
    const rebate        = taxableIncome <= 1200000 ? Math.min(baseTax, 60000) : 0;
    baseTax             = Math.max(0, baseTax - rebate);
    const withSurcharge = addSurcharge(baseTax, annual_income);
    const totalTax      = Math.round(withSurcharge * (1 + CESS));

    result.new_regime = {
      standard_deduction: stdDed,
      taxable_income: taxableIncome,
      taxable_income_fmt: fmtInr(taxableIncome),
      tax_before_cess: Math.round(withSurcharge),
      cess_4pct: Math.round(withSurcharge * CESS),
      total_tax_liability: totalTax,
      total_tax_liability_fmt: fmtInr(totalTax),
      effective_rate_pct: +((totalTax / annual_income) * 100).toFixed(2),
      rebate_87a_applied: rebate > 0,
      rebate_87a_amount: Math.round(rebate),
      note: rebate > 0
        ? 'Section 87A rebate applied — zero tax up to ₹12L income (₹12.75L effective after standard deduction)'
        : null,
      allowed_deductions: 'Standard deduction ₹75,000 only. 80C/HRA/80D not available in new regime.',
    };
  }

  // ── Old regime ────────────────────────────────────────────────────────────
  if (regime === 'old' || regime === 'compare') {
    const stdDed     = 50000;
    const ded80c     = Math.min(deductions.section_80c  || 0, 150000);
    const ded80d     = Math.min(deductions.section_80d  || 0, 25000);
    const dedNPS     = Math.min(deductions.nps_80ccd1b  || 0, 50000);
    const dedHRA     = deductions.hra                   || 0;
    const dedHomeLoan= Math.min(deductions.home_loan_interest || 0, 200000);
    const totalDed   = stdDed + ded80c + ded80d + dedNPS + dedHRA + dedHomeLoan;

    const taxableIncome = Math.max(0, annual_income - totalDed);
    let baseTax         = slabTax(taxableIncome, OLD_REGIME_SLABS);
    // 87A rebate: up to ₹12,500 if taxable income ≤ ₹5L
    const rebate        = taxableIncome <= 500000 ? Math.min(baseTax, 12500) : 0;
    baseTax             = Math.max(0, baseTax - rebate);
    const withSurcharge = addSurcharge(baseTax, annual_income);
    const totalTax      = Math.round(withSurcharge * (1 + CESS));

    result.old_regime = {
      standard_deduction: stdDed,
      deductions_claimed: {
        section_80c: ded80c, section_80c_fmt: fmtInr(ded80c),
        section_80d: ded80d, section_80d_fmt: fmtInr(ded80d),
        nps_80ccd1b: dedNPS, nps_80ccd1b_fmt: fmtInr(dedNPS),
        hra: dedHRA,         hra_fmt: fmtInr(dedHRA),
        home_loan_interest: dedHomeLoan, home_loan_interest_fmt: fmtInr(dedHomeLoan),
        total: totalDed,     total_fmt: fmtInr(totalDed),
      },
      taxable_income: taxableIncome,
      taxable_income_fmt: fmtInr(taxableIncome),
      tax_before_cess: Math.round(withSurcharge),
      cess_4pct: Math.round(withSurcharge * CESS),
      total_tax_liability: totalTax,
      total_tax_liability_fmt: fmtInr(totalTax),
      effective_rate_pct: +((totalTax / annual_income) * 100).toFixed(2),
      remaining_80c_limit: fmtInr(Math.max(0, 150000 - ded80c)),
      remaining_nps_limit: fmtInr(Math.max(0, 50000 - dedNPS)),
    };
  }

  // ── Comparison ────────────────────────────────────────────────────────────
  if (regime === 'compare' && result.new_regime && result.old_regime) {
    const newTax   = result.new_regime.total_tax_liability;
    const oldTax   = result.old_regime.total_tax_liability;
    const better   = newTax <= oldTax ? 'new' : 'old';
    const savings  = Math.abs(newTax - oldTax);

    // Show per-deduction marginal value in old regime at effective rate
    const oldMarginal = annual_income > 1000000 ? 0.30 : annual_income > 500000 ? 0.20 : 0.05;
    result.comparison = {
      better_regime: better,
      tax_saving_vs_other: savings,
      tax_saving_fmt: fmtInr(savings),
      summary: `${better === 'new' ? 'New' : 'Old'} regime saves ${fmtInr(savings)} in tax for FY 2025-26`,
      marginal_value_of_deductions_in_old_regime: {
        per_rupee_80c_invested:    `₹${(oldMarginal).toFixed(2)} saved per ₹1 invested in 80C`,
        full_80c_tax_saving:       fmtInr(150000 * oldMarginal),
        full_nps_80ccd_tax_saving: fmtInr(50000 * oldMarginal),
      },
      recommendation: better === 'old'
        ? `Old regime is better because of your deductions. Keep maximising 80C (₹1.5L) and NPS 80CCD(1B) (₹50K) — each rupee saves ${(oldMarginal * 100).toFixed(0)} paise in tax.`
        : `New regime saves more — no need to chase deductions. Simpler filing, no lock-in requirements.`,
    };
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tax Insights  (LTCG + FD TDS + 80C gap)
// ─────────────────────────────────────────────────────────────────────────────

// ELSS detection: covers all common naming conventions across Indian AMCs
const ELSS_PATTERNS = [
  'elss', 'tax saver', 'tax saving', 'tax plan', 'taxsaver',
  'long term equity', 'tax advantage', '80c fund', 'tax shield',
];
const isELSSFund = (mf) => {
  const name = mf.scheme_name.toLowerCase();
  const cat  = (mf.category || '').toLowerCase();
  return cat === 'elss' || ELSS_PATTERNS.some(p => name.includes(p) || cat.includes(p));
};

export const get_tax_insights = async () => {
  const p = readPortfolio();
  const LTCG_EXEMPTION   = 100000;
  const LIMIT_80C        = 150000;
  const FD_TDS_THRESHOLD = 40000; // ₹40K/year per bank per PAN
  const FD_TDS_RATE      = 0.10;

  // ── LTCG harvesting ──────────────────────────────────────────────────────
  const ltcgCandidates = [];
  let totalHarvestableGains = 0;

  for (const s of p.stocks) {
    const yrs  = yearsSince(s.buy_date);
    const gain = (s.current_price - s.avg_buy_price) * s.quantity;
    if (yrs !== null && yrs >= 1 && gain > 0) {
      ltcgCandidates.push({
        name: s.name,
        symbol: s.symbol,
        gain: Math.round(gain),
        gain_fmt: fmtInr(gain),
        years_held: +yrs.toFixed(1),
        tax_type: 'LTCG — 10% above ₹1L exemption',
        falls_within_exemption: totalHarvestableGains + gain <= LTCG_EXEMPTION,
      });
      totalHarvestableGains += gain;
    }
  }

  for (const mf of p.mutual_funds) {
    const yrs  = yearsSince(mf.start_date);
    const gain = mf.units * mf.nav - mf.invested_amount;
    if (yrs !== null && yrs >= 1 && gain > 0) {
      ltcgCandidates.push({
        name: mf.scheme_name,
        symbol: mf.category,
        gain: Math.round(gain),
        gain_fmt: fmtInr(gain),
        years_held: +yrs.toFixed(1),
        tax_type: 'LTCG — 10% above ₹1L exemption',
        falls_within_exemption: totalHarvestableGains + gain <= LTCG_EXEMPTION,
      });
      totalHarvestableGains += gain;
    }
  }

  const ltcgRecommendation = totalHarvestableGains === 0
    ? 'No LTCG harvesting opportunities — no qualifying long-term gains in stocks or MFs right now.'
    : totalHarvestableGains <= LTCG_EXEMPTION
      ? `You can book all ${fmtInr(totalHarvestableGains)} in gains completely tax-free this financial year. Sell and repurchase to reset your cost basis.`
      : `You have ${fmtInr(totalHarvestableGains)} in LTCG gains. Book up to ${fmtInr(LTCG_EXEMPTION)} tax-free; gains above that attract 10% LTCG tax. Consider spreading across financial years.`;

  // ── Crypto (flat 30% VDA tax) ─────────────────────────────────────────────
  const cryptoGains = p.crypto
    .filter(c => (c.current_price_inr - c.avg_buy_price_inr) * c.quantity > 0)
    .map(c => ({
      coin: c.coin,
      gain: Math.round((c.current_price_inr - c.avg_buy_price_inr) * c.quantity),
      gain_fmt: fmtInr((c.current_price_inr - c.avg_buy_price_inr) * c.quantity),
      tax_rate: '30% flat under Section 115BBH',
      estimated_tax: Math.round((c.current_price_inr - c.avg_buy_price_inr) * c.quantity * 0.30),
      estimated_tax_fmt: fmtInr((c.current_price_inr - c.avg_buy_price_inr) * c.quantity * 0.30),
    }));
  const totalCryptoGains = cryptoGains.reduce((s, c) => s + c.gain, 0);
  const totalCryptoTax   = Math.round(totalCryptoGains * 0.30);

  // ── FD TDS ────────────────────────────────────────────────────────────────
  const fdTdsDetails = [];
  let totalAnnualFdInterest = 0;
  let totalFdTds = 0;

  for (const fd of p.fixed_deposits) {
    const annualInterest = Math.round(fd.principal * (fd.interest_rate / 100));
    const tdsApplicable  = annualInterest > FD_TDS_THRESHOLD;
    const tdsAmount      = tdsApplicable ? Math.round(annualInterest * FD_TDS_RATE) : 0;
    totalAnnualFdInterest += annualInterest;
    totalFdTds += tdsAmount;

    fdTdsDetails.push({
      bank: fd.bank,
      principal: fd.principal,
      principal_fmt: fmtInr(fd.principal),
      interest_rate_pct: fd.interest_rate,
      annual_interest: annualInterest,
      annual_interest_fmt: fmtInr(annualInterest),
      tds_applicable: tdsApplicable,
      tds_amount: tdsAmount,
      tds_amount_fmt: tdsApplicable ? fmtInr(tdsAmount) : '₹0',
      action: tdsApplicable
        ? 'Submit Form 15G (below 60 yrs) or 15H (senior) at the start of FY to prevent TDS deduction'
        : 'No TDS — annual interest below ₹40,000 threshold',
    });
  }

  // ── Section 80C gap ──────────────────────────────────────────────────────
  const elssFunds    = p.mutual_funds.filter(isELSSFund);
  const elssInvested = elssFunds.reduce((s, mf) => s + mf.invested_amount, 0);
  const gap80c       = Math.max(0, LIMIT_80C - elssInvested);

  return {
    currency: 'INR',
    assessment_year: 'FY 2025-26',

    ltcg_harvesting: {
      candidates: ltcgCandidates,
      total_harvestable_gains: Math.round(totalHarvestableGains),
      total_harvestable_gains_fmt: fmtInr(totalHarvestableGains),
      annual_exemption_limit: LTCG_EXEMPTION,
      annual_exemption_limit_fmt: fmtInr(LTCG_EXEMPTION),
      recommendation: ltcgRecommendation,
    },

    crypto_tax: {
      total_unrealised_gains: totalCryptoGains,
      total_unrealised_gains_fmt: fmtInr(totalCryptoGains),
      estimated_tax_if_sold: totalCryptoTax,
      estimated_tax_fmt: fmtInr(totalCryptoTax),
      holdings: cryptoGains,
      note: 'Crypto (VDA) gains taxed at 30% flat under Section 115BBH — no ₹1L exemption, no loss offset against other income, no indexation benefit.',
    },

    fd_tds: {
      total_annual_fd_interest: totalAnnualFdInterest,
      total_annual_fd_interest_fmt: fmtInr(totalAnnualFdInterest),
      total_tds_exposure: totalFdTds,
      total_tds_exposure_fmt: fmtInr(totalFdTds),
      tds_threshold_per_bank: FD_TDS_THRESHOLD,
      details: fdTdsDetails,
      action_required: totalFdTds > 0,
      summary: totalFdTds > 0
        ? `${fmtInr(totalFdTds)} TDS will be deducted across your FDs. Submit Form 15G at each bank at the start of FY to avoid deduction if your total income is below the taxable limit.`
        : 'No TDS applicable on your current FDs — all earn below ₹40,000/year per bank.',
    },

    section_80c: {
      annual_limit: LIMIT_80C,
      annual_limit_fmt: fmtInr(LIMIT_80C),
      elss_invested: elssInvested,
      elss_invested_fmt: fmtInr(elssInvested),
      remaining_limit: gap80c,
      remaining_limit_fmt: fmtInr(gap80c),
      utilization_pct: +((elssInvested / LIMIT_80C) * 100).toFixed(1),
      elss_funds_identified: elssFunds.map(mf => mf.scheme_name),
      recommendation: gap80c > 0
        ? `${fmtInr(gap80c)} of 80C limit is unused. Investing in ELSS can save up to ${fmtInr(gap80c * 0.30)} in tax (at 30% slab). ELSS has a 3-year lock-in but highest return potential among 80C instruments.`
        : 'Your ₹1.5L 80C limit is fully utilized.',
    },

    other_deductions: [
      {
        section: '80CCD(1B) — NPS',
        description: 'Additional ₹50,000 NPS contribution — deductible over and above the ₹1.5L 80C limit',
        max_deduction: 50000,
        max_deduction_fmt: fmtInr(50000),
        potential_tax_saving_at_30pct: fmtInr(50000 * 0.30),
        available_in_old_regime_only: true,
      },
      {
        section: '80D — Health Insurance',
        description: 'Health insurance premiums: ₹25,000 for self/family, ₹50,000 if parents are senior citizens',
        max_deduction: 75000,
        max_deduction_fmt: fmtInr(75000),
        available_in_old_regime_only: true,
      },
      {
        section: 'Section 24(b) — Home Loan Interest',
        description: 'Interest on home loan for self-occupied property: up to ₹2L per year',
        max_deduction: 200000,
        max_deduction_fmt: fmtInr(200000),
        potential_tax_saving_at_30pct: fmtInr(200000 * 0.30),
        available_in_old_regime_only: true,
      },
    ],

    tip: 'Use the compute_income_tax tool with your annual income to see exactly which tax regime saves more for you, and the precise rupee value of each deduction.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Rebalancing Advice
// ─────────────────────────────────────────────────────────────────────────────

export const get_rebalancing_advice = async () => {
  const p = readPortfolio();

  const stocksValue = p.stocks.reduce((s, h) => s + h.quantity * h.current_price, 0);
  const mfValue     = p.mutual_funds.reduce((s, h) => s + h.units * h.nav, 0);
  const fdValue     = p.fixed_deposits.reduce((s, h) => s + h.principal, 0);
  const cryptoValue = p.crypto.reduce((s, h) => s + h.quantity * h.current_price_inr, 0);
  const cashValue   = p.savings_accounts.reduce((s, a) => s + a.balance, 0);
  const totalAssets = stocksValue + mfValue + fdValue + cryptoValue + cashValue;

  const target = p.target_allocation || { equity: 55, mutual_funds: 15, fixed_income: 15, crypto: 10, cash: 5 };

  const current = {
    equity:       +((stocksValue / totalAssets) * 100).toFixed(1),
    mutual_funds: +((mfValue / totalAssets) * 100).toFixed(1),
    fixed_income: +((fdValue / totalAssets) * 100).toFixed(1),
    crypto:       +((cryptoValue / totalAssets) * 100).toFixed(1),
    cash:         +((cashValue / totalAssets) * 100).toFixed(1),
  };

  const DRIFT_THRESHOLD = 5;
  const recommendations = [];

  for (const [cls, targetPct] of Object.entries(target)) {
    const actualPct = current[cls] || 0;
    const drift     = +(actualPct - targetPct).toFixed(1);
    if (Math.abs(drift) >= DRIFT_THRESHOLD) {
      const action   = drift > 0 ? 'reduce' : 'increase';
      const rupeeAmt = Math.round(Math.abs(drift / 100) * totalAssets);

      let taxNote = null;
      if (action === 'reduce' && (cls === 'equity' || cls === 'mutual_funds')) {
        const hasStcg = p.stocks.some(s => { const y = yearsSince(s.buy_date); return y !== null && y < 1; });
        taxNote = hasStcg
          ? 'Some holdings held under 1 year — selling triggers STCG at 15%. Prioritise selling holdings held 1+ year (LTCG at 10%, ₹1L exempt).'
          : 'All equity held 1+ year — sells attract LTCG at 10% (first ₹1L exempt).';
      }
      if (action === 'reduce' && cls === 'crypto') {
        taxNote = 'Crypto sales taxed at 30% flat (Section 115BBH) — plan sells carefully to manage tax impact.';
      }

      recommendations.push({
        asset_class:  cls,
        current_pct:  actualPct,
        target_pct:   targetPct,
        drift_pct:    drift,
        action,
        amount_inr:   rupeeAmt,
        amount_fmt:   fmtInr(rupeeAmt),
        tax_note:     taxNote,
      });
    }
  }

  recommendations.sort((a, b) => Math.abs(b.drift_pct) - Math.abs(a.drift_pct));

  const concentrationWarnings = Object.entries(current)
    .filter(([, pct]) => pct > 40)
    .map(([cls, pct]) => `${cls} is at ${pct}% — above the 40% concentration risk threshold`);

  return {
    currency: 'INR',
    portfolio_value:     Math.round(totalAssets),
    portfolio_value_fmt: fmtInr(totalAssets),
    current_allocation:  current,
    target_allocation:   target,
    needs_rebalancing:   recommendations.length > 0,
    drift_threshold_pct: DRIFT_THRESHOLD,
    recommendations,
    concentration_warnings: concentrationWarnings,
    summary: recommendations.length > 0
      ? `${recommendations.length} asset class(es) drifted beyond ${DRIFT_THRESHOLD}% — rebalancing recommended.`
      : `Portfolio within ${DRIFT_THRESHOLD}% drift threshold — no rebalancing needed right now.`,
  };
};
