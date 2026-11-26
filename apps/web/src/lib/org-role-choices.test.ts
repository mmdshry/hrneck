import { describe, expect, it } from "vitest";
import { roleChoicesFor } from "./org-role-choices";

const catalog = [{ name: "learner" }, { name: "hr_manager" }];

describe("roleChoicesFor", () => {
  it("offers a no-role option first when the login has no role", () => {
    expect(roleChoicesFor([], catalog, "No role")).toEqual({
      value: "",
      options: [
        { value: "", label: "No role" },
        { value: "learner", label: "learner" },
        { value: "hr_manager", label: "hr_manager" },
      ],
    });
  });

  it("selects the first stored role when it is in the catalog", () => {
    const choice = roleChoicesFor(["hr_manager"], catalog, "No role");
    expect(choice.value).toBe("hr_manager");
    expect(choice.options.map((option) => option.value)).toEqual(["learner", "hr_manager"]);
  });

  it("keeps a stored role that is missing from the catalog so the select shows it", () => {
    const choice = roleChoicesFor(["org_admin"], catalog, "No role");
    expect(choice.value).toBe("org_admin");
    expect(choice.options[0]).toEqual({ value: "org_admin", label: "org_admin" });
  });
});
