import { describe, expect, it } from "vitest";
import type { SdDesk } from "../ticketing-types";
import {
  defaultDeskId,
  isReaderFormDirty,
  keepsStoredPassword,
  readerFormFor,
  readerRequestBody,
  type Reader,
  type ReaderForm,
} from "./email-reader-logic";

function desk(id: number, type: string): SdDesk {
  return { id, name: `Desk ${id}`, slug: `desk-${id}`, type, is_active: true };
}

const reader: Reader = {
  id: 4,
  name: "Support inbox",
  desk_id: 2,
  host: "mail.example.test",
  port: 143,
  username: "support",
  is_active: false,
};

const baseForm: ReaderForm = {
  name: "Support inbox",
  desk_id: "2",
  host: "mail.example.test",
  port: "993",
  username: "support",
  password: "",
  is_active: true,
};

describe("defaultDeskId", () => {
  it("prefers the first incident desk", () => {
    expect(defaultDeskId([desk(1, "service"), desk(2, "incident")])).toBe("2");
  });

  it("falls back to the first desk without an incident desk", () => {
    expect(defaultDeskId([desk(5, "service")])).toBe("5");
  });

  it("returns an empty value when there are no desks", () => {
    expect(defaultDeskId([])).toBe("");
  });
});

describe("readerFormFor", () => {
  it("starts the add flow with defaults and the preselected desk", () => {
    expect(readerFormFor(null, [desk(1, "service"), desk(2, "incident")])).toEqual({
      name: "",
      desk_id: "2",
      host: "127.0.0.1",
      port: "993",
      username: "",
      password: "",
      is_active: true,
    });
  });

  it("fills the edit flow from the reader and never pre-fills the password", () => {
    expect(readerFormFor(reader, [])).toEqual({
      name: "Support inbox",
      desk_id: "2",
      host: "mail.example.test",
      port: "143",
      username: "support",
      password: "",
      is_active: false,
    });
  });

  it("uses the default port when the reader has none", () => {
    expect(readerFormFor({ ...reader, port: undefined }, []).port).toBe("993");
  });
});

describe("keepsStoredPassword", () => {
  it("keeps the stored password on edit when the field is blank or whitespace", () => {
    expect(keepsStoredPassword({ ...baseForm, password: "   " }, "update")).toBe(true);
  });

  it("never keeps a password on create", () => {
    expect(keepsStoredPassword(baseForm, "create")).toBe(false);
  });

  it("replaces the stored password when a new one is typed", () => {
    expect(keepsStoredPassword({ ...baseForm, password: "new-secret" }, "update")).toBe(false);
  });
});

describe("readerRequestBody", () => {
  it("sends the password and numeric ids on create", () => {
    expect(
      readerRequestBody({ ...baseForm, password: "secret" }, "create"),
    ).toEqual({
      name: "Support inbox",
      desk_id: 2,
      host: "mail.example.test",
      port: 993,
      username: "support",
      encryption: "ssl",
      is_active: true,
      password: "secret",
    });
  });

  it("omits the password on edit when it is blank", () => {
    const body = readerRequestBody(baseForm, "update");
    expect(body).not.toHaveProperty("password");
    expect(body).toMatchObject({ desk_id: 2, port: 993, encryption: "ssl", is_active: true });
  });

  it("includes a replacement password on edit", () => {
    expect(readerRequestBody({ ...baseForm, password: "rotated" }, "update")).toMatchObject({
      password: "rotated",
    });
  });
});

describe("isReaderFormDirty", () => {
  it("is clean when nothing changed", () => {
    expect(isReaderFormDirty(baseForm, { ...baseForm })).toBe(false);
  });

  it("is dirty after typing in the password field", () => {
    expect(isReaderFormDirty({ ...baseForm, password: "x" }, baseForm)).toBe(true);
  });

  it("is dirty after toggling active", () => {
    expect(isReaderFormDirty({ ...baseForm, is_active: false }, baseForm)).toBe(true);
  });
});
