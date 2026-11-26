import { describe, expect, it } from "vitest";
import {
  createTargetBody,
  isTargetFormDirty,
  resolveCreateRole,
} from "./target-form-logic";
import { emptyTargetForm, type TargetFormState } from "./target-types";

describe("resolveCreateRole", () => {
  it("keeps the selected role when the viewer can assign it", () => {
    expect(resolveCreateRole(["learner", "manager"], "manager")).toBe("manager");
  });

  it("drops the selection when the role is not assignable", () => {
    expect(resolveCreateRole(["manager"], "learner")).toBe("");
  });
});

describe("isTargetFormDirty", () => {
  it("is clean when nothing differs from the opening state", () => {
    const initial = emptyTargetForm();

    expect(isTargetFormDirty({ ...initial }, initial)).toBe(false);
  });

  it("is dirty when any field differs from the opening state", () => {
    const initial = emptyTargetForm();

    expect(isTargetFormDirty({ ...initial, job_title: "Analyst" }, initial)).toBe(true);
  });
});

describe("createTargetBody", () => {
  const form: TargetFormState = { ...emptyTargetForm(), email: " ana@example.test " };

  it("sends the shared payload without status, password or roles when unset", () => {
    const body = createTargetBody(form, { password: "", roleName: "" });

    expect(body.email).toBe("ana@example.test");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("roles");
  });

  it("adds the password and role when provided", () => {
    const body = createTargetBody(form, { password: "secret123", roleName: "learner" });

    expect(body.password).toBe("secret123");
    expect(body.roles).toEqual(["learner"]);
  });
});
