/**
 * Minimal Lighthouse assertion helper used by CI.
 * Expects category scores of 1 (100) for product routes.
 */
export const assertions = {
  "categories:performance": ["error", { minScore: 1 }],
  "categories:accessibility": ["error", { minScore: 1 }],
  "categories:best-practices": ["error", { minScore: 1 }],
  "categories:seo": ["error", { minScore: 1 }],
};
