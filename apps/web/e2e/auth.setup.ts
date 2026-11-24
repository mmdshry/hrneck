import { test as setup } from "@playwright/test";
import {
  loginAsOrgAdmin,
  loginAsPlatformAdmin,
  ORG_STORAGE_STATE,
  PLATFORM_STORAGE_STATE,
  saveStorageState,
} from "./helpers/auth";

// Runs once before the desktop and mobile projects. Specs reuse these sessions with
// test.use({ storageState }) instead of logging in through the UI for every test.
setup("save org admin session", async ({ page }) => {
  await loginAsOrgAdmin(page);
  await saveStorageState(page, ORG_STORAGE_STATE);
});

setup("save platform admin session", async ({ page }) => {
  await loginAsPlatformAdmin(page);
  await saveStorageState(page, PLATFORM_STORAGE_STATE);
});
