import "./style.css";
import {
  addClass,
  addMaterial,
  addRace,
  formatModifiers,
  getCatalog,
  getClassModifiers,
  getClassNames,
  getMaterialNames,
  getRaceModifiers,
  getRaceNames,
  removeClass,
  removeMaterial,
  removeRace,
  type StatModifiers,
} from "./catalog";
import {
  Character,
  ARMOR_CURRENT_BY_SLOT,
  ARMOR_CURRENT_KEYS,
  ARMOR_SLOT_KEYS,
  ARMOR_SLOT_LABELS,
  ARMOR_TYPE_OPTIONS,
  ArmorCurrentKey,
  ArmorSlotKey,
  LUCK_DIE_OPTIONS,
  NEGATIVE_TRAIT_OPTIONS,
  POINTS_PER_LEVEL,
  POSITIVE_TRAIT_OPTIONS,
  STAT_KEYS,
  STAT_LABELS,
  StatKey,
  armorSlotsFromType,
  calculateAdj,
  calculateDodgeAdjust,
  clampNumber,
  createBlankCharacter,
  maxUnusedPoints,
  parseCharacter,
} from "./character";

const STORAGE_KEY = "durands-character-sheet-v3";

type AppPage = "sheet" | "catalog";

let character: Character = loadInitial();
let currentPage: AppPage = "sheet";
let statusMessage = "Ready — adjust any value, then save when you like.";
let catalogStatusMessage = "Browse race and class adjustments, or add new ones.";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

render();

type NumberFieldKey =
  | "level"
  | "age"
  | "unusedPoints"
  | "currentHealth"
  | ArmorSlotKey
  | ArmorCurrentKey
  | StatKey;

function isStatKey(key: string): key is StatKey {
  return (STAT_KEYS as readonly string[]).includes(key);
}

function isArmorSlotKey(key: string): key is ArmorSlotKey {
  return (ARMOR_SLOT_KEYS as readonly string[]).includes(key);
}

function isArmorCurrentKey(key: string): key is ArmorCurrentKey {
  return (ARMOR_CURRENT_KEYS as readonly string[]).includes(key);
}

function armorSlotForCurrent(key: ArmorCurrentKey): ArmorSlotKey {
  const match = ARMOR_SLOT_KEYS.find(
    (slot) => ARMOR_CURRENT_BY_SLOT[slot] === key,
  );
  if (!match) throw new Error(`Unknown armor current key: ${key}`);
  return match;
}

function loadInitial(): Character {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createBlankCharacter();
    const parsed = parseCharacter(JSON.parse(raw));
    return parsed ?? createBlankCharacter();
  } catch {
    return createBlankCharacter();
  }
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
}

function setStatus(message: string): void {
  statusMessage = message;
  const el = document.querySelector<HTMLParagraphElement>("[data-status]");
  if (el) el.textContent = statusMessage;
}

function setCatalogStatus(message: string): void {
  catalogStatusMessage = message;
  const el = document.querySelector<HTMLParagraphElement>("[data-catalog-status]");
  if (el) el.textContent = catalogStatusMessage;
}

function setPage(page: AppPage): void {
  currentPage = page;
  render();
}

function updateText(
  key: "name" | "race" | "className" | "height" | "luckDie" | "armorType" | "armorMaterial" | "history" | "notes",
  value: string,
): void {
  if (key === "race") {
    applyRaceChange(value);
    return;
  }
  if (key === "className") {
    applyClassChange(value);
    return;
  }
  if (key === "armorType") {
    applyArmorTypeChange(value);
    return;
  }
  character = { ...character, [key]: value };
  persist();
}

function applyArmorTypeChange(nextType: string): void {
  if (nextType === character.armorType) return;

  const slots = armorSlotsFromType(nextType, character.maxHealth);
  character = {
    ...character,
    armorType: nextType,
    ...slots,
  };
  persist();
  syncArmorSlotInputs();
  syncDodgeAdjust();

  if (nextType === "Light") {
    setStatus(
      `Light armor: slots set to ${slots.armorHead} (⅓ Max Health), Dodge Adjust +2.`,
    );
  } else if (nextType === "Medium") {
    setStatus(
      `Medium armor: slots set to ${slots.armorHead} (⅔ Max Health), Dodge Adjust +1.`,
    );
  } else if (nextType === "Heavy") {
    setStatus(
      `Heavy armor: slots set to ${slots.armorHead} (full Max Health), Dodge Adjust −1.`,
    );
  } else {
    setStatus("Armor type cleared.");
  }
}

function syncArmorFromMaxHealth(): void {
  if (!character.armorType) return;
  const slots = armorSlotsFromType(character.armorType, character.maxHealth);
  character = { ...character, ...slots };
  persist();
  syncArmorSlotInputs();
  syncDodgeAdjust();
}

function syncArmorSlotInputs(): void {
  for (const key of ARMOR_SLOT_KEYS) {
    syncNumberInput(key);
    syncNumberInput(ARMOR_CURRENT_BY_SLOT[key]);
    refreshArmorCurrentControls(key);
  }
}

function refreshArmorCurrentControls(slot: ArmorSlotKey): void {
  const currentKey = ARMOR_CURRENT_BY_SLOT[slot];
  const max = character[slot];
  document
    .querySelectorAll<HTMLElement>(
      `[data-adjust="${currentKey}"], [data-num="${currentKey}"]`,
    )
    .forEach((el) => {
      el.dataset.max = String(max);
      if (el instanceof HTMLInputElement) {
        el.max = String(max);
      }
    });
}

function applyStatModifiers(
  previousMods: StatModifiers,
  nextMods: StatModifiers,
  identityUpdate: Partial<Character>,
): StatKey[] {
  const affected = new Set([
    ...Object.keys(previousMods),
    ...Object.keys(nextMods),
  ] as StatKey[]);

  const updated: Character = { ...character, ...identityUpdate };

  for (const stat of affected) {
    const delta = (nextMods[stat] ?? 0) - (previousMods[stat] ?? 0);
    if (delta === 0) continue;
    updated[stat] = clampNumber(updated[stat] + delta, -999, 999);
    if (stat === "maxHealth") {
      updated.currentHealth = clampNumber(
        updated.currentHealth + delta,
        -999,
        updated.maxHealth,
      );
    }
  }

  character = updated;
  persist();

  for (const stat of affected) {
    syncNumberInput(stat);
    syncStatAdj(stat);
  }
  if (affected.has("maxHealth")) {
    syncNumberInput("currentHealth");
    refreshCurrentHealthControls();
    syncArmorFromMaxHealth();
  }

  return [...affected];
}

