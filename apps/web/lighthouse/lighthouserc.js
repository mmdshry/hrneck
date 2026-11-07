const urls = require("./urls.json").map((path) => `http://127.0.0.1:3100${path}`);

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        formFactor: "desktop",
        screenEmulation: { disabled: true },
        // Agentic Browsing (3/3) is covered by a11y names/labels + CLS + public/llms.txt.
        // Assert it in Chrome DevTools (Chrome 150+) when the category is available;
        // LHCI's bundled Lighthouse may not expose the experimental category yet.
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 1 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
