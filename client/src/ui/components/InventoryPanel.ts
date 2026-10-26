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
  icon?: string;
}

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
}

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

  constructor(config: InventoryPanelConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.initializeSlots();
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
      iconEl.textContent = '';
      iconEl.style.backgroundColor = '';
      quantityEl.textContent = '';
      rarityBorder.style.borderColor = 'transparent';
      return;
    }

    slotEl.classList.add('has-item');

    // Icon (placeholder avec initiales)
    const initials = slot.item.name.substring(0, 2).toUpperCase();
    iconEl.textContent = initials;
    iconEl.style.backgroundColor = this.getTypeColor(slot.item.type);

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
    const slot = this.slots[index];
    if (!slot.item) return;

    const tooltip = this.element.querySelector<HTMLElement>('.item-tooltip')!;
    const slotEl = this.slotElements[index];
    const rect = slotEl.getBoundingClientRect();
    const panelRect = this.element.getBoundingClientRect();

    tooltip.innerHTML = `
      <div class="tooltip-header" style="color: ${RARITY_COLORS[slot.item.rarity] ?? '#fff'}">
        ${slot.item.name}
      </div>
      <div class="tooltip-type">${slot.item.type} · ${slot.item.rarity}</div>
      <div class="tooltip-desc">${slot.item.description ?? ''}</div>
      ${slot.item.stackable ? `<div class="tooltip-stack">Stack max: ${slot.item.maxStack}</div>` : ''}
    `;

    tooltip.style.display = 'block';
    tooltip.style.left = `${rect.left - panelRect.left + 50}px`;
    tooltip.style.top = `${rect.top - panelRect.top}px`;
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
