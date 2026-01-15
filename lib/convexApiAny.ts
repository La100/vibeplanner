/* eslint-disable @typescript-eslint/no-require-imports */

// Centralized escape hatch to avoid deep type instantiation from generated api types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiAny = require("@/convex/_generated/api").api as any;
