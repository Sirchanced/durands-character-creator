import { STAT_KEYS, STAT_LABELS, StatKey, clampNumber } from "./character";

export type StatModifiers = Partial<Record<StatKey, number>>;

export type CatalogEntry = {
  name: string;
  modifiers: StatModifiers;
};

export type GameCatalog = {
  races: CatalogEntry[];
  classes: CatalogEntry[];
  materials: string[];
};

const CATALOG_STORAGE_KEY = "durands-game-catalog-v2";

const DEFAULT_CATALOG: GameCatalog = {
  races: [
    {
      name: "Palamya",
      modifiers: {
        resilience: 2,
        intelligence: -2,
        sociability: 8,
      },
    },
  ],
  classes: [
    {
      name: "Vanguard",
      modifiers: {
        maxHealth: 3,
        resilience: 3,
      },
    },
  ],
  materials: [],
};

let catalog: GameCatalog = loadCatalog();

export function getCatalog(): GameCatalog {
  return catalog;
}

export function getRaceNames(): string[] {
  return catalog.races.map((entry) => entry.name);
}

export function getClassNames(): string[] {
  return catalog.classes.map((entry) => entry.name);
}

export function getMaterialNames(): string[] {
  return [...catalog.materials];
}

export function getRaceModifiers(race: string): StatModifiers {
  return catalog.races.find((entry) => entry.name === race)?.modifiers ?? {};
}

export function getClassModifiers(className: string): StatModifiers {
  return (
    catalog.classes.find((entry) => entry.name === className)?.modifiers ?? {}
  );
}

export function addRace(name: string, modifiers: StatModifiers): string | null {
  return addEntry("races", name, modifiers);
}

export function addClass(
  name: string,
  modifiers: StatModifiers,
): string | null {
  return addEntry("classes", name, modifiers);
}

export function addMaterial(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (
    catalog.materials.some(
      (entry) => entry.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return "That material already exists.";
  }
  catalog = {
    ...catalog,
    materials: [...catalog.materials, trimmed],
  };
  persistCatalog();
  return null;
}

export function removeRace(name: string): boolean {
  return removeEntry("races", name);
}

export function removeClass(name: string): boolean {
  return removeEntry("classes", name);
}

export function removeMaterial(name: string): boolean {
  const next = catalog.materials.filter((entry) => entry !== name);
  if (next.length === catalog.materials.length) return false;
  catalog = { ...catalog, materials: next };
  persistCatalog();
  return true;
}

export function formatModifiers(modifiers: StatModifiers): string {
  const parts = STAT_KEYS.filter((key) => (modifiers[key] ?? 0) !== 0).map(
    (key) => {
      const value = modifiers[key] ?? 0;
      const sign = value > 0 ? "+" : "";
      return `${STAT_LABELS[key]} ${sign}${value}`;
    },
  );
  return parts.length > 0 ? parts.join(", ") : "No stat adjustments";
}

export function cleanModifiers(
  raw: Partial<Record<StatKey, number>>,
): StatModifiers {
  const cleaned: StatModifiers = {};
  for (const key of STAT_KEYS) {
    const value = clampNumber(Number(raw[key] ?? 0), -999, 999);
    if (value !== 0) cleaned[key] = value;
  }
  return cleaned;
}

function addEntry(
  kind: "races" | "classes",
  name: string,
  modifiers: StatModifiers,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (
    catalog[kind].some(
      (entry) => entry.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return `That ${kind === "races" ? "race" : "class"} already exists.`;
  }

  catalog = {
    ...catalog,
    [kind]: [
      ...catalog[kind],
      { name: trimmed, modifiers: cleanModifiers(modifiers) },
    ],
  };
  persistCatalog();
  return null;
}

function removeEntry(kind: "races" | "classes", name: string): boolean {
  const next = catalog[kind].filter((entry) => entry.name !== name);
  if (next.length === catalog[kind].length) return false;
  catalog = { ...catalog, [kind]: next };
  persistCatalog();
  return true;
}

function loadCatalog(): GameCatalog {
  try {
    // Prefer v2; fall back to v1 and migrate.
    const rawV2 = localStorage.getItem(CATALOG_STORAGE_KEY);
    const rawV1 = localStorage.getItem("durands-game-catalog-v1");
    const raw = rawV2 ?? rawV1;
    if (!raw) return cloneCatalog(DEFAULT_CATALOG);
    const parsed = parseCatalog(JSON.parse(raw));
    return parsed ?? cloneCatalog(DEFAULT_CATALOG);
  } catch {
    return cloneCatalog(DEFAULT_CATALOG);
  }
}

function persistCatalog(): void {
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
}

function parseCatalog(data: unknown): GameCatalog | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const races = parseEntries(raw.races);
  const classes = parseEntries(raw.classes);
  if (!races || !classes) return null;
  return {
    races,
    classes,
    materials: parseNames(raw.materials) ?? [],
  };
}

function parseEntries(value: unknown): CatalogEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const modifiers =
      raw.modifiers && typeof raw.modifiers === "object"
        ? cleanModifiers(raw.modifiers as Partial<Record<StatKey, number>>)
        : {};
    entries.push({ name, modifiers });
  }

  return entries;
}

function parseNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

function cloneCatalog(source: GameCatalog): GameCatalog {
  return {
    races: source.races.map((entry) => ({
      name: entry.name,
      modifiers: { ...entry.modifiers },
    })),
    classes: source.classes.map((entry) => ({
      name: entry.name,
      modifiers: { ...entry.modifiers },
    })),
    materials: [...source.materials],
  };
}
