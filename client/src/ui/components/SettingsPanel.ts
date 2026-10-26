// Settings Panel - Paramètres et keybindings
// SekaiMMO v2.0

import type { SkillSlot } from '../../game/types';

export interface KeyBindings {
  skills: Record<SkillSlot, string>;
  move: string;
  stop: string;
  inventory: string;
  skills_menu: string;
  chat: string;
  escape: string;
}

export interface GameSettings {
  quickCast: boolean;
  quickCastWithIndicator: boolean;
  showDamageNumbers: boolean;
  showHealthBars: boolean;
  musicVolume: number;
  sfxVolume: number;
  cameraZoom: number;
}

export interface SettingsPanelConfig {
  container: HTMLElement;
  onKeybindChange?: (action: string, key: string) => void;
  onSettingChange?: (setting: string, value: unknown) => void;
  onSave?: (bindings: KeyBindings, settings: GameSettings) => void;
  onReset?: () => void;
}

type TabType = 'keybindings' | 'gameplay' | 'audio';

export class SettingsPanel {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: SettingsPanelConfig;
  private isVisible: boolean = false;

  private currentTab: TabType = 'keybindings';
  private keyBindings: KeyBindings;
  private gameSettings: GameSettings;
  private listeningFor: string | null = null;

  constructor(config: SettingsPanelConfig) {
    this.config = config;
    this.container = config.container;

    // Default bindings
    this.keyBindings = {
      skills: {
        Q: 'Q', W: 'W', E: 'E', R: 'R', T: 'T',
        A: 'A', S: 'S', D: 'D', F: 'F',
      },
      move: 'RightClick',
      stop: 'Space',
      inventory: 'I',
      skills_menu: 'K',
      chat: 'Enter',
      escape: 'Escape',
    };

    // Default settings
    this.gameSettings = {
      quickCast: false,
      quickCastWithIndicator: true,
      showDamageNumbers: true,
      showHealthBars: true,
      musicVolume: 70,
      sfxVolume: 80,
      cameraZoom: 100,
    };

    this.element = this.createElement();
    this.container.appendChild(this.element);
    this.setupKeyListener();
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Paramètres</h2>
        <button class="panel-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="keybindings">Touches</button>
        <button class="settings-tab" data-tab="gameplay">Gameplay</button>
        <button class="settings-tab" data-tab="audio">Audio</button>
      </div>
      <div class="settings-content"></div>
      <div class="settings-footer">
        <button class="btn-reset">Réinitialiser</button>
        <button class="btn-save">Sauvegarder</button>
      </div>
    `;

    // Close button
    const closeBtn = panel.querySelector('.panel-close')!;
    closeBtn.addEventListener('click', () => this.hide());

    // Tab buttons
    const tabBtns = panel.querySelectorAll<HTMLButtonElement>('.settings-tab');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as TabType;
        this.switchTab(tab);
      });
    });

    // Footer buttons
    const resetBtn = panel.querySelector('.btn-reset')!;
    resetBtn.addEventListener('click', () => {
      if (confirm('Réinitialiser tous les paramètres?')) {
        this.config.onReset?.();
      }
    });

    const saveBtn = panel.querySelector('.btn-save')!;
    saveBtn.addEventListener('click', () => {
      this.config.onSave?.(this.keyBindings, this.gameSettings);
      this.hide();
    });

    return panel;
  }

  private setupKeyListener(): void {
    document.addEventListener('keydown', (e) => {
      if (!this.listeningFor) return;

      e.preventDefault();
      e.stopPropagation();

      const key = this.formatKeyName(e);
      this.setKeybind(this.listeningFor, key);
      this.listeningFor = null;
      this.renderTabContent();
    });
  }

  private formatKeyName(e: KeyboardEvent): string {
    if (e.key === ' ') return 'Space';
    if (e.key.length === 1) return e.key.toUpperCase();
    return e.key;
  }

  private switchTab(tab: TabType): void {
    this.currentTab = tab;
    this.listeningFor = null;

    const tabBtns = this.element.querySelectorAll('.settings-tab');
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    this.renderTabContent();
  }

  private renderTabContent(): void {
    const content = this.element.querySelector('.settings-content')!;

    switch (this.currentTab) {
      case 'keybindings':
        this.renderKeybindingsTab(content);
        break;
      case 'gameplay':
        this.renderGameplayTab(content);
        break;
      case 'audio':
        this.renderAudioTab(content);
        break;
    }
  }

  private renderKeybindingsTab(container: Element): void {
    const skillSlots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];

    container.innerHTML = `
      <div class="keybindings-section">
        <h3>Compétences</h3>
        <div class="keybind-grid">
          ${skillSlots.map((slot) => `
            <div class="keybind-row">
              <span class="keybind-label">Skill ${slot}</span>
              <button class="keybind-btn ${this.listeningFor === `skill_${slot}` ? 'listening' : ''}"
                      data-action="skill_${slot}">
                ${this.keyBindings.skills[slot]}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="keybindings-section">
        <h3>Actions</h3>
        <div class="keybind-grid">
          <div class="keybind-row">
            <span class="keybind-label">Arrêter</span>
            <button class="keybind-btn ${this.listeningFor === 'stop' ? 'listening' : ''}" data-action="stop">
              ${this.keyBindings.stop}
            </button>
          </div>
          <div class="keybind-row">
            <span class="keybind-label">Inventaire</span>
            <button class="keybind-btn ${this.listeningFor === 'inventory' ? 'listening' : ''}" data-action="inventory">
              ${this.keyBindings.inventory}
            </button>
          </div>
          <div class="keybind-row">
            <span class="keybind-label">Menu Skills</span>
            <button class="keybind-btn ${this.listeningFor === 'skills_menu' ? 'listening' : ''}" data-action="skills_menu">
              ${this.keyBindings.skills_menu}
            </button>
          </div>
          <div class="keybind-row">
            <span class="keybind-label">Chat</span>
            <button class="keybind-btn ${this.listeningFor === 'chat' ? 'listening' : ''}" data-action="chat">
              ${this.keyBindings.chat}
            </button>
          </div>
        </div>
      </div>
      <p class="keybind-hint">Cliquez sur une touche pour la modifier.</p>
    `;

    // Keybind buttons
    const keybindBtns = container.querySelectorAll<HTMLButtonElement>('.keybind-btn');
    keybindBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.listeningFor = btn.dataset.action ?? null;
        this.renderTabContent();
      });
    });
  }

  private renderGameplayTab(container: Element): void {
    container.innerHTML = `
      <div class="settings-section">
        <h3>Combat</h3>
        <div class="setting-row">
          <label>
            <input type="checkbox" class="setting-checkbox" data-setting="quickCast"
                   ${this.gameSettings.quickCast ? 'checked' : ''}>
            Quick Cast
          </label>
          <span class="setting-desc">Lance les skills immédiatement sur pression de touche</span>
        </div>
        <div class="setting-row">
          <label>
            <input type="checkbox" class="setting-checkbox" data-setting="quickCastWithIndicator"
                   ${this.gameSettings.quickCastWithIndicator ? 'checked' : ''}>
            Quick Cast avec indicateur
          </label>
          <span class="setting-desc">Affiche le telegraph en maintenant la touche</span>
        </div>
        <div class="setting-row">
          <label>
            <input type="checkbox" class="setting-checkbox" data-setting="showDamageNumbers"
                   ${this.gameSettings.showDamageNumbers ? 'checked' : ''}>
            Afficher les dégâts
          </label>
        </div>
        <div class="setting-row">
          <label>
            <input type="checkbox" class="setting-checkbox" data-setting="showHealthBars"
                   ${this.gameSettings.showHealthBars ? 'checked' : ''}>
            Afficher les barres de vie
          </label>
        </div>
      </div>
      <div class="settings-section">
        <h3>Caméra</h3>
        <div class="setting-row">
          <label>Zoom: ${this.gameSettings.cameraZoom}%</label>
          <input type="range" class="setting-slider" data-setting="cameraZoom"
                 min="50" max="150" value="${this.gameSettings.cameraZoom}">
        </div>
      </div>
    `;

    // Checkboxes
    const checkboxes = container.querySelectorAll<HTMLInputElement>('.setting-checkbox');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const setting = checkbox.dataset.setting as keyof GameSettings;
        (this.gameSettings as unknown as Record<string, unknown>)[setting] = checkbox.checked;
        this.config.onSettingChange?.(setting, checkbox.checked);
      });
    });

    // Sliders
    const sliders = container.querySelectorAll<HTMLInputElement>('.setting-slider');
    sliders.forEach((slider) => {
      slider.addEventListener('input', () => {
        const setting = slider.dataset.setting as keyof GameSettings;
        const value = parseInt(slider.value, 10);
        (this.gameSettings as unknown as Record<string, unknown>)[setting] = value;
        this.config.onSettingChange?.(setting, value);
        this.renderTabContent();
      });
    });
  }

  private renderAudioTab(container: Element): void {
    container.innerHTML = `
      <div class="settings-section">
        <h3>Volume</h3>
        <div class="setting-row">
          <label>Musique: ${this.gameSettings.musicVolume}%</label>
          <input type="range" class="setting-slider" data-setting="musicVolume"
                 min="0" max="100" value="${this.gameSettings.musicVolume}">
        </div>
        <div class="setting-row">
          <label>Effets sonores: ${this.gameSettings.sfxVolume}%</label>
          <input type="range" class="setting-slider" data-setting="sfxVolume"
                 min="0" max="100" value="${this.gameSettings.sfxVolume}">
        </div>
      </div>
    `;

    // Sliders
    const sliders = container.querySelectorAll<HTMLInputElement>('.setting-slider');
    sliders.forEach((slider) => {
      slider.addEventListener('input', () => {
        const setting = slider.dataset.setting as keyof GameSettings;
        const value = parseInt(slider.value, 10);
        (this.gameSettings as unknown as Record<string, unknown>)[setting] = value;
        this.config.onSettingChange?.(setting, value);
        this.renderTabContent();
      });
    });
  }

  private setKeybind(action: string, key: string): void {
    if (action.startsWith('skill_')) {
      const slot = action.replace('skill_', '') as SkillSlot;
      this.keyBindings.skills[slot] = key;
    } else {
      (this.keyBindings as unknown as Record<string, string>)[action] = key;
    }
    this.config.onKeybindChange?.(action, key);
  }

  /**
   * Met à jour les keybindings
   */
  setKeyBindings(bindings: KeyBindings): void {
    this.keyBindings = bindings;
    if (this.currentTab === 'keybindings') {
      this.renderTabContent();
    }
  }

  /**
   * Met à jour les settings
   */
  setGameSettings(settings: GameSettings): void {
    this.gameSettings = settings;
    this.renderTabContent();
  }

  /**
   * Récupère les keybindings actuels
   */
  getKeyBindings(): KeyBindings {
    return { ...this.keyBindings };
  }

  /**
   * Récupère les settings actuels
   */
  getGameSettings(): GameSettings {
    return { ...this.gameSettings };
  }

  /**
   * Affiche le panneau
   */
  show(): void {
    this.isVisible = true;
    this.element.classList.add('visible');
    this.renderTabContent();
  }

  /**
   * Cache le panneau
   */
  hide(): void {
    this.isVisible = false;
    this.element.classList.remove('visible');
    this.listeningFor = null;
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
