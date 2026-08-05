// How many projects an account may create before paying.
export const FREE_LIMITS = {
  show: 2,
  pattern_book: 2,
};

export const freeLimitFor = (projectType) => FREE_LIMITS[projectType] ?? 2;

/**
 * Decides whether an account may create another project.
 *
 * The free limit only applies to accounts that are not paying. Without that
 * check, a member with an active subscription was shown "Free Limit Reached —
 * upgrade to a membership plan" on the tool their membership already paid for,
 * as soon as they had two locked projects. Admins are never limited either.
 *
 * Lives here rather than in useUsageGate so the rule can be tested without
 * pulling in the Supabase client.
 */
export const computeUsageAllowance = ({ isSubscribed, isAdmin, count, freeLimit }) => {
  const isUnlimited = Boolean(isSubscribed || isAdmin);
  return {
    isUnlimited,
    canCreate: isUnlimited || count < freeLimit,
    remainingFree: isUnlimited ? Infinity : Math.max(0, freeLimit - count),
  };
};
