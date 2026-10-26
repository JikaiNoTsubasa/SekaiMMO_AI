// Skills Menu - Menu des compétences par catégorie
// SekaiMMO v2.0

import type { SkillSlot, SkillData, WeaponCode, MagicElement } from '../../game/types';

export interface SkillEntry {
  skill: SkillData;
  isUnlocked: boolean;
  assignedSlot: SkillSlot | null;
  currentLevel: number;
  requiredRank: string;
  canUnlock: boolean;
  unlockCost: number;
}

export interface WeaponProgress {
  code: WeaponCode;
  name: string;
  currentXP: number;
  rank: string;
  nextRankXP: number;
}

export interface ElementProgress {
  code: MagicElement;
  name: string;
  currentXP: number;
  rank: string;
  nextRankXP: number;
}

export interface SkillsMenuConfig {
  container: HTMLElement;
  onUnlockSkill?: (skillId: number) => void;
  onAssignSkill?: (skillId: number, slot: SkillSlot) => void;
  onUnassignSkill?: (slot: SkillSlot) => void;
}

type TabType = 'weapons' | 'elements' | 'assigned';

export class SkillsMenu {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: SkillsMenuConfig;
  private isVisible: boolean = false;

  private currentTab: TabType = 'weapons';
  private selectedWeapon: WeaponCode | null = null;
  private selectedElement: MagicElement | null = null;

  private weaponSkills: Map<WeaponCode, SkillEntry[]> = new Map();
  private elementSkills: Map<MagicElement, SkillEntry[]> = new Map();
  private weaponProgress: Map<WeaponCode, WeaponProgress> = new Map();
  private elementProgress: Map<MagicElement, ElementProgress> = new Map();
  private assignedSkills: Map<SkillSlot, SkillData | null> = new Map();

  constructor(config: SkillsMenuConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.container.appendChild(this.element);
    this.initializeAssignedSlots();
  }

