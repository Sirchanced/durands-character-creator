export type InventoryItem = {
  name: string;
  amount: number;
};

export type WeaponItem = {
  name: string;
  damage: string;
  magazineSize: string;
  rateOfFire: string;
  consecutiveShot: string;
  malfunctionChance: string;
  statRequirement: string;
  specialAbility: string;
};

export type Character = {
  name: string;
  level: number;
  race: string;
  className: string;
  height: string;
  age: number;
  luckDie: string;
  unusedPoints: number;
  armorType: string;
  armorMaterial: string;
  armorHead: number;
  armorHeadCurrent: number;
  armorChest: number;
  armorChestCurrent: number;
  armorLeftArm: number;
  armorLeftArmCurrent: number;
  armorRightArm: number;
  armorRightArmCurrent: number;
  armorLeftLeg: number;
  armorLeftLegCurrent: number;
  armorRightLeg: number;
  armorRightLegCurrent: number;
  armorSpecial: number;
  armorSpecialCurrent: number;
  currentHealth: number;
  maxHealth: number;
  strength: number;
  dexterity: number;
  resilience: number;
  intelligence: number;
  reasoning: number;
  sociability: number;
  positiveTraits: string[];
  negativeTraits: string[];
  skills: string[];
  classSkills: string[];
  racialSkills: string[];
  weapons: WeaponItem[];
  inventory: InventoryItem[];
  history: string;
  notes: string;
};

export const LUCK_DIE_OPTIONS = [
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
] as const;

export const ARMOR_TYPE_OPTIONS = ["Light", "Medium", "Heavy"] as const;

export const ARMOR_SLOT_KEYS = [
  "armorHead",
  "armorChest",
  "armorLeftArm",
  "armorRightArm",
  "armorLeftLeg",
  "armorRightLeg",
  "armorSpecial",
] as const;

export type ArmorSlotKey = (typeof ARMOR_SLOT_KEYS)[number];

export const ARMOR_CURRENT_KEYS = [
  "armorHeadCurrent",
  "armorChestCurrent",
  "armorLeftArmCurrent",
  "armorRightArmCurrent",
  "armorLeftLegCurrent",
  "armorRightLegCurrent",
  "armorSpecialCurrent",
] as const;

export type ArmorCurrentKey = (typeof ARMOR_CURRENT_KEYS)[number];

export const ARMOR_SLOT_LABELS: Record<ArmorSlotKey, string> = {
  armorHead: "Head",
  armorChest: "Chest",
  armorLeftArm: "Left Arm",
  armorRightArm: "Right Arm",
  armorLeftLeg: "Left Leg",
  armorRightLeg: "Right Leg",
  armorSpecial: "Special",
};

export const ARMOR_CURRENT_BY_SLOT: Record<ArmorSlotKey, ArmorCurrentKey> = {
  armorHead: "armorHeadCurrent",
  armorChest: "armorChestCurrent",
  armorLeftArm: "armorLeftArmCurrent",
  armorRightArm: "armorRightArmCurrent",
  armorLeftLeg: "armorLeftLegCurrent",
  armorRightLeg: "armorRightLegCurrent",
  armorSpecial: "armorSpecialCurrent",
};

export const POSITIVE_TRAIT_OPTIONS = [
  "Alert",
  "Ambidextrous",
  "Brave",
  "Charming",
  "Eagle Eye",
  "Fleet Footed",
  "Hardy",
  "Iron Will",
  "Lucky",
  "Night Vision",
  "Quick Reflexes",
  "Scholarly",
  "Silver Tongue",
  "Stealthy",
  "Strong Back",
  "Surefooted",
  "Thick Skinned",
  "Tough",
  "Tracker",
  "Unshakeable",
] as const;

export const NEGATIVE_TRAIT_OPTIONS = [
  "Clumsy",
  "Cowardly",
  "Frail",
  "Greedy",
  "Hot-Tempered",
  "Illiterate",
  "Impulsive",
  "Lazy",
  "Naive",
  "Night Blind",
  "One-Eyed",
  "Phobia",
  "Reckless",
  "Short-Tempered",
  "Slow",
  "Stubborn",
  "Superstitious",
  "Unlucky",
  "Weak Stomach",
  "Withdrawn",
] as const;

/** Stats that spend / refund unused points when changed. */
export const STAT_KEYS = [
  "maxHealth",
  "strength",
  "dexterity",
  "resilience",
  "intelligence",
  "reasoning",
  "sociability",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  maxHealth: "Max Health",
  strength: "Strength",
  dexterity: "Dexterity",
  resilience: "Resilience",
  intelligence: "Intelligence",
  reasoning: "Reasoning",
  sociability: "Sociability",
};

/** Stat adjustment: positive stats use floor(n/3) with a minimum of 1; 0 and below are 1:1. */
export function calculateAdj(value: number): number {
  if (value <= 0) return value;
  return Math.max(1, Math.floor(value / 3));
}

