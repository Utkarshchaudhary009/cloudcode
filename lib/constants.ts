// Rate limiting configuration
export const MAX_MESSAGES_PER_DAY = parseInt(process.env.MAX_MESSAGES_PER_DAY || '5', 10)

// Sandbox configuration (in minutes)
// NOTE: Vercel Hobby plan max is 45 minutes, Pro plan allows up to 5 hours (300 min)
export const MAX_SANDBOX_DURATION = parseInt(process.env.MAX_SANDBOX_DURATION || '45', 10)