  private createElement(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'skills-menu';
    menu.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Compétences</h2>
        <button class="panel-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="skills-tabs">
        <button class="tab-btn active" data-tab="weapons">Armes</button>
        <button class="tab-btn" data-tab="elements">Éléments</button>
        <button class="tab-btn" data-tab="assigned">Assignées</button>
      </div>
      <div class="skills-content">
        <div class="skills-sidebar"></div>
        <div class="skills-list"></div>
      </div>
    `;

    // Close button
    const closeBtn = menu.querySelector('.panel-close')!;
    closeBtn.addEventListener('click', () => this.hide());

    // Tab buttons
    const tabBtns = menu.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as TabType;
        this.switchTab(tab);
      });
    });

    return menu;
  }

  private initializeAssignedSlots(): void {
    const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
    slots.forEach((slot) => {
      this.assignedSkills.set(slot, null);
    });
  }

  private switchTab(tab: TabType): void {
    this.currentTab = tab;

    // Update tab buttons
    const tabBtns = this.element.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    // Clear selections
    this.selectedWeapon = null;
    this.selectedElement = null;

    // Render content
    this.renderContent();
  }

  private renderContent(): void {
    switch (this.currentTab) {
      case 'weapons':
        this.renderWeaponsTab();
        break;
      case 'elements':
        this.renderElementsTab();
        break;
      case 'assigned':
        this.renderAssignedTab();
        break;
    }
  }

  private renderWeaponsTab(): void {
    const sidebar = this.element.querySelector('.skills-sidebar')!;
    const list = this.element.querySelector('.skills-list')!;

    // Render weapon categories
    sidebar.innerHTML = '';
    const weapons: WeaponCode[] = ['SWORD', 'DUAL_DAGGERS', 'BOW', 'TWO_HANDED_AXE', 'WAND', 'SCEPTER'];
    const weaponNames: Record<WeaponCode, string> = {
      SWORD: 'Épée',
      DUAL_DAGGERS: 'Dagues',
      BOW: 'Arc',
      TWO_HANDED_AXE: 'Hache',
      WAND: 'Baguette',
      SCEPTER: 'Sceptre',
    };

    weapons.forEach((weapon) => {
      const progress = this.weaponProgress.get(weapon);
      const btn = document.createElement('button');
      btn.className = `sidebar-item ${this.selectedWeapon === weapon ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="item-name">${weaponNames[weapon]}</span>
        <span class="item-rank">${progress?.rank ?? 'E'}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectedWeapon = weapon;
        this.renderWeaponsTab();
      });
      sidebar.appendChild(btn);
    });

    // Render skills for selected weapon
    if (this.selectedWeapon) {
      this.renderSkillsList(list as HTMLElement, this.weaponSkills.get(this.selectedWeapon) ?? []);
    } else {
      list.innerHTML = '<div class="skills-placeholder">Sélectionnez une arme</div>';
    }
  }

  private renderElementsTab(): void {
    const sidebar = this.element.querySelector('.skills-sidebar')!;
    const list = this.element.querySelector('.skills-list')! as HTMLElement;

    // Render element categories
    sidebar.innerHTML = '';
    const elements: MagicElement[] = ['FIRE', 'WATER', 'EARTH', 'AIR', 'LIGHTNING', 'ICE', 'DARKNESS', 'LIGHT'];
    const elementNames: Record<MagicElement, string> = {
      NONE: 'Neutre',
      FIRE: 'Feu',
      WATER: 'Eau',
      EARTH: 'Terre',
      AIR: 'Air',
      LIGHTNING: 'Foudre',
      ICE: 'Glace',
      DARKNESS: 'Ténèbres',
      LIGHT: 'Lumière',
    };

    elements.forEach((element) => {
      const progress = this.elementProgress.get(element);
      const btn = document.createElement('button');
      btn.className = `sidebar-item ${this.selectedElement === element ? 'active' : ''} element-${element.toLowerCase()}`;
      btn.innerHTML = `
        <span class="item-name">${elementNames[element]}</span>
        <span class="item-rank">${progress?.rank ?? 'E'}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectedElement = element;
        this.renderElementsTab();
      });
      sidebar.appendChild(btn);
    });

    // Render skills for selected element
    if (this.selectedElement) {
      this.renderSkillsList(list as HTMLElement, this.elementSkills.get(this.selectedElement) ?? []);
    } else {
      list.innerHTML = '<div class="skills-placeholder">Sélectionnez un élément</div>';
    }
  }

  private renderAssignedTab(): void {
    const sidebar = this.element.querySelector('.skills-sidebar')!;
    const list = this.element.querySelector('.skills-list')!;

    sidebar.innerHTML = '<div class="sidebar-info">Compétences assignées à votre barre</div>';

    list.innerHTML = '';
    const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];

    slots.forEach((slot) => {
      const skill = this.assignedSkills.get(slot);
      const slotEl = document.createElement('div');
      slotEl.className = `assigned-slot ${skill ? 'has-skill' : 'empty'}`;
      slotEl.innerHTML = `
        <div class="slot-key">${slot}</div>
        <div class="slot-content">
          ${skill ? `
            <div class="skill-name">${skill.name}</div>
            <div class="skill-info">${skill.damageType} · ${skill.element}</div>
          ` : '<div class="empty-text">Vide</div>'}
        </div>
        ${skill ? '<button class="btn-unassign">Retirer</button>' : ''}
      `;

      if (skill) {
        const unassignBtn = slotEl.querySelector('.btn-unassign')!;
        unassignBtn.addEventListener('click', () => {
          this.config.onUnassignSkill?.(slot);
        });
      }

      list.appendChild(slotEl);
    });
  }

  private renderSkillsList(container: HTMLElement, skills: SkillEntry[]): void {
    container.innerHTML = '';

    if (skills.length === 0) {
      container.innerHTML = '<div class="skills-placeholder">Aucune compétence disponible</div>';
      return;
    }

    skills.forEach((entry) => {
      const skillEl = document.createElement('div');
      skillEl.className = `skill-entry ${entry.isUnlocked ? 'unlocked' : 'locked'}`;
      skillEl.innerHTML = `
        <div class="skill-header">
          <span class="skill-name">${entry.skill.name}</span>
          <span class="skill-rank">Rang ${entry.requiredRank}</span>
        </div>
        <div class="skill-desc">${entry.skill.description ?? ''}</div>
        <div class="skill-stats">
          <span>Dégâts: ${entry.skill.baseDamage}</span>
          <span>Mana: ${entry.skill.manaCost}</span>
          <span>CD: ${entry.skill.cooldown}s</span>
          <span>Portée: ${entry.skill.range}</span>
        </div>
        <div class="skill-actions">
          ${!entry.isUnlocked ? `
            <button class="btn-unlock ${entry.canUnlock ? '' : 'disabled'}" ${entry.canUnlock ? '' : 'disabled'}>
              Débloquer (${entry.unlockCost} XP)
            </button>
          ` : `
            <button class="btn-assign">Assigner</button>
            ${entry.assignedSlot ? `<span class="assigned-info">Touche: ${entry.assignedSlot}</span>` : ''}
          `}
        </div>
      `;

      // Event listeners
      if (!entry.isUnlocked && entry.canUnlock) {
        const unlockBtn = skillEl.querySelector('.btn-unlock')!;
        unlockBtn.addEventListener('click', () => {
          this.config.onUnlockSkill?.(entry.skill.id);
        });
      }

      if (entry.isUnlocked) {
        const assignBtn = skillEl.querySelector('.btn-assign')!;
        assignBtn.addEventListener('click', () => {
          this.showSlotSelector(entry.skill.id);
        });
      }

      container.appendChild(skillEl);
    });
  }

  private showSlotSelector(skillId: number): void {
    const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
    const slotStr = prompt(`Assigner à quel slot? (${slots.join(', ')})`);

    if (slotStr && slots.includes(slotStr.toUpperCase() as SkillSlot)) {
      this.config.onAssignSkill?.(skillId, slotStr.toUpperCase() as SkillSlot);
    }
  }

  /**
   * Met à jour les skills par arme
   */
  setWeaponSkills(weapon: WeaponCode, skills: SkillEntry[]): void {
    this.weaponSkills.set(weapon, skills);
    if (this.currentTab === 'weapons' && this.selectedWeapon === weapon) {
      this.renderContent();
    }
  }

  /**
   * Met à jour les skills par élément
   */
  setElementSkills(element: MagicElement, skills: SkillEntry[]): void {
    this.elementSkills.set(element, skills);
    if (this.currentTab === 'elements' && this.selectedElement === element) {
      this.renderContent();
    }
  }

  /**
   * Met à jour la progression d'arme
   */
  setWeaponProgress(progress: WeaponProgress[]): void {
    progress.forEach((p) => {
      this.weaponProgress.set(p.code, p);
    });
    if (this.currentTab === 'weapons') {
      this.renderContent();
    }
  }

  /**
   * Met à jour la progression d'élément
   */
  setElementProgress(progress: ElementProgress[]): void {
    progress.forEach((p) => {
      this.elementProgress.set(p.code, p);
    });
    if (this.currentTab === 'elements') {
      this.renderContent();
    }
  }

  /**
   * Met à jour les skills assignés
   */
  setAssignedSkills(skills: Map<SkillSlot, SkillData | null>): void {
    this.assignedSkills = skills;
    if (this.currentTab === 'assigned') {
      this.renderContent();
    }
  }

  /**
   * Affiche le menu
   */
  show(): void {
    this.isVisible = true;
    this.element.classList.add('visible');
    this.renderContent();
  }

  /**
   * Cache le menu
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
  }
}
