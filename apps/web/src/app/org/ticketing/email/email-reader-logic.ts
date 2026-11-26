import type { SdDesk } from "../ticketing-types";

export type Reader = {
  id: number;
  name: string;
  desk_id: number;
  host: string;
  port?: number;
  username: string;
  is_active: boolean;
  last_polled_at?: string | null;
};

export type ReaderMode = "create" | "update";

/** Text-field values as typed; converted to numbers and booleans only in the request body. */
export type ReaderForm = {
  name: string;
  desk_id: string;
  host: string;
  port: string;
  username: string;
  password: string;
  is_active: boolean;
};

type ReaderRequestBody = {
  name: string;
  desk_id: number;
  host: string;
  port: number;
  username: string;
  encryption: "ssl";
  is_active: boolean;
  password?: string;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 993;

/** Desk preselected for a new reader: the first incident desk, otherwise the first desk. */
export function defaultDeskId(desks: readonly SdDesk[]): string {
  const preferred = desks.find((desk) => desk.type === "incident") ?? desks[0];
  return preferred ? String(preferred.id) : "";
}

/** Starting values for the add flow (`reader` null) or the edit flow. The password is never pre-filled. */
export function readerFormFor(reader: Reader | null, desks: readonly SdDesk[]): ReaderForm {
  if (reader) {
    return {
      name: reader.name,
      desk_id: String(reader.desk_id),
      host: reader.host,
      port: String(reader.port ?? DEFAULT_PORT),
      username: reader.username,
      password: "",
      is_active: reader.is_active,
    };
  }
  return {
    name: "",
    desk_id: defaultDeskId(desks),
    host: DEFAULT_HOST,
    port: String(DEFAULT_PORT),
    username: "",
    password: "",
    is_active: true,
  };
}

/** An edit with a blank password keeps the stored one; the API only receives a replacement. */
export function keepsStoredPassword(form: ReaderForm, mode: ReaderMode): boolean {
  return mode === "update" && form.password.trim() === "";
}

export function readerRequestBody(form: ReaderForm, mode: ReaderMode): ReaderRequestBody {
  const body: ReaderRequestBody = {
    name: form.name,
    desk_id: Number(form.desk_id),
    host: form.host,
    port: Number(form.port),
    username: form.username,
    encryption: "ssl",
    is_active: form.is_active,
  };
  if (keepsStoredPassword(form, mode)) {
    return body;
  }
  return { ...body, password: form.password };
}

/** True when any field differs from the values the wizard opened with. */
export function isReaderFormDirty(form: ReaderForm, initial: ReaderForm): boolean {
  return (Object.keys(initial) as Array<keyof ReaderForm>).some(
    (key) => form[key] !== initial[key],
  );
}
