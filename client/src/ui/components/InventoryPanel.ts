// Inventory Panel - Panneau d'inventaire avec grille et stacks
// SekaiMMO v2.0

export interface ItemData {
  id: number;
  name: string;
  description?: string;
  type: string;
  rarity: string;
  stackable: boolean;
  maxStack: number;
  icon?: string; // URL web de l'image (voir resolveItemIcon)
  stats?: Record<string, number>;
  requiredRank?: string;
  weaponInfo?: { name: string; damageType: string; attackSpeed: string; isRanged: boolean };
}

/**
 * Convertit l'iconUrl stockée en base en URL web.
 * La base peut contenir "public/assets/items/..." : Vite sert le dossier public à la racine.
 */
export function resolveItemIcon(iconUrl: string | null | undefined): string | undefined {
  const url = iconUrl?.trim();
  if (!url) return undefined;
  if (/^(https?:)?\/\//.test(url)) return url;
  return '/' + url.replace(/^\/+/, '').replace(/^public\//, '');
}

/** Affiche l'icône d'un item (image si disponible, sinon initiales sur fond coloré) */
export function applyItemIcon(iconEl: HTMLElement, item: ItemData | null, fallbackColor: string): void {
  iconEl.classList.remove('has-image');
  iconEl.style.backgroundImage = '';

  if (!item) {
    iconEl.textContent = '';
    iconEl.style.backgroundColor = '';
    return;
  }

  if (item.icon) {
    iconEl.classList.add('has-image');
    iconEl.textContent = '';
    iconEl.style.backgroundColor = 'transparent';
    iconEl.style.backgroundImage = `url("${item.icon}")`;
    return;
  }

  iconEl.textContent = item.name.substring(0, 2).toUpperCase();
  iconEl.style.backgroundColor = fallbackColor;
}

/** Extrait les stats numériques d'un item (JSON stocké en objet ou en string) */
export function parseItemStats(raw: unknown): Record<string, number> {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: Record<string, number> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'number') result[key] = v;
  }
  return result;
}

// Libellé et format des stats ; pct = affiché en pourcentage
const STAT_LABELS: Record<string, { label: string; pct?: boolean }> = {
  physicalAttack: { label: 'Dégâts physiques' },
  magicalAttack: { label: 'Dégâts magiques' },
  physicalDefense: { label: 'Défense physique' },
  magicalDefense: { label: 'Défense magique' },
  physicalPenetration: { label: 'Pénétration physique' },
  magicalPenetration: { label: 'Pénétration magique' },
  critChance: { label: 'Chance de critique', pct: true },
  critDamage: { label: 'Dégâts critiques', pct: true },
  attackSpeed: { label: "Vitesse d'attaque" },
  movementSpeed: { label: 'Vitesse de déplacement' },
  maxHealth: { label: 'PV max' },
  maxMana: { label: 'Mana max' },
  healAmount: { label: 'Soin' },
  manaAmount: { label: 'Mana rendu' },
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: 'Physique',
  MAGICAL: 'Magique',
  PURE: 'Pur',
};

const ATTACK_SPEED_LABELS: Record<string, string> = {
  SLOW: 'Lente',
  NORMAL: 'Normale',
  FAST: 'Rapide',
};

const formatStat = (key: string, value: number): string => {
  const sign = value > 0 ? '+' : '';
  if (STAT_LABELS[key]?.pct) return `${sign}${Math.round(value * 1000) / 10}%`;
  return `${sign}${Math.round(value * 100) / 100}`;
};

export interface InventorySlot {
  item: ItemData | null;
  quantity: number;
}

export interface InventoryPanelConfig {
  container: HTMLElement;
  slots: number;
  columns: number;
  onItemClick?: (slotIndex: number, item: ItemData | null) => void;
  onItemRightClick?: (slotIndex: number, item: ItemData | null) => void;
  onItemDrop?: (fromSlot: number, toSlot: number) => void;
  onItemUse?: (slotIndex: number, item: ItemData) => void;
  onEquipmentClick?: (slot: EquipmentSlotKey, item: ItemData | null) => void;
}

