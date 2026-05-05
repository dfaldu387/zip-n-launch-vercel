/**
 * Financial Projection Engine for Horse Shows
 *
 * Takes formData from useShowBuilder and projectionAssumptions,
 * returns a complete financial model with revenue, costs, and profit.
 */

// ── Default Assumptions (user-adjustable) ──

export const DEFAULT_ASSUMPTIONS = {
  expectedHorses: 80,
  avgClassesPerHorse: 6,
  expectedStalls: 60,
  stallOccupancyRate: 0.85,    // 85%
  haulInPercentage: 0.25,      // 25% of horses haul-in
  rvSpots: 15,
  rvOccupancyRate: 0.70,
  showDays: 3,
  judgeCount: 2,
  lateEntryPercentage: 0.10,   // 10% of entries are late
  scratchPercentage: 0.05,     // 5% of entries scratch
  shavingsBagsPerStall: 3,
  sponsorCollectionRate: 0.90, // 90% of pledged sponsorship collected
  expenseContingency: 0.05,    // 5% contingency on expenses
};

// ── Fee Type Multipliers ──

function calcFeeRevenue(fees, assumptions) {
  const {
    expectedHorses, avgClassesPerHorse, expectedStalls, stallOccupancyRate,
    haulInPercentage, rvSpots, rvOccupancyRate, showDays, judgeCount,
    lateEntryPercentage, scratchPercentage, shavingsBagsPerStall,
  } = assumptions;

  const totalEntries = expectedHorses * avgClassesPerHorse;
  const occupiedStalls = Math.round(expectedStalls * stallOccupancyRate);
  const haulInHorses = Math.round(expectedHorses * haulInPercentage);
  const occupiedRV = Math.round(rvSpots * rvOccupancyRate);

  const breakdown = [];
  let total = 0;

  for (const fee of fees) {
    const amount = parseFloat(fee.amount) || 0;
    if (amount === 0) continue;

    let qty = 0;
    let label = fee.name;
    const perJudge = fee.apply_per_judge ? judgeCount : 1;

    switch (fee.type) {
      case 'per_class':
        qty = totalEntries * perJudge;
        label = `${fee.name} (${totalEntries} entries x ${perJudge} judge${perJudge > 1 ? 's' : ''})`;
        break;
      case 'per_horse':
        qty = expectedHorses;
        label = `${fee.name} (${expectedHorses} horses)`;
        break;
      case 'ancillary': {
        const stdId = fee.standard_id || '';
        if (stdId.includes('stall')) {
          qty = occupiedStalls;
          label = `${fee.name} (${occupiedStalls} stalls)`;
        } else if (stdId.includes('rv') || stdId.includes('camping')) {
          qty = occupiedRV * showDays;
          label = `${fee.name} (${occupiedRV} spots x ${showDays} nights)`;
        } else if (stdId.includes('shavings') || stdId.includes('bedding')) {
          qty = occupiedStalls * shavingsBagsPerStall;
          label = `${fee.name} (${occupiedStalls} stalls x ${shavingsBagsPerStall} bags)`;
        } else if (stdId.includes('trail_equip')) {
          qty = Math.round(expectedHorses * 0.3); // ~30% do trail
          label = `${fee.name} (~${qty} trail horses)`;
        } else if (stdId.includes('cattle')) {
          qty = Math.round(totalEntries * 0.08); // ~8% cattle classes
          label = `${fee.name} (~${qty} cattle runs)`;
        } else {
          qty = expectedHorses;
          label = `${fee.name} (${expectedHorses} est.)`;
        }
        break;
      }
      case 'flat': {
        const stdId = fee.standard_id || '';
        if (stdId.includes('late')) {
          qty = Math.round(totalEntries * lateEntryPercentage);
          label = `${fee.name} (~${qty} late entries)`;
        } else if (stdId.includes('scratch')) {
          qty = Math.round(totalEntries * scratchPercentage);
          label = `${fee.name} (~${qty} scratches)`;
        } else if (stdId.includes('nsf')) {
          qty = Math.round(expectedHorses * 0.02); // ~2% NSF
          label = `${fee.name} (~${qty} est.)`;
        } else {
          qty = expectedHorses;
        }
        break;
      }
      default:
        qty = expectedHorses;
    }

    // Handle haul-in fee specifically
    if ((fee.standard_id || '').includes('haul_in')) {
      qty = haulInHorses * showDays;
      label = `${fee.name} (${haulInHorses} horses x ${showDays} days)`;
    }

    const revenue = amount * qty;
    total += revenue;
    breakdown.push({ id: fee.id, name: fee.name, label, amount, qty, revenue, timing: fee.payment_timing });
  }

  return { total, breakdown };
}

// ── Sponsor Revenue ──

function calcSponsorRevenue(sponsors, sponsorLevels, assumptions) {
  const { sponsorCollectionRate } = assumptions;
  const breakdown = [];
  let pledged = 0;
  let projected = 0;

  // Group by level
  const byLevel = {};
  for (const level of (sponsorLevels || [])) {
    byLevel[level.id] = { level, sponsors: [] };
  }
  byLevel['unassigned'] = { level: { name: 'Unassigned', amount: 0 }, sponsors: [] };

  for (const sponsor of (sponsors || [])) {
    const key = sponsor.levelId && byLevel[sponsor.levelId] ? sponsor.levelId : 'unassigned';
    byLevel[key].sponsors.push(sponsor);
  }

  for (const [levelId, group] of Object.entries(byLevel)) {
    if (group.sponsors.length === 0) continue;
    const levelPledged = group.sponsors.reduce((sum, s) => {
      const sponsorAmount = parseFloat(s.amount) || 0;
      return sum + (sponsorAmount > 0 ? sponsorAmount : (group.level.amount || 0));
    }, 0);
    const levelProjected = levelPledged * sponsorCollectionRate;
    pledged += levelPledged;
    projected += levelProjected;
    breakdown.push({
      levelId,
      levelName: group.level.name,
      sponsorCount: group.sponsors.length,
      pledged: levelPledged,
      projected: levelProjected,
    });
  }

  return { pledged, projected, breakdown };
}