function applyRaceChange(nextRace: string): void {
  if (nextRace === character.race) return;

  const previousMods = getRaceModifiers(character.race);
  applyStatModifiers(previousMods, getRaceModifiers(nextRace), {
    race: nextRace,
  });

  if (nextRace === "Palamya") {
    setStatus("Palamya selected: +2 Resilience, −2 Intelligence, +8 Sociability.");
  } else if (nextRace === "" && Object.keys(previousMods).length > 0) {
    setStatus("Race cleared — racial modifiers removed.");
  } else {
    setStatus(nextRace ? `Race set to ${nextRace}.` : "Race cleared.");
  }
}

function applyClassChange(nextClass: string): void {
  if (nextClass === character.className) return;

  const previousMods = getClassModifiers(character.className);
  applyStatModifiers(previousMods, getClassModifiers(nextClass), {
    className: nextClass,
  });

  if (nextClass === "Vanguard") {
    setStatus("Vanguard selected: +3 Max Health, +3 Resilience.");
  } else if (nextClass === "" && Object.keys(previousMods).length > 0) {
    setStatus("Class cleared — class modifiers removed.");
  } else {
    setStatus(nextClass ? `Class set to ${nextClass}.` : "Class cleared.");
  }
}

function updateNumber(
  key: NumberFieldKey,
  value: number,
  min = 0,
  max = 999,
): void {
  if (key === "level") {
    const previousLevel = character.level;
    const nextLevel = clampNumber(value, 1, 99);
    const levelDelta = nextLevel - previousLevel;
    // Level grants/removes POINTS_PER_LEVEL each; do not clamp down over-cap refund banks.
    const nextUnused = Math.max(
      0,
      character.unusedPoints + levelDelta * POINTS_PER_LEVEL,
    );
    character = {
      ...character,
      level: nextLevel,
      unusedPoints: nextUnused,
    };
    persist();
    syncNumberInput("level");
    syncNumberInput("unusedPoints");
    refreshUnusedPointsControls();
    return;
  }

  if (key === "unusedPoints") {
    // Unused points are derived from level and stat spends — not edited directly.
    syncNumberInput("unusedPoints");
    return;
  }

  if (key === "currentHealth") {
    updateCurrentHealth(value);
    return;
  }

  if (isArmorSlotKey(key)) {
    // Max armor is derived from armor type / max health — not edited directly.
    syncNumberInput(key);
    return;
  }

  if (isArmorCurrentKey(key)) {
    const slot = armorSlotForCurrent(key);
    const next = clampNumber(value, 0, character[slot]);
    character = { ...character, [key]: next };
    persist();
    syncNumberInput(key);
    setStatus(
      `Updated ${ARMOR_SLOT_LABELS[slot]} current armor to ${next}.`,
    );
    return;
  }

  if (isStatKey(key)) {
    updateStat(key, value, min, max);
    return;
  }

  character = { ...character, [key]: clampNumber(value, min, max) };
  persist();
  syncNumberInput(key);
}

function updateCurrentHealth(value: number): void {
  const next = clampNumber(value, -999, character.maxHealth);
  character = { ...character, currentHealth: next };
  persist();
  syncNumberInput("currentHealth");
  refreshCurrentHealthControls();
  setStatus(`Current Health set to ${next}.`);
}

function updateStat(key: StatKey, value: number, min = 0, max = 999): void {
  const previous = character[key];
  let next = clampNumber(value, min, max);
  const requestedGain = next - previous;

  if (requestedGain > 0) {
    const affordable = Math.min(requestedGain, character.unusedPoints);
    if (affordable <= 0) {
      setStatus("No unused points left to raise that stat.");
      syncNumberInput(key);
      return;
    }
    next = previous + affordable;
    character = {
      ...character,
      [key]: next,
      unusedPoints: character.unusedPoints - affordable,
      // Raising max health also raises current health by the same amount.
      ...(key === "maxHealth"
        ? {
            currentHealth: clampNumber(
              character.currentHealth + affordable,
              -999,
              next,
            ),
          }
        : {}),
    };
    persist();
    syncNumberInput(key);
    if (key === "maxHealth") {
      syncNumberInput("currentHealth");
      refreshCurrentHealthControls();
      syncArmorFromMaxHealth();
    }
    syncNumberInput("unusedPoints");
    syncStatAdj(key);
    refreshUnusedPointsControls();
    setStatus(
      affordable < requestedGain
        ? `Raised ${STAT_LABELS[key]} by ${affordable} (limited by unused points).`
        : `Spent ${affordable} unused point${affordable === 1 ? "" : "s"} on ${STAT_LABELS[key]}.`,
    );
    return;
  }

  if (requestedGain < 0) {
    const refund = previous - next;
    character = {
      ...character,
      [key]: next,
      // Refunds may exceed the normal level cap.
      unusedPoints: character.unusedPoints + refund,
      ...(key === "maxHealth"
        ? {
            currentHealth: clampNumber(character.currentHealth, -999, next),
          }
        : {}),
    };
    persist();
    syncNumberInput(key);
    if (key === "maxHealth") {
      syncNumberInput("currentHealth");
      refreshCurrentHealthControls();
      syncArmorFromMaxHealth();
    }
    syncNumberInput("unusedPoints");
    syncStatAdj(key);
    refreshUnusedPointsControls();
    setStatus(
      `Lowered ${STAT_LABELS[key]} and refunded ${refund} unused point${refund === 1 ? "" : "s"}.`,
    );
    return;
  }

  syncNumberInput(key);
  syncStatAdj(key);
}

function syncNumberInput(key: NumberFieldKey): void {
  const input = document.querySelector<HTMLInputElement>(`[data-num="${key}"]`);
  if (input) input.value = String(character[key]);
}

