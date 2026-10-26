// Skill Bar Component - Barre de skills avec cooldowns visuels
// SekaiMMO v2.0

import type { SkillSlot, SkillData } from '../../game/types';

export interface SkillBarConfig {
  container: HTMLElement;
  onSkillClick?: (slot: SkillSlot) => void;
  onSkillRightClick?: (slot: SkillSlot) => void;
}

interface SkillSlotState {
  skill: SkillData | null;
  cooldownRemaining: number;
  cooldownTotal: number;
  isOnCooldown: boolean;
  hasEnoughMana: boolean;
}

export class SkillBar {
  private container: HTMLElement;
  private element: HTMLElement;
  private slots: Map<SkillSlot, HTMLElement> = new Map();
  private slotStates: Map<SkillSlot, SkillSlotState> = new Map();
  private config: SkillBarConfig;
  private animationFrame: number | null = null;

  constructor(config: SkillBarConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.initializeSlots();
    this.container.appendChild(this.element);
  }

  private createElement(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'skill-bar-v2';
    bar.innerHTML = `
      <div class="skill-bar-inner">
        <div class="skill-row skill-row-primary"></div>
        <div class="skill-row skill-row-secondary"></div>
      </div>
    `;
    return bar;
  }

  private initializeSlots(): void {
    const primaryRow = this.element.querySelector('.skill-row-primary')!;
    const secondaryRow = this.element.querySelector('.skill-row-secondary')!;

    // Row 1: Q W E R T
    const primarySlots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T'];
    // Row 2: A S D F
    const secondarySlots: SkillSlot[] = ['A', 'S', 'D', 'F'];

    primarySlots.forEach((slot) => {
      const slotEl = this.createSlotElement(slot);
      primaryRow.appendChild(slotEl);
      this.slots.set(slot, slotEl);
      this.slotStates.set(slot, {
        skill: null,
        cooldownRemaining: 0,
        cooldownTotal: 0,
        isOnCooldown: false,
        hasEnoughMana: true,
      });
    });

    secondarySlots.forEach((slot) => {
      const slotEl = this.createSlotElement(slot);
      secondaryRow.appendChild(slotEl);
      this.slots.set(slot, slotEl);
      this.slotStates.set(slot, {
        skill: null,
        cooldownRemaining: 0,
        cooldownTotal: 0,
        isOnCooldown: false,
        hasEnoughMana: true,
      });
    });
  }

