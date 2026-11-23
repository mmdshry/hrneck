import majorCities from "./major-cities.json";

export const MAJOR_CITIES = majorCities as readonly string[];

const CITY_SET = new Set(MAJOR_CITIES);

export function isMajorCity(value: string | null | undefined): boolean {
  return typeof value === "string" && CITY_SET.has(value);
}
