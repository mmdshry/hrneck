/**
 * PM2 process file for HRNECK production.
 * Run from repo root: pm2 start deploy/ecosystem.config.cjs
 */
const path = require("path");

const root = path.resolve(__dirname, "..");
const apiRoot = path.join(root, "apps", "api");
const webRoot = path.join(root, "apps", "web");

module.exports = {
  apps: [
    {
      name: "hrneck-web",
      cwd: webRoot,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3100",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3100",
      },
    },
    {
      name: "hrneck-reverb",
      cwd: apiRoot,
      script: "artisan",
      interpreter: "php",
      args: "reverb:start --host=127.0.0.1 --port=8080",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "256M",
    },
    {
      name: "hrneck-horizon",
      cwd: apiRoot,
      script: "artisan",
      interpreter: "php",
      args: "horizon",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 30,
      min_uptime: "10s",
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "512M",
    },
  ],
};