export type EquipmentSlotKey =
  | 'HEAD' | 'NECKLACE' | 'CHEST' | 'LEGS' | 'FEET' | 'HANDS'
  | 'MAIN_HAND' | 'OFF_HAND' | 'RING_1' | 'RING_2';

// Disposition façon "poupée" : null = case vide de mise en page
const EQUIPMENT_LAYOUT: (EquipmentSlotKey | null)[] = [
  'NECKLACE', 'HEAD', null,
  'MAIN_HAND', 'CHEST', 'OFF_HAND',
  'HANDS', 'LEGS', 'FEET',
  'RING_1', null, 'RING_2',
];

const EQUIPMENT_LABELS: Record<EquipmentSlotKey, string> = {
  HEAD: 'Tête',
  NECKLACE: 'Collier',
  CHEST: 'Torse',
  LEGS: 'Jambes',
  FEET: 'Pieds',
  HANDS: 'Mains',
  MAIN_HAND: 'Arme',
  OFF_HAND: 'Main g.',
  RING_1: 'Anneau',
  RING_2: 'Anneau',
};

const RARITY_COLORS: Record<string, string> = {
  COMMON: '#aaaaaa',
  UNCOMMON: '#00ff00',
  RARE: '#0088ff',
  EPIC: '#aa00ff',
  LEGENDARY: '#ff8800',
};

export class InventoryPanel {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: InventoryPanelConfig;
  private slots: InventorySlot[] = [];
  private slotElements: HTMLElement[] = [];
  private draggedSlot: number | null = null;
  private isVisible: boolean = false;
  private equipment: Partial<Record<EquipmentSlotKey, ItemData>> = {};
  private equipmentElements = new Map<EquipmentSlotKey, HTMLElement>();
  private equippedWeapon: { id: number; name: string } | null = null;