/** Dodge adjust starts at 10, plus Dex/Int/Res ADJs, armor-type bonus, then material bonus. */
export function calculateDodgeAdjust(
  character: {
    dexterity: number;
    intelligence: number;
    resilience: number;
    armorType: string;
  },
  materialDodgeBonus = 0,
): number {
  return (
    10 +
    calculateAdj(character.dexterity) +
    calculateAdj(character.intelligence) +
    calculateAdj(character.resilience) +
    armorDodgeBonus(character.armorType) +
    materialDodgeBonus
  );
}

/** Armor slot base value from armor type and max health. */
export function armorBaseValue(armorType: string, maxHealth: number): number {
  const hp = Math.max(0, maxHealth);
  if (armorType === "Light") return Math.floor(hp / 3);
  if (armorType === "Medium") return Math.floor((hp * 2) / 3);
  if (armorType === "Heavy") return hp;
  return 0;
}

/** Dodge adjust modifier granted by armor type. */
export function armorDodgeBonus(armorType: string): number {
  if (armorType === "Light") return 2;
  if (armorType === "Medium") return 1;
  if (armorType === "Heavy") return -1;
  return 0;
}

/** Slot values = armor-type base + material armor bonus (additive). */
export function armorSlotsFromType(
  armorType: string,
  maxHealth: number,
  materialArmorBonus = 0,
): Record<ArmorSlotKey | ArmorCurrentKey, number> {
  const value = Math.max(
    0,
    armorBaseValue(armorType, maxHealth) + materialArmorBonus,
  );
  return {
    armorHead: value,
    armorHeadCurrent: value,
    armorChest: value,
    armorChestCurrent: value,
    armorLeftArm: value,
    armorLeftArmCurrent: value,
    armorRightArm: value,
    armorRightArmCurrent: value,
    armorLeftLeg: value,
    armorLeftLegCurrent: value,
    armorRightLeg: value,
    armorRightLegCurrent: value,
    armorSpecial: value,
    armorSpecialCurrent: value,
  };
}

export function createBlankCharacter(): Character {
  return {
    name: "",
    level: 1,
    race: "",
    className: "",
    height: "",
    age: 18,
    luckDie: "d6",
    unusedPoints: POINTS_PER_LEVEL,
    armorType: "",
    armorMaterial: "",
    armorHead: 0,
    armorHeadCurrent: 0,
    armorChest: 0,
    armorChestCurrent: 0,
    armorLeftArm: 0,
    armorLeftArmCurrent: 0,
    armorRightArm: 0,
    armorRightArmCurrent: 0,
    armorLeftLeg: 0,
    armorLeftLegCurrent: 0,
    armorRightLeg: 0,
    armorRightLegCurrent: 0,
    armorSpecial: 0,
    armorSpecialCurrent: 0,
    currentHealth: 3,
    maxHealth: 3,
    strength: 1,
    dexterity: 1,
    resilience: 1,
    intelligence: 1,
    reasoning: 1,
    sociability: 1,
    positiveTraits: [],
    negativeTraits: [],
    skills: [],
    classSkills: [],
    racialSkills: [],
    weapons: [],
    inventory: [],
    history: "",
    notes: "",
  };
}

export function clampNumber(value: number, min = 0, max = 999): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export const POINTS_PER_LEVEL = 4;

export function maxUnusedPoints(level: number): number {
  return POINTS_PER_LEVEL * clampNumber(level, 1, 99);
}