function syncStatAdj(key: StatKey): void {
  const el = document.querySelector<HTMLElement>(`[data-adj="${key}"]`);
  if (el) el.textContent = formatAdj(calculateAdj(character[key]));
  if (
    key === "dexterity" ||
    key === "intelligence" ||
    key === "resilience"
  ) {
    syncDodgeAdjust();
  }
}

function syncDodgeAdjust(): void {
  const el = document.querySelector<HTMLInputElement>("[data-dodge-adjust]");
  if (el) el.value = formatAdj(calculateDodgeAdjust(character));
}

function formatAdj(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function refreshUnusedPointsControls(): void {
  const cap = maxUnusedPoints(character.level);
  const controlMax = Math.max(cap, character.unusedPoints);
  document
    .querySelectorAll<HTMLElement>('[data-adjust="unusedPoints"], [data-num="unusedPoints"]')
    .forEach((el) => {
      el.dataset.max = String(controlMax);
      if (el instanceof HTMLInputElement) {
        el.max = String(controlMax);
      }
    });
}

function refreshCurrentHealthControls(): void {
  const max = character.maxHealth;
  document
    .querySelectorAll<HTMLElement>('[data-adjust="currentHealth"], [data-num="currentHealth"]')
    .forEach((el) => {
      el.dataset.max = String(max);
      if (el instanceof HTMLInputElement) {
        el.max = String(max);
      }
    });
}

function adjustNumber(
  key: NumberFieldKey,
  delta: number,
  min = 0,
  max = 999,
): void {
  const effectiveMax = isArmorCurrentKey(key)
    ? character[armorSlotForCurrent(key)]
    : key === "unusedPoints"
      ? Math.max(maxUnusedPoints(character.level), character.unusedPoints)
      : key === "currentHealth"
        ? character.maxHealth
        : max;
  updateNumber(key, Number(character[key]) + delta, min, effectiveMax);
}

function render(): void {
  if (currentPage === "catalog") {
    renderCatalogPage();
    return;
  }
  renderSheetPage();
}

function renderNav(active: AppPage): string {
  return `
    <nav class="page-nav" aria-label="App pages">
      <button class="btn${active === "sheet" ? "" : " secondary"}" type="button" data-page="sheet">Character Sheet</button>
      <button class="btn${active === "catalog" ? "" : " secondary"}" type="button" data-page="catalog">Races &amp; Classes</button>
    </nav>
  `;
}

function renderSheetPage(): void {
  app!.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>Durand's Character Creator</h1>
          <p>Tabletop character sheet — every numeric value is adjustable.</p>
        </div>
        <div class="toolbar">
          ${renderNav("sheet")}
          <button class="btn secondary" type="button" data-action="new">New</button>
          <button class="btn secondary" type="button" data-action="load">Open</button>
          <button class="btn" type="button" data-action="save">Save File</button>
          <button class="btn secondary" type="button" data-action="print">Print</button>
          <button class="btn danger" type="button" data-action="reset">Reset</button>
        </div>
      </header>

      <p class="status" data-status>${escapeHtml(statusMessage)}</p>

      <main class="sheet" aria-label="Character sheet">
        <section>
          <h2 class="section-title">Header</h2>
          <div class="header-grid">
            ${textField("name", "Name", character.name, true)}
            ${numberField("level", "Level", character.level, 1, 99)}
            ${selectField("race", "Race", character.race, getRaceNames(), "Select a race…")}
            ${selectField("className", "Class", character.className, getClassNames(), "Select a class…")}
            ${textField("height", "Height", character.height)}
            ${numberField("age", "Age", character.age, 0, 9999)}
            ${luckDieField()}
            ${unusedPointsField()}
            ${dodgeAdjustField()}
          </div>
        </section>

        <section class="armor-section">
          <div class="armor-layout">
            <div class="armor-material-panel">
              <h2 class="section-title">Armor Material</h2>
              ${armorMaterialField()}
            </div>
            <div class="armor-panel">
              <h2 class="section-title">Armor</h2>
              ${armorTypeField()}
              <div class="armor-figure" aria-label="Armor coverage">
                <div class="armor-slot armor-head">
                  ${armorSlotField("armorHead")}
                </div>
                <div class="armor-slot armor-left-arm">
                  ${armorSlotField("armorLeftArm")}
                </div>
                <div class="armor-slot armor-chest">
                  ${armorSlotField("armorChest")}
                </div>
                <div class="armor-slot armor-right-arm">
                  ${armorSlotField("armorRightArm")}
                </div>
                <div class="armor-slot armor-left-leg">
                  ${armorSlotField("armorLeftLeg")}
                </div>
                <div class="armor-slot armor-right-leg">
                  ${armorSlotField("armorRightLeg")}
                </div>
                <div class="armor-slot armor-special">
                  ${armorSlotField("armorSpecial")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 class="section-title">Stat Lines</h2>
          <div class="stats-grid">
            ${currentHealthCard()}
            ${STAT_KEYS.map((key) => statCard(key)).join("")}
          </div>
        </section>

        <section class="history">
          <h2 class="section-title">History</h2>
          <div class="field">
            <label for="history">Character history</label>
            <textarea id="history" data-text="history" placeholder="Origins, past events, allies, enemies…">${escapeHtml(character.history)}</textarea>
          </div>
        </section>

        <section class="traits-section">
          <h2 class="section-title">Traits</h2>
          <div class="traits-columns">
            <div class="trait-column">
              <div class="traits-picker">
                <div class="field traits-select-field">
                  <label for="positiveTraitSelect">Positive traits</label>
                  <div class="traits-add-row">
                    <select id="positiveTraitSelect" data-trait-select="positive">
                      <option value="">Select a positive trait…</option>
                      ${traitSelectOptions("positive")}
                    </select>
                    <button class="btn" type="button" data-action="add-positive-trait">Add</button>
                  </div>
                </div>
              </div>
              <div class="taken-traits" aria-live="polite">
                <div class="taken-traits-label">Positive traits taken</div>
                ${takenTraitsBox("positive")}
              </div>
            </div>

            <div class="trait-column">
              <div class="traits-picker">
                <div class="field traits-select-field">
                  <label for="negativeTraitSelect">Negative traits</label>
                  <div class="traits-add-row">
                    <select id="negativeTraitSelect" data-trait-select="negative">
                      <option value="">Select a negative trait…</option>
                      ${traitSelectOptions("negative")}
                    </select>
                    <button class="btn" type="button" data-action="add-negative-trait">Add</button>
                  </div>
                </div>
              </div>
              <div class="taken-traits negative" aria-live="polite">
                <div class="taken-traits-label">Negative traits taken</div>
                ${takenTraitsBox("negative")}
              </div>
            </div>
          </div>
        </section>

        <section class="skills-section">
          <h2 class="section-title">Skills</h2>
          <div class="skills-columns">
            ${skillColumn("skills", "Skills", "Add a skill…")}
            ${skillColumn("classSkills", "Class skills", "Add a class skill…")}
            ${skillColumn("racialSkills", "Racial skills", "Add a racial skill…")}
          </div>
        </section>

        <section class="inventory-section">
          <h2 class="section-title">Inventory</h2>
          <div class="inventory-add">
            <div class="field inventory-name-field">
              <label for="inventoryInput">Item</label>
              <input id="inventoryInput" type="text" data-inventory-input placeholder="Item name…" autocomplete="off" />
            </div>
            <div class="field inventory-amount-field">
              <label for="inventoryAmount">Amount</label>
              <input id="inventoryAmount" type="number" data-inventory-amount value="1" min="1" max="9999" />
            </div>
            <button class="btn inventory-add-btn" type="button" data-action="add-inventory">Add</button>
          </div>
          <div class="taken-traits" aria-live="polite">
            <div class="taken-traits-label">Items carried</div>
            ${inventoryBox()}
          </div>
        </section>

        <section class="notes">
          <h2 class="section-title">Notes</h2>
          <div class="field">
            <label for="notes">Character notes</label>
            <textarea id="notes" data-text="notes" placeholder="Background, gear, quirks…">${escapeHtml(character.notes)}</textarea>
          </div>
        </section>
      </main>
    </div>
  `;

  bindSheetEvents();
}

function renderCatalogPage(): void {
  const { races, classes, materials } = getCatalog();

  app!.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>Races &amp; Classes</h1>
          <p>View stat adjustments and add new races, classes, or materials.</p>
        </div>
        <div class="toolbar">
          ${renderNav("catalog")}
        </div>
      </header>

      <p class="status" data-catalog-status>${escapeHtml(catalogStatusMessage)}</p>

      <main class="sheet catalog-sheet" aria-label="Races and classes catalog">
        <section>
          <h2 class="section-title">Races</h2>
          ${catalogList(races, "race")}
          ${catalogAddForm("race")}
        </section>

        <section>
          <h2 class="section-title">Classes</h2>
          ${catalogList(classes, "class")}
          ${catalogAddForm("class")}
        </section>

        <section>
          <h2 class="section-title">Armor Materials</h2>
          ${materialList(materials)}
          ${materialAddForm()}
        </section>
      </main>
    </div>
  `;

  bindCatalogEvents();
}

function catalogList(
  entries: { name: string; modifiers: StatModifiers }[],
  kind: "race" | "class",
): string {
  if (entries.length === 0) {
    return `<p class="catalog-empty">No ${kind === "race" ? "races" : "classes"} yet. Add one below.</p>`;
  }

  return `
    <ul class="catalog-list">
      ${entries
        .map(
          (entry) => `
        <li class="catalog-item">
          <div class="catalog-item-main">
            <div class="catalog-item-name">${escapeHtml(entry.name)}</div>
            <div class="catalog-item-mods">${escapeHtml(formatModifiers(entry.modifiers))}</div>
          </div>
          <button class="btn danger catalog-remove" type="button" data-remove-${kind}="${escapeAttr(entry.name)}">Remove</button>
        </li>
      `,
        )
        .join("")}
    </ul>
  `;
}

function catalogAddForm(kind: "race" | "class"): string {
  const title = kind === "race" ? "Add race" : "Add class";
  return `
    <div class="catalog-add">
      <h3 class="catalog-add-title">${title}</h3>
      <div class="field">
        <label for="${kind}Name">Name</label>
        <input id="${kind}Name" type="text" data-${kind}-name autocomplete="off" placeholder="${kind === "race" ? "Race name" : "Class name"}" />
      </div>
      <div class="catalog-mod-grid">
        ${STAT_KEYS.map(
          (key) => `
          <div class="field">
            <label for="${kind}-${key}">${STAT_LABELS[key]}</label>
            <input id="${kind}-${key}" type="number" data-${kind}-mod="${key}" value="0" />
          </div>
        `,
        ).join("")}
      </div>
      <button class="btn" type="button" data-action="add-${kind}">Add ${kind === "race" ? "Race" : "Class"}</button>
    </div>
  `;
}

function readModifierInputs(kind: "race" | "class"): StatModifiers {
  const modifiers: StatModifiers = {};
  for (const key of STAT_KEYS) {
    const input = document.querySelector<HTMLInputElement>(
      `[data-${kind}-mod="${key}"]`,
    );
    const value = clampNumber(Number(input?.value ?? 0), -999, 999);
    if (value !== 0) modifiers[key] = value;
  }
  return modifiers;
}

function materialList(materials: string[]): string {
  if (materials.length === 0) {
    return `<p class="catalog-empty">No armor materials yet. Add one below.</p>`;
  }

  return `
    <ul class="catalog-list">
      ${materials
        .map(
          (name) => `
        <li class="catalog-item">
          <div class="catalog-item-main">
            <div class="catalog-item-name">${escapeHtml(name)}</div>
          </div>
          <button class="btn danger catalog-remove" type="button" data-remove-material="${escapeAttr(name)}">Remove</button>
        </li>
      `,
        )
        .join("")}
    </ul>
  `;
}

function materialAddForm(): string {
  return `
    <div class="catalog-add">
      <h3 class="catalog-add-title">Add material</h3>
      <div class="field">
        <label for="materialName">Name</label>
        <input id="materialName" type="text" data-material-name autocomplete="off" placeholder="Material name" />
      </div>
      <button class="btn" type="button" data-action="add-material">Add Material</button>
    </div>
  `;
}

function submitMaterialEntry(): void {
  const nameInput = document.querySelector<HTMLInputElement>("[data-material-name]");
  const name = nameInput?.value ?? "";
  const error = addMaterial(name);
  if (error) {
    setCatalogStatus(error);
    return;
  }
  setCatalogStatus(`Added material “${name.trim()}”.`);
  render();
}

function submitCatalogEntry(kind: "race" | "class"): void {
  const nameInput = document.querySelector<HTMLInputElement>(
    `[data-${kind}-name]`,
  );
  const name = nameInput?.value ?? "";
  const modifiers = readModifierInputs(kind);
  const error =
    kind === "race" ? addRace(name, modifiers) : addClass(name, modifiers);

  if (error) {
    setCatalogStatus(error);
    return;
  }

  setCatalogStatus(
    `Added ${kind} “${name.trim()}”${
      Object.keys(modifiers).length
        ? ` (${formatModifiers(modifiers)})`
        : " with no stat adjustments"
    }.`,
  );
  render();
}

function textField(
  key: "name" | "height",
  label: string,
  value: string,
  wide = false,
): string {
  return `
    <div class="field${wide ? " wide" : ""}">
      <label for="${key}">${label}</label>
      <input id="${key}" type="text" data-text="${key}" value="${escapeAttr(value)}" autocomplete="off" />
    </div>
  `;
}

function selectField(
  key: "race" | "className",
  label: string,
  value: string,
  options: readonly string[],
  placeholder: string,
): string {
  const choices = [...options];
  if (value && !choices.includes(value)) {
    choices.unshift(value);
  }

  const optionHtml = [
    `<option value=""${value ? "" : " selected"}>${escapeHtml(placeholder)}</option>`,
    ...choices.map(
      (option) =>
        `<option value="${escapeAttr(option)}"${value === option ? " selected" : ""}>${escapeHtml(option)}</option>`,
    ),
  ].join("");

  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <select id="${key}" data-text="${key}">${optionHtml}</select>
    </div>
  `;
}

function numberField(
  key: "level" | "age",
  label: string,
  value: number,
  min: number,
  max: number,
): string {
  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <div class="numeric">
        <button class="stepper" type="button" data-adjust="${key}" data-delta="-1" data-min="${min}" data-max="${max}" aria-label="Decrease ${label}">−</button>
        <input id="${key}" type="number" data-num="${key}" data-min="${min}" data-max="${max}" value="${value}" min="${min}" max="${max}" />
        <button class="stepper" type="button" data-adjust="${key}" data-delta="1" data-min="${min}" data-max="${max}" aria-label="Increase ${label}">+</button>
      </div>
    </div>
  `;
}

function unusedPointsField(): string {
  return `
    <div class="field">
      <label for="unusedPoints">Unused Points</label>
      <input id="unusedPoints" class="unused-points-input" type="number" data-num="unusedPoints" value="${character.unusedPoints}" readonly tabindex="-1" aria-readonly="true" />
    </div>
  `;
}

function dodgeAdjustField(): string {
  return `
    <div class="field">
      <label for="dodgeAdjust">Dodge Adjust</label>
      <input id="dodgeAdjust" class="dodge-adjust-input" type="text" data-dodge-adjust value="${escapeAttr(formatAdj(calculateDodgeAdjust(character)))}" readonly tabindex="-1" aria-readonly="true" />
    </div>
  `;
}

function armorTypeField(): string {
  const options = ARMOR_TYPE_OPTIONS.map(
    (type) =>
      `<option value="${type}"${character.armorType === type ? " selected" : ""}>${type}</option>`,
  ).join("");

  return `
    <div class="field armor-type-field">
      <label for="armorType">Armor Type</label>
      <select id="armorType" data-text="armorType">
        <option value=""${character.armorType ? "" : " selected"}>Select armor type…</option>
        ${options}
      </select>
    </div>
  `;
}

function armorMaterialField(): string {
  const materials = getMaterialNames();
  const choices = [...materials];
  if (
    character.armorMaterial &&
    !choices.some(
      (name) => name.toLowerCase() === character.armorMaterial.toLowerCase(),
    )
  ) {
    choices.unshift(character.armorMaterial);
  }

  const options = choices
    .map(
      (name) =>
        `<option value="${escapeAttr(name)}"${character.armorMaterial === name ? " selected" : ""}>${escapeHtml(name)}</option>`,
    )
    .join("");

  return `
    <div class="field armor-material-field">
      <label for="armorMaterial">Material</label>
      <select id="armorMaterial" data-text="armorMaterial">
        <option value=""${character.armorMaterial ? "" : " selected"}>Select material…</option>
        ${options}
      </select>
      <p class="armor-material-hint">Add materials on the Races &amp; Classes page.</p>
    </div>
  `;
}

function armorSlotField(key: ArmorSlotKey): string {
  const label = ARMOR_SLOT_LABELS[key];
  const currentKey = ARMOR_CURRENT_BY_SLOT[key];
  const max = character[key];
  return `
    <div class="armor-slot-card">
      <div class="armor-slot-label">${label}</div>
      <div class="armor-slot-metrics">
        <div class="armor-metric">
          <span class="armor-metric-label">Max</span>
          <input type="number" class="armor-max-input" data-num="${key}" value="${max}" readonly tabindex="-1" aria-readonly="true" aria-label="${label} max armor" />
        </div>
        <div class="armor-metric">
          <span class="armor-metric-label">Current</span>
          <div class="numeric armor-numeric">
            <button class="stepper" type="button" data-adjust="${currentKey}" data-delta="-1" data-min="0" data-max="${max}" aria-label="Decrease ${label} current armor">−</button>
            <input type="number" data-num="${currentKey}" data-min="0" data-max="${max}" value="${character[currentKey]}" min="0" max="${max}" aria-label="${label} current armor" />
            <button class="stepper" type="button" data-adjust="${currentKey}" data-delta="1" data-min="0" data-max="${max}" aria-label="Increase ${label} current armor">+</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function luckDieField(): string {
  const options = LUCK_DIE_OPTIONS.map(
    (die) =>
      `<option value="${die}"${character.luckDie === die ? " selected" : ""}>${die}</option>`,
  ).join("");

  return `
    <div class="field">
      <label for="luckDie">Luck Die</label>
      <select id="luckDie" data-text="luckDie">${options}</select>
    </div>
  `;
}

function currentHealthCard(): string {
  const max = character.maxHealth;
  return `
    <div class="stat-card">
      <div class="stat-card-top">
        <div class="label">Current Health</div>
      </div>
      <div class="numeric">
        <button class="stepper" type="button" data-adjust="currentHealth" data-delta="-1" data-min="-999" data-max="${max}" aria-label="Decrease Current Health">−</button>
        <input type="number" data-num="currentHealth" data-min="-999" data-max="${max}" value="${character.currentHealth}" min="-999" max="${max}" aria-label="Current Health" />
        <button class="stepper" type="button" data-adjust="currentHealth" data-delta="1" data-min="-999" data-max="${max}" aria-label="Increase Current Health">+</button>
      </div>
    </div>
  `;
}

function statCard(key: StatKey): string {
  const label = STAT_LABELS[key];
  const adjBlock =
    key === "maxHealth"
      ? ""
      : `
        <div class="stat-adj" title="Adjustment">
          <span class="stat-adj-label">ADJ</span>
          <span class="stat-adj-value" data-adj="${key}">${formatAdj(calculateAdj(character[key]))}</span>
        </div>
      `;

  return `
    <div class="stat-card">
      <div class="stat-card-top">
        <div class="label">${label}</div>
        ${adjBlock}
      </div>
      <div class="numeric">
        <button class="stepper" type="button" data-adjust="${key}" data-delta="-1" data-min="-999" data-max="999" aria-label="Decrease ${label}">−</button>
        <input type="number" data-num="${key}" data-min="-999" data-max="999" value="${character[key]}" min="-999" max="999" aria-label="${label}" />
        <button class="stepper" type="button" data-adjust="${key}" data-delta="1" data-min="-999" data-max="999" aria-label="Increase ${label}">+</button>
      </div>
    </div>
  `;
}

function traitSelectOptions(kind: "positive" | "negative"): string {
  const options =
    kind === "positive" ? POSITIVE_TRAIT_OPTIONS : NEGATIVE_TRAIT_OPTIONS;
  const taken = new Set(
    kind === "positive" ? character.positiveTraits : character.negativeTraits,
  );
  return options
    .map((trait) => {
      const disabled = taken.has(trait) ? " disabled" : "";
      return `<option value="${escapeAttr(trait)}"${disabled}>${escapeHtml(trait)}</option>`;
    })
    .join("");
}

function takenTraitsBox(kind: "positive" | "negative"): string {
  const traits =
    kind === "positive" ? character.positiveTraits : character.negativeTraits;
  const emptyLabel =
    kind === "positive"
      ? "No positive traits taken yet."
      : "No negative traits taken yet.";

  if (traits.length === 0) {
    return `<p class="taken-traits-empty">${emptyLabel}</p>`;
  }

  return `
    <ul class="taken-traits-list">
      ${traits
        .map(
          (trait) => `
        <li class="taken-trait">
          <span>${escapeHtml(trait)}</span>
          <button class="trait-remove" type="button" data-remove-trait="${escapeAttr(trait)}" data-trait-kind="${kind}" aria-label="Remove ${escapeAttr(trait)}">Remove</button>
        </li>
      `,
        )
        .join("")}
    </ul>
  `;
}

function addTrait(kind: "positive" | "negative", trait: string): void {
  const value = trait.trim();
  const label = kind === "positive" ? "positive trait" : "negative trait";
  if (!value) {
    setStatus(`Select a ${label} first.`);
    return;
  }

  const current =
    kind === "positive" ? character.positiveTraits : character.negativeTraits;
  if (current.includes(value)) {
    setStatus(`${value} is already taken.`);
    return;
  }

  character =
    kind === "positive"
      ? { ...character, positiveTraits: [...current, value] }
      : { ...character, negativeTraits: [...current, value] };
  persist();
  setStatus(`Took ${label}: ${value}`);
  render();
}

function removeTrait(kind: "positive" | "negative", trait: string): void {
  character =
    kind === "positive"
      ? {
          ...character,
          positiveTraits: character.positiveTraits.filter((item) => item !== trait),
        }
      : {
          ...character,
          negativeTraits: character.negativeTraits.filter((item) => item !== trait),
        };
  persist();
  setStatus(`Removed ${kind} trait: ${trait}`);
  render();
}

type SkillKind = "skills" | "classSkills" | "racialSkills";

function skillColumn(kind: SkillKind, label: string, placeholder: string): string {
  return `
    <div class="skill-column">
      <div class="skills-picker">
        <div class="field">
          <label for="${kind}Input">${label}</label>
          <div class="traits-add-row">
            <input id="${kind}Input" type="text" data-skill-input="${kind}" placeholder="${escapeAttr(placeholder)}" autocomplete="off" />
            <button class="btn" type="button" data-action="add-skill" data-skill-kind="${kind}">Add</button>
          </div>
        </div>
      </div>
      <div class="taken-traits" aria-live="polite">
        <div class="taken-traits-label">${label} taken</div>
        ${takenSkillsBox(kind)}
      </div>
    </div>
  `;
}

function skillList(kind: SkillKind): string[] {
  if (kind === "skills") return character.skills;
  if (kind === "classSkills") return character.classSkills;
  return character.racialSkills;
}

function skillLabel(kind: SkillKind): string {
  if (kind === "skills") return "skill";
  if (kind === "classSkills") return "class skill";
  return "racial skill";
}

function takenSkillsBox(kind: SkillKind): string {
  const skills = skillList(kind);
  if (skills.length === 0) {
    return `<p class="taken-traits-empty">No ${skillLabel(kind)}s taken yet.</p>`;
  }

  return `
    <ul class="taken-traits-list">
      ${skills
        .map(
          (skill) => `
        <li class="taken-trait">
          <span>${escapeHtml(skill)}</span>
          <button class="trait-remove" type="button" data-remove-skill="${escapeAttr(skill)}" data-skill-kind="${kind}" aria-label="Remove ${escapeAttr(skill)}">Remove</button>
        </li>
      `,
        )
        .join("")}
    </ul>
  `;
}

function addSkill(kind: SkillKind, skill: string): void {
  const value = skill.trim();
  const label = skillLabel(kind);
  if (!value) {
    setStatus(`Enter a ${label} first.`);
    return;
  }

  const current = skillList(kind);
  if (current.includes(value)) {
    setStatus(`${value} is already listed.`);
    return;
  }

  character = {
    ...character,
    [kind]: [...current, value],
  };
  persist();
  setStatus(`Added ${label}: ${value}`);
  render();
}

function removeSkill(kind: SkillKind, skill: string): void {
  character = {
    ...character,
    [kind]: skillList(kind).filter((item) => item !== skill),
  };
  persist();
  setStatus(`Removed ${skillLabel(kind)}: ${skill}`);
  render();
}

function inventoryBox(): string {
  if (character.inventory.length === 0) {
    return `<p class="taken-traits-empty">No items in inventory yet.</p>`;
  }

  return `
    <ul class="taken-traits-list inventory-list">
      ${character.inventory
        .map(
          (item) => `
        <li class="taken-trait inventory-item">
          <span class="inventory-item-name">${escapeHtml(item.name)}</span>
          <div class="inventory-amount-controls">
            <button class="stepper" type="button" data-inventory-adjust="${escapeAttr(item.name)}" data-delta="-1" aria-label="Decrease ${escapeAttr(item.name)}">−</button>
            <input type="number" class="inventory-amount-input" data-inventory-qty="${escapeAttr(item.name)}" value="${item.amount}" min="1" max="9999" aria-label="${escapeAttr(item.name)} amount" />
            <button class="stepper" type="button" data-inventory-adjust="${escapeAttr(item.name)}" data-delta="1" aria-label="Increase ${escapeAttr(item.name)}">+</button>
          </div>
          <button class="trait-remove" type="button" data-remove-inventory="${escapeAttr(item.name)}" aria-label="Remove ${escapeAttr(item.name)}">Remove</button>
        </li>
      `,
        )
        .join("")}
    </ul>
  `;
}

function addInventoryItem(item: string, amountInput: string): void {
  const value = item.trim();
  const amount = clampNumber(Number(amountInput || 1), 1, 9999);
  if (!value) {
    setStatus("Enter an item first.");
    return;
  }

  const existing = character.inventory.find(
    (entry) => entry.name.toLowerCase() === value.toLowerCase(),
  );
  if (existing) {
    character = {
      ...character,
      inventory: character.inventory.map((entry) =>
        entry.name.toLowerCase() === value.toLowerCase()
          ? {
              ...entry,
              amount: clampNumber(entry.amount + amount, 1, 9999),
            }
          : entry,
      ),
    };
    persist();
    setStatus(`Added ${amount} more ${existing.name} (now ${existing.amount + amount}).`);
    render();
    return;
  }

  character = {
    ...character,
    inventory: [...character.inventory, { name: value, amount }],
  };
  persist();
  setStatus(`Added to inventory: ${value} ×${amount}`);
  render();
}

function setInventoryAmount(itemName: string, amount: number): void {
  const nextAmount = clampNumber(amount, 1, 9999);
  character = {
    ...character,
    inventory: character.inventory.map((entry) =>
      entry.name === itemName ? { ...entry, amount: nextAmount } : entry,
    ),
  };
  persist();
  const input = document.querySelector<HTMLInputElement>(
    `[data-inventory-qty="${CSS.escape(itemName)}"]`,
  );
  if (input) input.value = String(nextAmount);
  setStatus(`${itemName} amount set to ${nextAmount}.`);
}

function adjustInventoryAmount(itemName: string, delta: number): void {
  const item = character.inventory.find((entry) => entry.name === itemName);
  if (!item) return;
  setInventoryAmount(itemName, item.amount + delta);
}

function removeInventoryItem(item: string): void {
  character = {
    ...character,
    inventory: character.inventory.filter((entry) => entry.name !== item),
  };
  persist();
  setStatus(`Removed from inventory: ${item}`);
  render();
}

function bindPageNav(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page === "catalog" ? "catalog" : "sheet";
      setPage(page);
    });
  });
}

function bindSheetEvents(): void {
  bindPageNav();

  document.querySelectorAll<HTMLElement>("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "new") newCharacter();
      if (action === "save") void saveToFile();
      if (action === "load") void loadFromFile();
      if (action === "print") window.print();
      if (action === "reset") resetCharacter();
      if (action === "add-positive-trait") {
        const select = document.querySelector<HTMLSelectElement>(
          '[data-trait-select="positive"]',
        );
        addTrait("positive", select?.value ?? "");
      }
      if (action === "add-negative-trait") {
        const select = document.querySelector<HTMLSelectElement>(
          '[data-trait-select="negative"]',
        );
        addTrait("negative", select?.value ?? "");
      }
      if (action === "add-skill") {
        const kind = (btn.dataset.skillKind as SkillKind) ?? "skills";
        const input = document.querySelector<HTMLInputElement>(
          `[data-skill-input="${kind}"]`,
        );
        addSkill(kind, input?.value ?? "");
      }
      if (action === "add-inventory") {
        const input = document.querySelector<HTMLInputElement>("[data-inventory-input]");
        const amount = document.querySelector<HTMLInputElement>("[data-inventory-amount]");
        addInventoryItem(input?.value ?? "", amount?.value ?? "1");
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-trait]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind =
        btn.dataset.traitKind === "negative" ? "negative" : "positive";
      removeTrait(kind, btn.dataset.removeTrait ?? "");
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-skill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = (btn.dataset.skillKind as SkillKind) ?? "skills";
      removeSkill(kind, btn.dataset.removeSkill ?? "");
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-inventory]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeInventoryItem(btn.dataset.removeInventory ?? "");
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-inventory-adjust]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adjustInventoryAmount(
        btn.dataset.inventoryAdjust ?? "",
        Number(btn.dataset.delta ?? 0),
      );
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-inventory-qty]").forEach((input) => {
    const commit = () => {
      setInventoryAmount(input.dataset.inventoryQty ?? "", Number(input.value));
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  });

  document.querySelectorAll<HTMLInputElement>("[data-skill-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const kind = (input.dataset.skillInput as SkillKind) ?? "skills";
      addSkill(kind, input.value);
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-inventory-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const amount = document.querySelector<HTMLInputElement>("[data-inventory-amount]");
      addInventoryItem(input.value, amount?.value ?? "1");
    });
  });

  document.querySelectorAll<HTMLSelectElement>("[data-trait-select]").forEach((select) => {
    select.addEventListener("change", () => {
      if (!select.value) return;
      const kind =
        select.dataset.traitSelect === "negative" ? "negative" : "positive";
      addTrait(kind, select.value);
    });
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "[data-text]",
  ).forEach((el) => {
    el.addEventListener("input", () => {
      const key = el.dataset.text as
        | "name"
        | "race"
        | "className"
        | "height"
        | "luckDie"
        | "armorType"
        | "armorMaterial"
        | "history"
        | "notes";
      updateText(key, el.value);
      if (key === "name") setStatus(el.value ? `Editing ${el.value}` : "Editing unnamed character");
      if (key === "armorType") {
        // Status is set inside applyArmorTypeChange.
      }
      if (key === "armorMaterial") {
        setStatus(
          el.value
            ? `Armor material set to ${el.value}.`
            : "Armor material cleared.",
        );
      }
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-num]").forEach((el) => {
    el.addEventListener("change", () => commitNumberInput(el));
    el.addEventListener("blur", () => commitNumberInput(el));
  });

  document.querySelectorAll<HTMLButtonElement>("[data-adjust]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.adjust as NumberFieldKey;
      const delta = Number(btn.dataset.delta ?? 0);
      const min = Number(btn.dataset.min ?? 0);
      const max = Number(btn.dataset.max ?? 999);
      adjustNumber(key, delta, min, max);
      if (
        !isStatKey(key) &&
        key !== "currentHealth" &&
        !isArmorSlotKey(key) &&
        !isArmorCurrentKey(key)
      ) {
        setStatus(`Updated ${labelFor(key)} to ${character[key]}`);
      }
    });
  });
}

function bindCatalogEvents(): void {
  bindPageNav();

  document.querySelectorAll<HTMLElement>("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "add-race") submitCatalogEntry("race");
      if (action === "add-class") submitCatalogEntry("class");
      if (action === "add-material") submitMaterialEntry();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-race]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.removeRace ?? "";
      if (!name) return;
      const ok = window.confirm(`Remove race “${name}”?`);
      if (!ok) return;
      if (removeRace(name)) {
        if (character.race === name) {
          applyRaceChange("");
        }
        setCatalogStatus(`Removed race “${name}”.`);
        render();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-class]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.removeClass ?? "";
      if (!name) return;
      const ok = window.confirm(`Remove class “${name}”?`);
      if (!ok) return;
      if (removeClass(name)) {
        if (character.className === name) {
          applyClassChange("");
        }
        setCatalogStatus(`Removed class “${name}”.`);
        render();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-material]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.removeMaterial ?? "";
      if (!name) return;
      const ok = window.confirm(`Remove material “${name}”?`);
      if (!ok) return;
      if (removeMaterial(name)) {
        if (character.armorMaterial === name) {
          character = { ...character, armorMaterial: "" };
          persist();
        }
        setCatalogStatus(`Removed material “${name}”.`);
        render();
      }
    });
  });
}

function commitNumberInput(el: HTMLInputElement): void {
  const key = el.dataset.num as NumberFieldKey;
  const min = Number(el.dataset.min ?? 0);
  const max =
    key === "unusedPoints"
      ? Math.max(maxUnusedPoints(character.level), character.unusedPoints)
      : key === "currentHealth"
        ? character.maxHealth
        : isArmorCurrentKey(key)
          ? character[armorSlotForCurrent(key)]
          : Number(el.dataset.max ?? 999);
  updateNumber(key, Number(el.value), min, max);
  if (
    !isStatKey(key) &&
    key !== "currentHealth" &&
    !isArmorSlotKey(key) &&
    !isArmorCurrentKey(key)
  ) {
    setStatus(`Updated ${labelFor(key)} to ${character[key]}`);
  }
}

function labelFor(key: NumberFieldKey): string {
  if (key === "level") return "Level";
  if (key === "age") return "Age";
  if (key === "unusedPoints") return "Unused Points";
  if (key === "currentHealth") return "Current Health";
  if (isArmorSlotKey(key)) return `${ARMOR_SLOT_LABELS[key]} Max`;
  if (isArmorCurrentKey(key)) {
    return `${ARMOR_SLOT_LABELS[armorSlotForCurrent(key)]} Current`;
  }
  return STAT_LABELS[key];
}

function newCharacter(): void {
  if (
    character.name ||
    character.race ||
    character.className ||
    character.positiveTraits.length > 0 ||
    character.negativeTraits.length > 0 ||
    character.skills.length > 0 ||
    character.classSkills.length > 0 ||
    character.racialSkills.length > 0 ||
    character.inventory.length > 0 ||
    character.history ||
    character.notes
  ) {
    const ok = window.confirm("Start a new blank character? Unsaved file changes may be lost (browser autosave will update).");
    if (!ok) return;
  }
  character = createBlankCharacter();
  persist();
  setStatus("Started a new character.");
  render();
}

function resetCharacter(): void {
  const ok = window.confirm("Reset all fields to defaults?");
  if (!ok) return;
  character = createBlankCharacter();
  persist();
  setStatus("Character reset to defaults.");
  render();
}

async function saveToFile(): Promise<void> {
  const payload = JSON.stringify(character, null, 2);
  const filename = `${slugify(character.name || "character")}.json`;

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (
        window as Window & {
          showSaveFilePicker: (options?: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Character JSON",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      setStatus(`Saved ${filename}`);
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }

  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${filename}`);
}

async function loadFromFile(): Promise<void> {
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await (
        window as Window & {
          showOpenFilePicker: (options?: unknown) => Promise<FileSystemFileHandle[]>;
        }
      ).showOpenFilePicker({
        types: [
          {
            description: "Character JSON",
            accept: { "application/json": [".json"] },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      await applyLoadedFile(file);
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (file) await applyLoadedFile(file);
  });
  input.click();
}

async function applyLoadedFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = parseCharacter(JSON.parse(text));
    if (!parsed) {
      setStatus("Could not read that character file.");
      return;
    }
    character = parsed;
    persist();
    setStatus(`Loaded ${file.name}`);
    render();
  } catch {
    setStatus("Invalid character file.");
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "character"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
