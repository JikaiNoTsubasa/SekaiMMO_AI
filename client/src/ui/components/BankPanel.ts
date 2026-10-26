// Bank Panel - Interface de banque personnelle
// SekaiMMO v2.0

import type { ItemData, InventorySlot } from './InventoryPanel';

export interface BankPanelConfig {
  container: HTMLElement;
  bankSlots: number;
  inventorySlots: number;
  columns: number;
  onDeposit?: (inventorySlotIndex: number, quantity: number) => void;
  onWithdraw?: (bankSlotIndex: number, quantity: number) => void;
  onDepositAll?: () => void;
}

export class BankPanel {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: BankPanelConfig;
  private isVisible: boolean = false;

  private bankSlots: InventorySlot[] = [];
  private inventorySlots: InventorySlot[] = [];
  private bankSlotElements: HTMLElement[] = [];
  private inventorySlotElements: HTMLElement[] = [];

  private selectedBankSlot: number | null = null;
  private selectedInventorySlot: number | null = null;

  constructor(config: BankPanelConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.initializeSlots();
    this.container.appendChild(this.element);
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'bank-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Banque Personnelle</h2>
        <button class="panel-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="bank-content">
        <div class="bank-section">
          <div class="section-header">
            <h3>Coffre (${this.config.bankSlots} slots)</h3>
            <span class="slots-used bank-slots-used">0/${this.config.bankSlots}</span>
          </div>
          <div class="bank-grid" style="grid-template-columns: repeat(${this.config.columns}, 1fr);"></div>
        </div>
        <div class="bank-actions">
          <button class="btn-deposit" disabled>Déposer ↓</button>
          <button class="btn-withdraw" disabled>Retirer ↑</button>
          <button class="btn-deposit-all">Tout déposer</button>
        </div>
        <div class="inventory-section">
          <div class="section-header">
            <h3>Inventaire</h3>
            <span class="slots-used inventory-slots-used">0/${this.config.inventorySlots}</span>
          </div>
          <div class="inventory-grid" style="grid-template-columns: repeat(${this.config.columns}, 1fr);"></div>
        </div>
      </div>
    `;

    // Close button
    const closeBtn = panel.querySelector('.panel-close')!;
    closeBtn.addEventListener('click', () => this.hide());

    // Action buttons
    const depositBtn = panel.querySelector<HTMLButtonElement>('.btn-deposit')!;
    depositBtn.addEventListener('click', () => this.depositSelected());

    const withdrawBtn = panel.querySelector<HTMLButtonElement>('.btn-withdraw')!;
    withdrawBtn.addEventListener('click', () => this.withdrawSelected());

    const depositAllBtn = panel.querySelector('.btn-deposit-all')!;
    depositAllBtn.addEventListener('click', () => {
      this.config.onDepositAll?.();
    });

    return panel;
  }

  private initializeSlots(): void {
    const bankGrid = this.element.querySelector('.bank-grid')!;
    const inventoryGrid = this.element.querySelector('.inventory-grid')!;

    // Initialize bank slots
    for (let i = 0; i < this.config.bankSlots; i++) {
      this.bankSlots.push({ item: null, quantity: 0 });
      const slotEl = this.createSlotElement(i, 'bank');
      bankGrid.appendChild(slotEl);
      this.bankSlotElements.push(slotEl);
    }

    // Initialize inventory slots
    for (let i = 0; i < this.config.inventorySlots; i++) {
      this.inventorySlots.push({ item: null, quantity: 0 });
      const slotEl = this.createSlotElement(i, 'inventory');
      inventoryGrid.appendChild(slotEl);
      this.inventorySlotElements.push(slotEl);
    }
  }

  private createSlotElement(index: number, type: 'bank' | 'inventory'): HTMLElement {
    const slotEl = document.createElement('div');
    slotEl.className = 'bank-slot';
    slotEl.dataset.slotIndex = String(index);
    slotEl.dataset.slotType = type;
    slotEl.innerHTML = `
      <div class="slot-icon"></div>
      <div class="slot-quantity"></div>
    `;

    slotEl.addEventListener('click', () => {
      this.selectSlot(index, type);
    });

    slotEl.addEventListener('dblclick', () => {
      if (type === 'bank') {
        this.withdrawSelected();
      } else {
        this.depositSelected();
      }
    });

    return slotEl;
  }

  private selectSlot(index: number, type: 'bank' | 'inventory'): void {
    // Clear previous selections
    this.bankSlotElements.forEach((el) => el.classList.remove('selected'));
    this.inventorySlotElements.forEach((el) => el.classList.remove('selected'));

    if (type === 'bank') {
      this.selectedBankSlot = index;
      this.selectedInventorySlot = null;
      this.bankSlotElements[index]?.classList.add('selected');
    } else {
      this.selectedInventorySlot = index;
      this.selectedBankSlot = null;
      this.inventorySlotElements[index]?.classList.add('selected');
    }

    this.updateActionButtons();
  }

  private updateActionButtons(): void {
    const depositBtn = this.element.querySelector<HTMLButtonElement>('.btn-deposit')!;
    const withdrawBtn = this.element.querySelector<HTMLButtonElement>('.btn-withdraw')!;

    const hasInventorySelection = this.selectedInventorySlot !== null &&
      this.inventorySlots[this.selectedInventorySlot]?.item !== null;
    const hasBankSelection = this.selectedBankSlot !== null &&
      this.bankSlots[this.selectedBankSlot]?.item !== null;

    depositBtn.disabled = !hasInventorySelection;
    withdrawBtn.disabled = !hasBankSelection;
  }

  private depositSelected(): void {
    if (this.selectedInventorySlot === null) return;
    const slot = this.inventorySlots[this.selectedInventorySlot];
    if (!slot.item) return;

    this.config.onDeposit?.(this.selectedInventorySlot, slot.quantity);
  }

  private withdrawSelected(): void {
    if (this.selectedBankSlot === null) return;
    const slot = this.bankSlots[this.selectedBankSlot];
    if (!slot.item) return;

    this.config.onWithdraw?.(this.selectedBankSlot, slot.quantity);
  }

  /**
   * Met à jour les slots de la banque
   */
  setBankItems(items: { item: ItemData; quantity: number }[]): void {
    // Reset slots
    for (let i = 0; i < this.bankSlots.length; i++) {
      this.bankSlots[i] = { item: null, quantity: 0 };
    }

    // Fill with items
    items.forEach((entry, index) => {
      if (index < this.bankSlots.length) {
        this.bankSlots[index] = { item: entry.item, quantity: entry.quantity };
      }
    });

    // Update visuals
    for (let i = 0; i < this.bankSlots.length; i++) {
      this.updateSlotVisuals(i, 'bank');
    }
    this.updateSlotCount('bank');
  }

  /**
   * Met à jour les slots de l'inventaire
   */
  setInventoryItems(items: { item: ItemData; quantity: number }[]): void {
    // Reset slots
    for (let i = 0; i < this.inventorySlots.length; i++) {
      this.inventorySlots[i] = { item: null, quantity: 0 };
    }

    // Fill with items
    items.forEach((entry, index) => {
      if (index < this.inventorySlots.length) {
        this.inventorySlots[index] = { item: entry.item, quantity: entry.quantity };
      }
    });

    // Update visuals
    for (let i = 0; i < this.inventorySlots.length; i++) {
      this.updateSlotVisuals(i, 'inventory');
    }
    this.updateSlotCount('inventory');
  }

  private updateSlotVisuals(index: number, type: 'bank' | 'inventory'): void {
    const slots = type === 'bank' ? this.bankSlots : this.inventorySlots;
    const elements = type === 'bank' ? this.bankSlotElements : this.inventorySlotElements;

    const slot = slots[index];
    const slotEl = elements[index];
    if (!slotEl) return;

    const iconEl = slotEl.querySelector<HTMLElement>('.slot-icon')!;
    const quantityEl = slotEl.querySelector<HTMLElement>('.slot-quantity')!;

    slotEl.classList.remove('has-item');

    if (!slot.item) {
      iconEl.textContent = '';
      iconEl.style.backgroundColor = '';
      quantityEl.textContent = '';
      return;
    }

    slotEl.classList.add('has-item');

    // Icon
    const initials = slot.item.name.substring(0, 2).toUpperCase();
    iconEl.textContent = initials;
    iconEl.style.backgroundColor = this.getTypeColor(slot.item.type);

    // Quantity
    if (slot.quantity > 1) {
      quantityEl.textContent = slot.quantity > 9999 ? '9999+' : String(slot.quantity);
    } else {
      quantityEl.textContent = '';
    }
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

  private updateSlotCount(type: 'bank' | 'inventory'): void {
    const slots = type === 'bank' ? this.bankSlots : this.inventorySlots;
    const maxSlots = type === 'bank' ? this.config.bankSlots : this.config.inventorySlots;
    const usedSlots = slots.filter((s) => s.item !== null).length;

    const slotsElement = this.element.querySelector(`.${type}-slots-used`)!;
    slotsElement.textContent = `${usedSlots}/${maxSlots}`;
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
    this.selectedBankSlot = null;
    this.selectedInventorySlot = null;
    this.bankSlotElements.forEach((el) => el.classList.remove('selected'));
    this.inventorySlotElements.forEach((el) => el.classList.remove('selected'));
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
    this.bankSlots = [];
    this.inventorySlots = [];
    this.bankSlotElements = [];
    this.inventorySlotElements = [];
  }
}
