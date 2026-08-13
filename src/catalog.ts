import {
  STAT_KEYS,
  STAT_LABELS,
  StatKey,
  WeaponItem,
  clampNumber,
} from "./character";

export type StatModifiers = Partial<Record<StatKey, number>>;

export type CatalogEntry = {
  name: string;
  modifiers: StatModifiers;
};

export type MaterialEntry = {
  name: string;
  /** Added to each armor slot after armor-type base. */
  armorBonus: number;
  /** Added to Dodge Adjust after base dodge calculation. */
  dodgeBonus: number;
};

export type TokenEntry = {
  name: string;
  description: string;
};

export type GameCatalog = {
  races: CatalogEntry[];
  classes: CatalogEntry[];
  materials: MaterialEntry[];
  weapons: WeaponItem[];
  tokens: TokenEntry[];
};

const CATALOG_STORAGE_KEY = "durands-game-catalog-v3";

const DEFAULT_MATERIALS: MaterialEntry[] = [
  { name: "Leather", armorBonus: 0, dodgeBonus: 0 },
  { name: "Iron", armorBonus: 0, dodgeBonus: 0 },
  { name: "Cloth", armorBonus: 0, dodgeBonus: 0 },
  { name: "Steel", armorBonus: 0, dodgeBonus: 0 },
  { name: "Kevlar", armorBonus: 0, dodgeBonus: 0 },
];

const DEFAULT_TOKENS: TokenEntry[] = [
  {
    name: "Exhaustion",
    description:
      "When applied, temporarily reduces total Tension Rounds by 2 per token. Exhaustion tokens are lost after 2 days of rest without gaining a new Exhaustion token.",
  },
  {
    name: "Heat",
    description:
      "Gained when cold skills are used too much. Buildup = Level + Resilience + bonus − Heat token value. If buildup is negative, make a DC 18 + ⌊total tokens ÷ 3⌋ saving throw vs Resilience or spontaneously explode. Gaining a Heat token removes an equivalent Cold token.",
  },
  {
    name: "Cold",
    description:
      "Gained when heat skills are used too much. Buildup = Level + Resilience + bonus − Cold token value. If buildup is negative, make a DC 18 + ⌊total tokens ÷ 3⌋ saving throw vs Resilience or freeze solid. Gaining a Cold token removes an equivalent Heat token.",
  },
  {
    name: "Worn Out",
    description:
      "Reduces Hit Chance by 1 per token. Stacks up to 10; at 10 stacks, gain 1 Exhaustion token and Worn Out resets to 0. One Worn Out token is removed for every minute spent resting.",
  },
];

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
  materials: cloneMaterials(DEFAULT_MATERIALS),
  weapons: [],
  tokens: cloneTokens(DEFAULT_TOKENS),
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
  return catalog.materials.map((entry) => entry.name);
}

export function getMaterials(): MaterialEntry[] {
  return catalog.materials.map((entry) => ({ ...entry }));
}