  constructor(config: InventoryPanelConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.initializeSlots();
    this.initializeEquipment();
    this.container.appendChild(this.element);
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'inventory-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Inventaire</h2>
        <button class="panel-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="panel-content">
        <div class="inventory-info">
          <span class="gold-display">Or: <span class="gold-value">0</span></span>
          <span class="slots-display">Slots: <span class="slots-value">0/${this.config.slots}</span></span>
        </div>
        <div class="equipment-section">
          <div class="equipment-title">Équipement</div>
          <div class="equipment-grid"></div>
        </div>
        <div class="inventory-grid" style="grid-template-columns: repeat(${this.config.columns}, 1fr);"></div>
        <div class="inventory-actions">
          <button class="btn-sort">Trier</button>
          <button class="btn-deposit-all">Tout déposer</button>
        </div>
      </div>
      <div class="item-tooltip"></div>
    `;

    const closeBtn = panel.querySelector('.panel-close')!;
    closeBtn.addEventListener('click', () => this.hide());

    const sortBtn = panel.querySelector('.btn-sort')!;
    sortBtn.addEventListener('click', () => this.sortInventory());

    return panel;
  }

  private initializeSlots(): void {
    const grid = this.element.querySelector('.inventory-grid')!;

    for (let i = 0; i < this.config.slots; i++) {
      this.slots.push({ item: null, quantity: 0 });

      const slotEl = document.createElement('div');
      slotEl.className = 'inventory-slot';
      slotEl.dataset.slotIndex = String(i);
      slotEl.draggable = true;
      slotEl.innerHTML = `
        <div class="slot-icon"></div>
        <div class="slot-quantity"></div>
        <div class="slot-rarity-border"></div>
      `;

      this.setupSlotEvents(slotEl, i);
      grid.appendChild(slotEl);
      this.slotElements.push(slotEl);
    }
  }

  private initializeEquipment(): void {
    const grid = this.element.querySelector('.equipment-grid')!;

    for (const key of EQUIPMENT_LAYOUT) {
      if (!key) {
        const spacer = document.createElement('div');
        spacer.className = 'equipment-spacer';
        grid.appendChild(spacer);
        continue;
      }

      const el = document.createElement('div');
      el.className = 'equipment-slot';
      el.dataset.equipSlot = key;
      el.innerHTML = `
        <div class="slot-icon"></div>
        <div class="equipment-label">${EQUIPMENT_LABELS[key]}</div>
        <div class="slot-rarity-border"></div>
      `;

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.config.onEquipmentClick?.(key, this.equipment[key] ?? null);
      });
      el.addEventListener('mouseenter', () => {
        const item = this.equipment[key];
        if (item) this.showItemTooltip(item, el);
      });
      el.addEventListener('mouseleave', () => this.hideTooltip());

      grid.appendChild(el);
      this.equipmentElements.set(key, el);
    }
  }

  /**
   * Définit l'arme équipée (seul emplacement géré côté serveur pour l'instant).
   * Les infos de l'item sont reprises de l'inventaire quand il y figure.
   */
  setEquippedWeapon(id: number | null, name: string | null): void {
    this.equippedWeapon = id !== null ? { id, name: name ?? 'Arme' } : null;
    this.refreshEquippedWeapon();
  }

  private refreshEquippedWeapon(): void {
    if (!this.equippedWeapon) {
      this.setEquipmentSlot('MAIN_HAND', null);
      return;
    }
    const { id, name } = this.equippedWeapon;
    const fromInventory = this.slots.find((s) => s.item?.id === id)?.item;
    this.setEquipmentSlot(
      'MAIN_HAND',
      fromInventory ?? { id, name, type: 'WEAPON', rarity: 'COMMON', stackable: false, maxStack: 1 }
    );
  }

  setEquipmentSlot(key: EquipmentSlotKey, item: ItemData | null): void {
    const el = this.equipmentElements.get(key);
    if (!el) return;

    if (item) this.equipment[key] = item;
    else delete this.equipment[key];

    const icon = el.querySelector<HTMLElement>('.slot-icon')!;
    const label = el.querySelector<HTMLElement>('.equipment-label')!;
    const border = el.querySelector<HTMLElement>('.slot-rarity-border')!;

    el.classList.toggle('has-item', item !== null);
    el.classList.remove('rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic', 'rarity-legendary');
    if (item) el.classList.add(`rarity-${item.rarity.toLowerCase()}`);
    label.style.display = item ? 'none' : '';
    applyItemIcon(icon, item, item ? this.getTypeColor(item.type) : '');
    border.style.borderColor = item ? RARITY_COLORS[item.rarity] ?? RARITY_COLORS.COMMON : 'transparent';
  }

  private setupSlotEvents(slotEl: HTMLElement, index: number): void {
    // Click
    slotEl.addEventListener('click', () => {
      const slot = this.slots[index];
      this.config.onItemClick?.(index, slot.item);
    });

    // Right click
    slotEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const slot = this.slots[index];
      this.config.onItemRightClick?.(index, slot.item);
    });

    // Double click to use
    slotEl.addEventListener('dblclick', () => {
      const slot = this.slots[index];
      if (slot.item) {
        this.config.onItemUse?.(index, slot.item);
      }
    });

    // Drag start
    slotEl.addEventListener('dragstart', (e) => {
      if (!this.slots[index].item) {
        e.preventDefault();
        return;
      }
      this.draggedSlot = index;
      slotEl.classList.add('dragging');
      e.dataTransfer!.effectAllowed = 'move';
    });

    // Drag end
    slotEl.addEventListener('dragend', () => {
      slotEl.classList.remove('dragging');
      this.draggedSlot = null;
    });

    // Drag over
    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      slotEl.classList.add('drag-over');
    });

    // Drag leave
    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('drag-over');
    });

    // Drop
    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      slotEl.classList.remove('drag-over');
      if (this.draggedSlot !== null && this.draggedSlot !== index) {
        this.config.onItemDrop?.(this.draggedSlot, index);
        this.swapSlots(this.draggedSlot, index);
      }
    });

    // Hover for tooltip
    slotEl.addEventListener('mouseenter', () => {
      this.showTooltip(index);
    });

    slotEl.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  /**
   * Met à jour un slot
   */
  setSlot(index: number, item: ItemData | null, quantity: number): void {
    if (index < 0 || index >= this.slots.length) return;

    this.slots[index] = { item, quantity };
    this.updateSlotVisuals(index);
    this.updateSlotCount();
  }

  /**
   * Met à jour tous les slots
   */
  setItems(items: { item: ItemData; quantity: number }[]): void {
    // Reset tous les slots
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i] = { item: null, quantity: 0 };
    }

    // Remplir avec les items
    items.forEach((entry, index) => {
      if (index < this.slots.length) {
        this.slots[index] = { item: entry.item, quantity: entry.quantity };
      }
    });

    // Mettre à jour les visuels
    for (let i = 0; i < this.slots.length; i++) {
      this.updateSlotVisuals(i);
    }
    this.updateSlotCount();
    this.refreshEquippedWeapon();
  }

  /**
   * Met à jour le montant d'or affiché
   */
  setGold(amount: number): void {
    const goldValue = this.element.querySelector('.gold-value')!;
    goldValue.textContent = amount.toLocaleString();
  }

  private updateSlotVisuals(index: number): void {
    const slot = this.slots[index];
    const slotEl = this.slotElements[index];
    if (!slotEl) return;

    const iconEl = slotEl.querySelector<HTMLElement>('.slot-icon')!;
    const quantityEl = slotEl.querySelector<HTMLElement>('.slot-quantity')!;
    const rarityBorder = slotEl.querySelector<HTMLElement>('.slot-rarity-border')!;

    slotEl.classList.remove('has-item', 'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic', 'rarity-legendary');

    if (!slot.item) {
      applyItemIcon(iconEl, null, '');
      quantityEl.textContent = '';
      rarityBorder.style.borderColor = 'transparent';
      return;
    }

    slotEl.classList.add('has-item');

    // Icône (image, sinon initiales)
    applyItemIcon(iconEl, slot.item, this.getTypeColor(slot.item.type));

    // Quantity
    if (slot.quantity > 1) {
      quantityEl.textContent = slot.quantity > 9999 ? '9999+' : String(slot.quantity);
    } else {
      quantityEl.textContent = '';
    }

    // Rarity border
    const rarityColor = RARITY_COLORS[slot.item.rarity] ?? RARITY_COLORS.COMMON;
    rarityBorder.style.borderColor = rarityColor;
    slotEl.classList.add(`rarity-${slot.item.rarity.toLowerCase()}`);
  }

  private getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      WEAPON: '#cc4444',
      ARMOR: '#4444cc',
      CONSUMABLE: '#44cc44',
      MATERIAL: '#cc8844',
      QUEST: '#cccc44',
      CURRENCY: '#ffcc00',
    };
    return colors[type] ?? '#666666';
  }

  private updateSlotCount(): void {
    const usedSlots = this.slots.filter((s) => s.item !== null).length;
    const slotsValue = this.element.querySelector('.slots-value')!;
    slotsValue.textContent = `${usedSlots}/${this.config.slots}`;
  }

  private swapSlots(from: number, to: number): void {
    const temp = this.slots[from];
    this.slots[from] = this.slots[to];
    this.slots[to] = temp;
    this.updateSlotVisuals(from);
    this.updateSlotVisuals(to);
  }

  private sortInventory(): void {
    // Trier les items par type puis par rarity
    const itemsWithIndex = this.slots
      .map((slot, index) => ({ slot, index }))
      .filter((s) => s.slot.item !== null);

    const rarityOrder = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];

    itemsWithIndex.sort((a, b) => {
      const itemA = a.slot.item!;
      const itemB = b.slot.item!;

      // Par type d'abord
      if (itemA.type !== itemB.type) {
        return itemA.type.localeCompare(itemB.type);
      }

      // Puis par rarity
      const rarityA = rarityOrder.indexOf(itemA.rarity);
      const rarityB = rarityOrder.indexOf(itemB.rarity);
      if (rarityA !== rarityB) {
        return rarityA - rarityB;
      }

      // Puis par nom
      return itemA.name.localeCompare(itemB.name);
    });

    // Réorganiser les slots
    for (let i = 0; i < this.slots.length; i++) {
      if (i < itemsWithIndex.length) {
        this.slots[i] = itemsWithIndex[i].slot;
      } else {
        this.slots[i] = { item: null, quantity: 0 };
      }
      this.updateSlotVisuals(i);
    }
  }

  private showTooltip(index: number): void {
    const item = this.slots[index].item;
    if (!item) return;
    this.showItemTooltip(item, this.slotElements[index]);
  }

  private showItemTooltip(item: ItemData, anchor: HTMLElement): void {
    const tooltip = this.element.querySelector<HTMLElement>('.item-tooltip')!;
    const rect = anchor.getBoundingClientRect();
    const panelRect = this.element.getBoundingClientRect();

    tooltip.innerHTML = `
      <div class="tooltip-header" style="color: ${RARITY_COLORS[item.rarity] ?? '#fff'}">
        ${item.name}
      </div>
      <div class="tooltip-type">${item.type} · ${item.rarity}</div>
      ${this.buildItemDetails(item)}
      <div class="tooltip-desc">${item.description ?? ''}</div>
      ${item.stackable ? `<div class="tooltip-stack">Stack max: ${item.maxStack}</div>` : ''}
    `;

    tooltip.style.display = 'block';
    tooltip.style.left = `${rect.left - panelRect.left + 50}px`;
    tooltip.style.top = `${rect.top - panelRect.top}px`;
  }

  private buildItemDetails(item: ItemData): string {
    const lines: string[] = [];

    if (item.weaponInfo) {
      const w = item.weaponInfo;
      lines.push(
        `<div class="tooltip-line"><span>Type</span><span>${w.name}${w.isRanged ? ' (distance)' : ''}</span></div>`,
        `<div class="tooltip-line"><span>Dégâts</span><span>${DAMAGE_TYPE_LABELS[w.damageType] ?? w.damageType}</span></div>`,
        `<div class="tooltip-line"><span>Vitesse</span><span>${ATTACK_SPEED_LABELS[w.attackSpeed] ?? w.attackSpeed}</span></div>`
      );
    }

    for (const [key, value] of Object.entries(item.stats ?? {})) {
      const label = STAT_LABELS[key]?.label ?? key;
      lines.push(`<div class="tooltip-line tooltip-stat"><span>${label}</span><span>${formatStat(key, value)}</span></div>`);
    }

    if (item.requiredRank) {
      lines.push(`<div class="tooltip-line"><span>Rang requis</span><span>${item.requiredRank}</span></div>`);
    }

    return lines.length ? `<div class="tooltip-stats-block">${lines.join('')}</div>` : '';
  }

  private hideTooltip(): void {
    const tooltip = this.element.querySelector<HTMLElement>('.item-tooltip')!;
    tooltip.style.display = 'none';
  }

  /**
   * Affiche le panneau
   */
  show(): void {
    this.isVisible = true;
    this.element.classList.add('visible');
  }

  /**
   * Cache le panneau
   */
  hide(): void {
    this.isVisible = false;
    this.element.classList.remove('visible');
  }

  /**
   * Toggle la visibilité
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Vérifie si le panneau est visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Récupère l'élément DOM
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Détruit le composant
   */
  destroy(): void {
    this.element.remove();
    this.slots = [];
    this.slotElements = [];
  }
}
