import { test, expect } from "@playwright/test";
import { loginAsOrgAdmin } from "./helpers/auth";

test.describe("Learner portal", () => {
  test("assigns a course then shows progress in /learn", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsOrgAdmin(page);

    const result = await page.evaluate(async () => {
      const xsrf = decodeURIComponent(
        document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? "",
      );
      const headers = (extra: Record<string, string> = {}) => ({
        "X-Tenant": "itneck",
        Accept: "application/json",
        "X-XSRF-TOKEN": xsrf,
        "X-Requested-With": "XMLHttpRequest",
        ...extra,
      });

      const coursesRes = await fetch("/api/v1/org/training/courses", {
        credentials: "include",
        headers: headers(),
      });
      const coursesBody = await coursesRes.json();
      const courseId = coursesBody.data?.[0]?.id;
      if (!coursesRes.ok || !courseId) {
        return { ok: false as const, step: "courses", status: coursesRes.status };
      }

      const targetRes = await fetch("/api/v1/org/targets", {
        method: "POST",
        credentials: "include",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email: "admin@itneck.test",
          first_name: "Org",
          last_name: "Admin",
          department: "Security",
        }),
      });
      let targetId: number | undefined;
      if (targetRes.status === 201) {
        targetId = (await targetRes.json()).data?.id;
      } else {
        const existing = await fetch("/api/v1/org/targets?q=admin%40itneck.test", {
          credentials: "include",
          headers: headers(),
        });
        targetId = (await existing.json()).data?.[0]?.id;
      }
      if (!targetId) {
        return { ok: false as const, step: "target", status: targetRes.status };
      }

      const assignRes = await fetch("/api/v1/org/training/assign", {
        method: "POST",
        credentials: "include",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          course_id: courseId,
          target_ids: [targetId],
        }),
      });
      if (!assignRes.ok) {
        return { ok: false as const, step: "assign", status: assignRes.status };
      }

      return { ok: true as const };
    });

    expect(result.ok).toBeTruthy();

    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/security fundamentals|learner portal|progress|assigned/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