export function getMaterial(name: string): MaterialEntry | null {
  const found = catalog.materials.find(
    (entry) => entry.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return found ? { ...found } : null;
}

export function getWeaponNames(): string[] {
  return catalog.weapons.map((entry) => entry.name);
}

export function getWeapons(): WeaponItem[] {
  return catalog.weapons.map((entry) => ({ ...entry }));
}

export function getWeapon(name: string): WeaponItem | null {
  const found = catalog.weapons.find(
    (entry) => entry.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return found ? { ...found } : null;
}

export function getTokenNames(): string[] {
  return catalog.tokens.map((entry) => entry.name);
}

export function getTokens(): TokenEntry[] {
  return catalog.tokens.map((entry) => ({ ...entry }));
}

export function getToken(name: string): TokenEntry | null {
  const found = catalog.tokens.find(
    (entry) => entry.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return found ? { ...found } : null;
}

export function addToken(name: string, description = ""): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (
    catalog.tokens.some(
      (entry) => entry.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return "That token already exists.";
  }
  catalog = {
    ...catalog,
    tokens: [
      ...catalog.tokens,
      { name: trimmed, description: description.trim() },
    ],
  };
  persistCatalog();
  return null;
}

export function removeToken(name: string): boolean {
  const next = catalog.tokens.filter((entry) => entry.name !== name);
  if (next.length === catalog.tokens.length) return false;
  catalog = { ...catalog, tokens: next };
  persistCatalog();
  return true;
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

export function addMaterial(
  name: string,
  armorBonus = 0,
  dodgeBonus = 0,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (
    catalog.materials.some(
      (entry) => entry.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return "That material already exists.";
  }
  catalog = {
    ...catalog,
    materials: [
      ...catalog.materials,
      {
        name: trimmed,
        armorBonus: clampNumber(armorBonus, -999, 999),
        dodgeBonus: clampNumber(dodgeBonus, -999, 999),
      },
    ],
  };
  persistCatalog();
  return null;
}

export function updateMaterialBonuses(
  name: string,
  armorBonus: number,
  dodgeBonus: number,
): boolean {
  const index = catalog.materials.findIndex((entry) => entry.name === name);
  if (index < 0) return false;
  const next = catalog.materials.map((entry, i) =>
    i === index
      ? {
          ...entry,
          armorBonus: clampNumber(armorBonus, -999, 999),
          dodgeBonus: clampNumber(dodgeBonus, -999, 999),
        }
      : entry,
  );
  catalog = { ...catalog, materials: next };
  persistCatalog();
  return true;
}

export function removeRace(name: string): boolean {
  return removeEntry("races", name);
}

export function removeClass(name: string): boolean {
  return removeEntry("classes", name);
}

export function removeMaterial(name: string): boolean {
  const next = catalog.materials.filter((entry) => entry.name !== name);
  if (next.length === catalog.materials.length) return false;
  catalog = { ...catalog, materials: next };
  persistCatalog();
  return true;
}

export function addWeapon(weapon: WeaponItem): string | null {
  const trimmed = weapon.name.trim();
  if (!trimmed) return "Name is required.";
  if (
    catalog.weapons.some(
      (entry) => entry.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return "That weapon already exists.";
  }
  catalog = {
    ...catalog,
    weapons: [
      ...catalog.weapons,
      {
        name: trimmed,
        damage: weapon.damage.trim(),
        magazineSize: weapon.magazineSize.trim(),
        rateOfFire: weapon.rateOfFire.trim(),
        consecutiveShot: weapon.consecutiveShot.trim(),
        malfunctionChance: weapon.malfunctionChance.trim(),
        statRequirement: weapon.statRequirement.trim(),
        specialAbility: weapon.specialAbility.trim(),
      },
    ],
  };
  persistCatalog();
  return null;
}

export function updateWeapon(name: string, weapon: WeaponItem): boolean {
  const index = catalog.weapons.findIndex((entry) => entry.name === name);
  if (index < 0) return false;
  catalog = {
    ...catalog,
    weapons: catalog.weapons.map((entry, i) =>
      i === index
        ? {
            name: entry.name,
            damage: weapon.damage.trim(),
            magazineSize: weapon.magazineSize.trim(),
            rateOfFire: weapon.rateOfFire.trim(),
            consecutiveShot: weapon.consecutiveShot.trim(),
            malfunctionChance: weapon.malfunctionChance.trim(),
            statRequirement: weapon.statRequirement.trim(),
            specialAbility: weapon.specialAbility.trim(),
          }
        : entry,
    ),
  };
  persistCatalog();
  return true;
}

export function removeWeapon(name: string): boolean {
  const next = catalog.weapons.filter((entry) => entry.name !== name);
  if (next.length === catalog.weapons.length) return false;
  catalog = { ...catalog, weapons: next };
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

export function formatMaterialBonuses(material: MaterialEntry): string {
  const armorSign = material.armorBonus > 0 ? "+" : "";
  const dodgeSign = material.dodgeBonus > 0 ? "+" : "";
  return `Armor ${armorSign}${material.armorBonus}, Dodge ${dodgeSign}${material.dodgeBonus}`;
}

export function formatWeaponStats(weapon: WeaponItem): string {
  const parts = [
    weapon.damage && `Dmg ${weapon.damage}`,
    weapon.magazineSize && `Mag ${weapon.magazineSize}`,
    weapon.rateOfFire && `RoF ${weapon.rateOfFire}`,
    weapon.consecutiveShot && `CSI ${weapon.consecutiveShot}`,
    weapon.malfunctionChance && `Malf ${weapon.malfunctionChance}`,
    weapon.statRequirement && `Req ${weapon.statRequirement}`,
    weapon.specialAbility && `Ability ${weapon.specialAbility}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No weapon stats set";
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
    const rawV3 = localStorage.getItem(CATALOG_STORAGE_KEY);
    const rawV2 = localStorage.getItem("durands-game-catalog-v2");
    const rawV1 = localStorage.getItem("durands-game-catalog-v1");
    const raw = rawV3 ?? rawV2 ?? rawV1;
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
    materials: ensureDefaultMaterials(parseMaterials(raw.materials)),
    weapons: parseCatalogWeapons(raw.weapons),
    tokens: ensureDefaultTokens(parseTokens(raw.tokens)),
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

function parseMaterials(value: unknown): MaterialEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: MaterialEntry[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      entries.push({ name, armorBonus: 0, dodgeBonus: 0 });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    entries.push({
      name,
      armorBonus: clampNumber(Number(raw.armorBonus ?? 0), -999, 999),
      dodgeBonus: clampNumber(Number(raw.dodgeBonus ?? 0), -999, 999),
    });
  }

  return entries;
}

function parseTokens(value: unknown): TokenEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: TokenEntry[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      entries.push({ name, description: "" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    entries.push({
      name,
      description:
        typeof raw.description === "string" ? raw.description.trim() : "",
    });
  }

  return entries;
}

function ensureDefaultTokens(tokens: TokenEntry[]): TokenEntry[] {
  const byName = new Map(
    tokens.map((entry) => [entry.name.toLowerCase(), entry]),
  );
  for (const defaults of DEFAULT_TOKENS) {
    const existing = byName.get(defaults.name.toLowerCase());
    if (!existing) {
      byName.set(defaults.name.toLowerCase(), { ...defaults });
    } else if (!existing.description.trim()) {
      byName.set(defaults.name.toLowerCase(), {
        ...existing,
        description: defaults.description,
      });
    }
  }

  const merged: TokenEntry[] = [];
  const used = new Set<string>();
  for (const defaults of DEFAULT_TOKENS) {
    const existing = byName.get(defaults.name.toLowerCase());
    if (existing) {
      merged.push(existing);
      used.add(defaults.name.toLowerCase());
    }
  }
  for (const entry of tokens) {
    if (used.has(entry.name.toLowerCase())) continue;
    merged.push(entry);
    used.add(entry.name.toLowerCase());
  }
  return merged;
}

function parseCatalogWeapons(value: unknown): WeaponItem[] {
  if (!Array.isArray(value)) return [];
  const entries: WeaponItem[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    entries.push({
      name,
      damage: stringField(raw.damage),
      magazineSize: stringField(raw.magazineSize),
      rateOfFire: stringField(raw.rateOfFire),
      consecutiveShot: stringField(raw.consecutiveShot),
      malfunctionChance: stringField(raw.malfunctionChance),
      statRequirement: stringField(raw.statRequirement),
      specialAbility: stringField(raw.specialAbility),
    });
  }

  return entries;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function ensureDefaultMaterials(materials: MaterialEntry[]): MaterialEntry[] {
  const byName = new Map(
    materials.map((entry) => [entry.name.toLowerCase(), entry]),
  );
  for (const defaults of DEFAULT_MATERIALS) {
    if (!byName.has(defaults.name.toLowerCase())) {
      byName.set(defaults.name.toLowerCase(), { ...defaults });
    }
  }
  // Keep defaults first (in order), then any custom extras.
  const merged: MaterialEntry[] = [];
  const used = new Set<string>();
  for (const defaults of DEFAULT_MATERIALS) {
    const existing = byName.get(defaults.name.toLowerCase());
    if (existing) {
      merged.push(existing);
      used.add(defaults.name.toLowerCase());
    }
  }
  for (const entry of materials) {
    if (used.has(entry.name.toLowerCase())) continue;
    merged.push(entry);
    used.add(entry.name.toLowerCase());
  }
  return merged;
}

function cloneMaterials(source: MaterialEntry[]): MaterialEntry[] {
  return source.map((entry) => ({ ...entry }));
}

function cloneTokens(source: TokenEntry[]): TokenEntry[] {
  return source.map((entry) => ({ ...entry }));
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
    materials: cloneMaterials(source.materials),
    weapons: source.weapons.map((entry) => ({ ...entry })),
    tokens: cloneTokens(source.tokens),
  };
}
