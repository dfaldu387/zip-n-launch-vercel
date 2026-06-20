import { parseDivisionId } from '@/lib/showBillUtils';

// Build divisions (with class counts) from disciplines.
// Mirrors the derivation in AwardsSponsorshipStep so circuit-award math matches.
function getAwardDivisions(formData) {
  const disciplines = formData.disciplines || [];
  const divMap = {};
  for (const disc of disciplines) {
    for (const divId of (disc.divisionOrder || [])) {
      const name = disc.divisionPrintTitles?.[divId] || parseDivisionId(divId).divisionName;
      if (!divMap[name]) divMap[name] = { id: name, name, classCount: 0 };
      divMap[name].classCount++;
    }
  }
  return Object.values(divMap);
}

/**
 * Total cost of "structured" awards (High Point / All-Around, Circuit, Special)
 * saved under formData.structuredAwards.
 *
 * This mirrors the calculation in AwardsSponsorshipStep (Step 5) so the Review
 * summary and the Excel export match exactly what the user sees while editing.
 * Circuit awards multiply (cost-per-class + prize value) by the number of
 * classes in the chosen division ('__all__' = every class). Donated prizes are
 * tracked separately and are not part of the cash cost.
 *
 * @param {object} formData
 * @returns {{ structuredTotal: number, structuredDonated: number, circuitAutoTotal: number }}
 */
export function computeStructuredAwardsTotal(formData) {
  const structuredAwards = formData.structuredAwards || {};
  const divisions = getAwardDivisions(formData);
  const totalAllDivisions = divisions.reduce((sum, d) => sum + d.classCount, 0);

  let total = 0;
  let donated = 0;
  let circuitAuto = 0;

  for (const [catId, items] of Object.entries(structuredAwards)) {
    for (const item of (items || [])) {
      if (!item) continue;
      const prizes = item.prizes || [];
      const prizeTotal = prizes.reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);
      const prizeDonated = prizes
        .filter(p => p.source === 'donated')
        .reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);

      if (catId === 'circuit' && item.division) {
        const costPerClass = parseFloat(item.costPerClass) || 0;
        const perClass = costPerClass + prizeTotal;
        let classCount = 0;
        if (item.division === '__all__') {
          classCount = totalAllDivisions;
        } else {
          const div = divisions.find(d => d.id === item.division);
          classCount = div ? div.classCount : 0;
        }
        const autoTotal = perClass * classCount;
        circuitAuto += autoTotal;
        total += autoTotal;
        donated += prizeDonated * classCount;
      } else {
        total += prizeTotal;
        donated += prizeDonated;
      }
    }
  }

  return { structuredTotal: total, structuredDonated: donated, circuitAutoTotal: circuitAuto };
}