  private createSlotElement(slot: SkillSlot): HTMLElement {
    const slotEl = document.createElement('div');
    slotEl.className = 'skill-slot-v2';
    slotEl.dataset.slot = slot;
    slotEl.innerHTML = `
      <div class="skill-slot-inner">
        <div class="skill-icon"></div>
        <div class="skill-cooldown-overlay"></div>
        <div class="skill-cooldown-text"></div>
        <div class="skill-key">${slot}</div>
        <div class="skill-mana-cost"></div>
      </div>
      <div class="skill-tooltip"></div>
    `;

    slotEl.addEventListener('click', () => {
      this.config.onSkillClick?.(slot);
    });

    slotEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.config.onSkillRightClick?.(slot);
    });

    return slotEl;
  }

  /**
   * Met à jour un skill dans un slot
   */
  setSkill(slot: SkillSlot, skill: SkillData | null): void {
    const state = this.slotStates.get(slot);
    if (!state) return;

    state.skill = skill;
    this.updateSlotVisuals(slot);
  }

  /**
   * Met à jour tous les skills
   */
  setSkills(skills: Map<SkillSlot, SkillData | null>): void {
    skills.forEach((skill, slot) => {
      this.setSkill(slot, skill);
    });
  }

  /**
   * Met à jour le cooldown d'un slot
   */
  setCooldown(slot: SkillSlot, remaining: number, total: number): void {
    const state = this.slotStates.get(slot);
    if (!state) return;

    state.cooldownRemaining = remaining;
    state.cooldownTotal = total;
    state.isOnCooldown = remaining > 0;
    this.updateSlotVisuals(slot);
  }

  /**
   * Met à jour l'état du mana pour un slot
   */
  setManaState(slot: SkillSlot, hasEnoughMana: boolean): void {
    const state = this.slotStates.get(slot);
    if (!state) return;

    state.hasEnoughMana = hasEnoughMana;
    this.updateSlotVisuals(slot);
  }

  /**
   * Met à jour l'état du mana pour tous les slots
   */
  updateManaStates(currentMana: number): void {
    this.slotStates.forEach((state, slot) => {
      if (state.skill) {
        state.hasEnoughMana = currentMana >= state.skill.manaCost;
      } else {
        state.hasEnoughMana = true;
      }
      this.updateSlotVisuals(slot);
    });
  }

  /**
   * Met à jour les visuels d'un slot
   */
  private updateSlotVisuals(slot: SkillSlot): void {
    const slotEl = this.slots.get(slot);
    const state = this.slotStates.get(slot);
    if (!slotEl || !state) return;

    const iconEl = slotEl.querySelector<HTMLElement>('.skill-icon')!;
    const cooldownOverlay = slotEl.querySelector<HTMLElement>('.skill-cooldown-overlay')!;
    const cooldownText = slotEl.querySelector<HTMLElement>('.skill-cooldown-text')!;
    const manaCostEl = slotEl.querySelector<HTMLElement>('.skill-mana-cost')!;
    const tooltipEl = slotEl.querySelector<HTMLElement>('.skill-tooltip')!;

    // Reset classes
    slotEl.classList.remove('empty', 'on-cooldown', 'no-mana');

    if (!state.skill) {
      slotEl.classList.add('empty');
      iconEl.style.backgroundColor = '';
      iconEl.textContent = '';
      cooldownOverlay.style.height = '0%';
      cooldownText.textContent = '';
      manaCostEl.textContent = '';
      tooltipEl.innerHTML = '';
      return;
    }

    // Icon (placeholder avec initiales)
    const initials = state.skill.name.substring(0, 2).toUpperCase();
    iconEl.textContent = initials;
    iconEl.style.backgroundColor = this.getElementColor(state.skill.element);

    // Mana cost
    manaCostEl.textContent = `${state.skill.manaCost}`;

    // Cooldown
    if (state.isOnCooldown) {
      slotEl.classList.add('on-cooldown');
      const percent = (state.cooldownRemaining / state.cooldownTotal) * 100;
      cooldownOverlay.style.height = `${percent}%`;
      cooldownText.textContent = state.cooldownRemaining.toFixed(1);
    } else {
      cooldownOverlay.style.height = '0%';
      cooldownText.textContent = '';
    }

    // Mana check
    if (!state.hasEnoughMana) {
      slotEl.classList.add('no-mana');
    }

    // Tooltip
    tooltipEl.innerHTML = `
      <div class="tooltip-title">${state.skill.name}</div>
      <div class="tooltip-desc">${state.skill.description ?? ''}</div>
      <div class="tooltip-stats">
        <span>Dégâts: ${state.skill.baseDamage}</span>
        <span>Mana: ${state.skill.manaCost}</span>
        <span>CD: ${state.skill.cooldown}s</span>
      </div>
    `;
  }

  private getElementColor(element: string): string {
    const colors: Record<string, string> = {
      NONE: '#888888',
      FIRE: '#ff4400',
      WATER: '#0088ff',
      EARTH: '#8b4513',
      AIR: '#88ffff',
      LIGHTNING: '#ffff00',
      ICE: '#00ffff',
      DARKNESS: '#440066',
      LIGHT: '#ffffaa',
    };
    return colors[element] ?? colors.NONE;
  }

  /**
   * Animation de pression de touche
   */
  triggerKeyPress(slot: SkillSlot): void {
    const slotEl = this.slots.get(slot);
    if (!slotEl) return;

    slotEl.classList.add('key-pressed');
    setTimeout(() => {
      slotEl.classList.remove('key-pressed');
    }, 100);
  }

  /**
   * Démarre l'animation des cooldowns
   */
  startCooldownAnimation(): void {
    if (this.animationFrame) return;

    const animate = () => {
      this.slotStates.forEach((state, slot) => {
        if (state.isOnCooldown) {
          this.updateSlotVisuals(slot);
        }
      });
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Arrête l'animation des cooldowns
   */
  stopCooldownAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
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
    this.stopCooldownAnimation();
    this.element.remove();
    this.slots.clear();
    this.slotStates.clear();
  }
}
