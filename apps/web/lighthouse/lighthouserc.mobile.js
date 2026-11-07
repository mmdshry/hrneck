const urls = require("./urls.json").map((path) => `http://127.0.0.1:3100${path}`);

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 1,
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 915,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
        // Match desktop budget intent on constrained viewport without 4x CPU throttle.
        throttlingMethod: "devtools",
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          requestLatencyMs: 0,
          downloadThroughputKbps: 10240,
          uploadThroughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
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
      outputDir: "./.lighthouseci-mobile",
    },
  },
};
