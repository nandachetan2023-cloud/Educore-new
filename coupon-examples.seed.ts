export const COUPON_EXAMPLES = [
  { code: 'WELCOME20', description: '20% off first purchase', type: 'percentage', value: 20, minOrderAmount: 0, maxDiscount: 50, target: 'all', usageLimit: 100, perUserLimit: 1, status: true, approvalStatus: 'approved' },
  { code: 'FIXED50', description: 'Flat $50 discount', type: 'fixed', value: 50, minOrderAmount: 200, maxDiscount: null, target: 'courses', usageLimit: 50, perUserLimit: 1, status: true, approvalStatus: 'approved' },
  { code: 'STUDENT15', description: '15% student discount', type: 'percentage', value: 15, minOrderAmount: 0, maxDiscount: 30, target: 'all', usageLimit: 200, perUserLimit: 2, status: true, approvalStatus: 'approved' },
];
