export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: "Free",
    maxMembers: 2,
    maxUploadBytes: 100 * 1024 * 1024,
    durationHours: 1,
    uploadLabel: "100 MB",
  },
  SILVER: {
    name: "Silver",
    maxMembers: 4,
    maxUploadBytes: 512 * 1024 * 1024,
    durationHours: 6,
    uploadLabel: "512 MB",
  },
  GOLD: {
    name: "Gold",
    maxMembers: 8,
    maxUploadBytes: 1536 * 1024 * 1024,
    durationHours: 12,
    uploadLabel: "1.5 GB",
  },
};

export function getSubscriptionLimits(plan) {
  const limits = SUBSCRIPTION_PLANS[plan];
  if (!limits) {
    throw new Error(`Unknown subscription plan: ${plan}`);
  }
  return limits;
}