// ── Expense Projection ──

function calcExpenseProjection(expenses, awardExpenses, assumptions) {
  const { expenseContingency } = assumptions;

  const expenseBreakdown = [];
  let expenseTotal = 0;

  // Show expenses grouped by category
  const byCategory = {};
  for (const exp of (expenses || [])) {
    const amount = parseFloat(exp.amount) || 0;
    if (amount === 0 && !exp.name) continue;
    const cat = exp.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = { items: [], total: 0 };
    byCategory[cat].items.push(exp);
    byCategory[cat].total += amount;
    expenseTotal += amount;
  }

  for (const [category, data] of Object.entries(byCategory)) {
    expenseBreakdown.push({
      category,
      itemCount: data.items.length,
      total: data.total,
    });
  }

  // Award expenses
  let awardTotal = 0;
  const awardBreakdown = [];
  for (const award of (awardExpenses || [])) {
    const cost = (parseFloat(award.amount) || 0) * (parseInt(award.qty) || 1);
    awardTotal += cost;
    if (award.name) {
      awardBreakdown.push({ name: award.name, cost, qty: parseInt(award.qty) || 1 });
    }
  }

  const subtotal = expenseTotal + awardTotal;
  const contingencyAmount = subtotal * expenseContingency;
  const totalWithContingency = subtotal + contingencyAmount;

  return {
    expenses: { total: expenseTotal, breakdown: expenseBreakdown },
    awards: { total: awardTotal, breakdown: awardBreakdown },
    contingencyRate: expenseContingency,
    contingencyAmount,
    subtotal,
    totalWithContingency,
  };
}

// ── Timing Breakdown ──

function calcTimingBreakdown(feeBreakdown) {
  const timings = {
    pre_entry: { label: 'Pre-Entry / Reservation', total: 0, items: [] },
    at_check_in: { label: 'At Check-In', total: 0, items: [] },
    settlement: { label: 'Post-Show / Settlement', total: 0, items: [] },
  };

  for (const item of feeBreakdown) {
    const key = item.timing || 'settlement';
    if (timings[key]) {
      timings[key].total += item.revenue;
      timings[key].items.push(item);
    }
  }

  return timings;
}

// ── Main Projection Function ──

export function calculateProjections(formData, customAssumptions = {}) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...customAssumptions };

  const fees = formData.fees || [];
  const sponsors = formData.sponsors || [];
  const sponsorLevels = formData.sponsorLevels || [];
  const showExpenses = formData.showExpenses || [];
  const awardExpenses = formData.awardExpenses || [];

  // Revenue
  const feeRevenue = calcFeeRevenue(fees, assumptions);
  const sponsorRevenue = calcSponsorRevenue(sponsors, sponsorLevels, assumptions);
  const totalRevenue = feeRevenue.total + sponsorRevenue.projected;

  // Costs
  const costProjection = calcExpenseProjection(showExpenses, awardExpenses, assumptions);

  // Profit
  const grossProfit = totalRevenue - costProjection.subtotal;
  const netProfit = totalRevenue - costProjection.totalWithContingency;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Cash flow timing
  const timingBreakdown = calcTimingBreakdown(feeRevenue.breakdown);

  // Scenario analysis
  const scenarios = {
    optimistic: calcScenario(formData, assumptions, 1.20), // +20% horses
    expected: { totalRevenue, totalCost: costProjection.totalWithContingency, netProfit },
    conservative: calcScenario(formData, assumptions, 0.75), // -25% horses
  };

  // Break-even
  const fixedCosts = costProjection.totalWithContingency;
  const revenuePerHorse = assumptions.expectedHorses > 0 ? feeRevenue.total / assumptions.expectedHorses : 0;
  const breakEvenHorses = revenuePerHorse > 0 ? Math.ceil(fixedCosts / revenuePerHorse) : 0;

  return {
    assumptions,
    revenue: {
      fees: feeRevenue,
      sponsors: sponsorRevenue,
      total: totalRevenue,
    },
    costs: costProjection,
    profit: {
      gross: grossProfit,
      net: netProfit,
      margin: profitMargin,
    },
    timing: timingBreakdown,
    scenarios,
    breakEven: {
      horses: breakEvenHorses,
      currentHorses: assumptions.expectedHorses,
      surplus: assumptions.expectedHorses - breakEvenHorses,
    },
  };
}

// ── Helper: Run scenario with a multiplier ──

function calcScenario(formData, baseAssumptions, multiplier) {
  const scenarioAssumptions = {
    ...baseAssumptions,
    expectedHorses: Math.round(baseAssumptions.expectedHorses * multiplier),
    expectedStalls: Math.round(baseAssumptions.expectedStalls * multiplier),
    rvSpots: Math.round(baseAssumptions.rvSpots * multiplier),
  };

  const feeRev = calcFeeRevenue(formData.fees || [], scenarioAssumptions);
  const sponsorRev = calcSponsorRevenue(
    formData.sponsors || [],
    formData.sponsorLevels || [],
    scenarioAssumptions
  );
  const totalRevenue = feeRev.total + sponsorRev.projected;
  const costs = calcExpenseProjection(
    formData.showExpenses || [],
    formData.awardExpenses || [],
    scenarioAssumptions
  );

  return {
    totalRevenue,
    totalCost: costs.totalWithContingency,
    netProfit: totalRevenue - costs.totalWithContingency,
  };
}