export function parseCharacter(data: unknown): Character | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const blank = createBlankCharacter();
  const level = clampNumber(Number(raw.level ?? blank.level), 1, 99);
  const unusedCap = maxUnusedPoints(level);

  const legacyHealth =
    raw.health != null && raw.maxHealth == null && raw.currentHealth == null
      ? Number(raw.health)
      : null;

  const maxHealth = clampNumber(
    Number(raw.maxHealth ?? legacyHealth ?? blank.maxHealth),
    -999,
    999,
  );
  const currentHealth = clampNumber(
    Number(raw.currentHealth ?? legacyHealth ?? maxHealth),
    -999,
    maxHealth,
  );

  return {
    name: typeof raw.name === "string" ? raw.name : blank.name,
    level,
    race: typeof raw.race === "string" ? raw.race : blank.race,
    className:
      typeof raw.className === "string"
        ? raw.className
        : typeof raw.class === "string"
          ? raw.class
          : blank.className,
    height: typeof raw.height === "string" ? raw.height : blank.height,
    age: clampNumber(Number(raw.age ?? blank.age), 0, 9999),
    luckDie:
      typeof raw.luckDie === "string" &&
      (LUCK_DIE_OPTIONS as readonly string[]).includes(raw.luckDie)
        ? raw.luckDie
        : blank.luckDie,
    unusedPoints: clampNumber(
      Number(
        raw.unusedPoints ??
          (raw.level == null ? blank.unusedPoints : unusedCap),
      ),
      0,
      9999,
    ),
    armorType:
      typeof raw.armorType === "string" &&
      (ARMOR_TYPE_OPTIONS as readonly string[]).includes(raw.armorType)
        ? raw.armorType
        : blank.armorType,
    armorMaterial:
      typeof raw.armorMaterial === "string"
        ? raw.armorMaterial
        : blank.armorMaterial,
    armorHead: clampNumber(Number(raw.armorHead ?? blank.armorHead), 0, 999),
    armorHeadCurrent: clampNumber(
      Number(raw.armorHeadCurrent ?? raw.armorHead ?? blank.armorHeadCurrent),
      0,
      clampNumber(Number(raw.armorHead ?? blank.armorHead), 0, 999),
    ),
    armorChest: clampNumber(Number(raw.armorChest ?? blank.armorChest), 0, 999),
    armorChestCurrent: clampNumber(
      Number(raw.armorChestCurrent ?? raw.armorChest ?? blank.armorChestCurrent),
      0,
      clampNumber(Number(raw.armorChest ?? blank.armorChest), 0, 999),
    ),
    armorLeftArm: clampNumber(
      Number(raw.armorLeftArm ?? blank.armorLeftArm),
      0,
      999,
    ),
    armorLeftArmCurrent: clampNumber(
      Number(
        raw.armorLeftArmCurrent ?? raw.armorLeftArm ?? blank.armorLeftArmCurrent,
      ),
      0,
      clampNumber(Number(raw.armorLeftArm ?? blank.armorLeftArm), 0, 999),
    ),
    armorRightArm: clampNumber(
      Number(raw.armorRightArm ?? blank.armorRightArm),
      0,
      999,
    ),
    armorRightArmCurrent: clampNumber(
      Number(
        raw.armorRightArmCurrent ??
          raw.armorRightArm ??
          blank.armorRightArmCurrent,
      ),
      0,
      clampNumber(Number(raw.armorRightArm ?? blank.armorRightArm), 0, 999),
    ),
    armorLeftLeg: clampNumber(
      Number(raw.armorLeftLeg ?? blank.armorLeftLeg),
      0,
      999,
    ),
    armorLeftLegCurrent: clampNumber(
      Number(
        raw.armorLeftLegCurrent ?? raw.armorLeftLeg ?? blank.armorLeftLegCurrent,
      ),
      0,
      clampNumber(Number(raw.armorLeftLeg ?? blank.armorLeftLeg), 0, 999),
    ),
    armorRightLeg: clampNumber(
      Number(raw.armorRightLeg ?? blank.armorRightLeg),
      0,
      999,
    ),
    armorRightLegCurrent: clampNumber(
      Number(
        raw.armorRightLegCurrent ??
          raw.armorRightLeg ??
          blank.armorRightLegCurrent,
      ),
      0,
      clampNumber(Number(raw.armorRightLeg ?? blank.armorRightLeg), 0, 999),
    ),
    armorSpecial: clampNumber(
      Number(raw.armorSpecial ?? blank.armorSpecial),
      0,
      999,
    ),
    armorSpecialCurrent: clampNumber(
      Number(
        raw.armorSpecialCurrent ?? raw.armorSpecial ?? blank.armorSpecialCurrent,
      ),
      0,
      clampNumber(Number(raw.armorSpecial ?? blank.armorSpecial), 0, 999),
    ),
    currentHealth,
    maxHealth,
    strength: clampNumber(Number(raw.strength ?? blank.strength), -999, 999),
    dexterity: clampNumber(Number(raw.dexterity ?? blank.dexterity), -999, 999),
    resilience: clampNumber(Number(raw.resilience ?? blank.resilience), -999, 999),
    intelligence: clampNumber(
      Number(raw.intelligence ?? blank.intelligence),
      -999,
      999,
    ),
    reasoning: clampNumber(Number(raw.reasoning ?? blank.reasoning), -999, 999),
    sociability: clampNumber(
      Number(raw.sociability ?? blank.sociability),
      -999,
      999,
    ),
    positiveTraits: parseTraits(raw.positiveTraits ?? raw.traits),
    negativeTraits: parseTraits(raw.negativeTraits),
    skills: parseTraits(raw.skills),
    classSkills: parseTraits(raw.classSkills),
    racialSkills: parseTraits(raw.racialSkills),
    weapons: parseWeapons(raw.weapons),
    inventory: parseInventory(raw.inventory),
    history: typeof raw.history === "string" ? raw.history : blank.history,
    notes: typeof raw.notes === "string" ? raw.notes : blank.notes,
  };
}

function parseWeapons(value: unknown): WeaponItem[] {
  if (!Array.isArray(value)) return [];
  const weapons: WeaponItem[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    weapons.push({
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

  return weapons;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseInventory(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: InventoryItem[] = [];

  for (const entry of value) {
    if (typeof entry === "string") {
      const name = entry.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      items.push({ name, amount: 1 });
      continue;
    }

    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    items.push({
      name,
      amount: clampNumber(Number(raw.amount ?? 1), 1, 9999),
    });
  }

  return items;
}

function parseTraits(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const traits: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trait = item.trim();
    if (!trait || seen.has(trait)) continue;
    seen.add(trait);
    traits.push(trait);
  }
  return traits;
}
