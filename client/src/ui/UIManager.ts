// UI Manager - Coordination de tous les composants UI
// SekaiMMO v2.0

import type { SocketManager } from '../network/SocketManager';
import type { SkillSlot, SkillData } from '../game/types';
import { SkillBar } from './components/SkillBar';
import { InventoryPanel } from './components/InventoryPanel';
import { SkillsMenu } from './components/SkillsMenu';
import { ChatPanel } from './components/ChatPanel';
import { BankPanel } from './components/BankPanel';
import { GuildPanel } from './components/GuildPanel';
import { SettingsPanel } from './components/SettingsPanel';

export interface UIManagerConfig {
  container: HTMLElement;
  socketManager: SocketManager;
  onSkillCast?: (slot: SkillSlot, skillId: number) => void;
  onNotification?: (message: string) => void;
  onLogout?: () => void;
}

export class UIManager {
  private container: HTMLElement;
  private socketManager: SocketManager;
  private config: UIManagerConfig;

  // Éléments UI
  private uiContainer!: HTMLElement;
  private skillBar!: SkillBar;
  private chatPanel!: ChatPanel;
  private inventoryPanel: InventoryPanel | null = null;
  private skillsMenu: SkillsMenu | null = null;
  private bankPanel: BankPanel | null = null;
  private guildPanel: GuildPanel | null = null;
  private settingsPanel: SettingsPanel | null = null;
  private modalContainer!: HTMLElement;
  private notificationContainer!: HTMLElement;

  // État
  private skillBarData: Map<SkillSlot, SkillData | null> = new Map();
  private cooldowns: Map<SkillSlot, { startTime: number; duration: number }> = new Map();

  // Unsubscribe functions
  private unsubscribers: (() => void)[] = [];

  // Bound keyboard handler pour pouvoir le retirer
  private boundKeyDownHandler: (e: KeyboardEvent) => void;

  constructor(config: UIManagerConfig) {
    this.config = config;
    this.container = config.container;
    this.socketManager = config.socketManager;

    this.createUIStructure();
    this.initializeComponents();
    this.setupSocketListeners();
    this.startCooldownLoop();

    // Attacher le listener clavier global
    this.boundKeyDownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    document.addEventListener('keydown', this.boundKeyDownHandler);

    // Charger la barre de skills initiale
    this.socketManager.getSkillBar();
  }

  private createUIStructure(): void {
    this.uiContainer = document.createElement('div');
    this.uiContainer.className = 'game-ui';
    this.uiContainer.innerHTML = `
      <div class="ui-top-bar">
        <div class="character-status">
          <div class="status-bar health-bar">
            <div class="bar-fill"></div>
            <span class="bar-text"></span>
          </div>
          <div class="status-bar mana-bar">
            <div class="bar-fill"></div>
            <span class="bar-text"></span>
          </div>
        </div>
        <div class="ui-buttons">
          <button class="ui-btn" id="btn-inventory" title="Inventaire (I)">Inventaire</button>
          <button class="ui-btn" id="btn-skills" title="Compétences (K)">Skills</button>
          <button class="ui-btn" id="btn-guild" title="Guilde (G)">Guilde</button>
          <button class="ui-btn" id="btn-bank" title="Banque (B)">Banque</button>
          <button class="ui-btn" id="btn-settings" title="Paramètres (Échap)">Options</button>
          <button class="ui-btn ui-btn-logout" id="btn-logout" title="Déconnexion">Déconnexion</button>
        </div>
        <div class="gold-display">
          <span class="gold-icon">🪙</span>
          <span class="gold-amount">0</span>
        </div>
      </div>
      <div class="ui-bottom">
        <div class="chat-container"></div>
        <div class="skill-bar-container"></div>
      </div>
      <div class="modal-container"></div>
      <div class="notification-container"></div>
    `;

    this.container.appendChild(this.uiContainer);

    this.modalContainer = this.uiContainer.querySelector('.modal-container')!;
    this.notificationContainer = this.uiContainer.querySelector('.notification-container')!;

    // Setup button events
    this.setupButtonEvents();
  }

  private setupButtonEvents(): void {
    const inventoryBtn = this.uiContainer.querySelector('#btn-inventory')!;
    const skillsBtn = this.uiContainer.querySelector('#btn-skills')!;
    const guildBtn = this.uiContainer.querySelector('#btn-guild')!;
    const bankBtn = this.uiContainer.querySelector('#btn-bank')!;
    const settingsBtn = this.uiContainer.querySelector('#btn-settings')!;
    const logoutBtn = this.uiContainer.querySelector('#btn-logout')!;

    inventoryBtn.addEventListener('click', () => this.toggleInventory());
    skillsBtn.addEventListener('click', () => this.toggleSkillsMenu());
    guildBtn.addEventListener('click', () => this.toggleGuildPanel());
    bankBtn.addEventListener('click', () => this.toggleBankPanel());
    settingsBtn.addEventListener('click', () => this.toggleSettingsPanel());
    logoutBtn.addEventListener('click', () => this.handleLogout());
  }

  private handleLogout(): void {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      this.config.onLogout?.();
    }
  }

  private initializeComponents(): void {
    // Skill bar
    const skillBarContainer = this.uiContainer.querySelector('.skill-bar-container')!;
    this.skillBar = new SkillBar({
      container: skillBarContainer as HTMLElement,
      onSkillClick: (slot) => {
        const skill = this.skillBarData.get(slot);
        if (skill) {
          this.config.onSkillCast?.(slot, skill.id);
        }
      },
    });

    // Chat panel
    const chatContainer = this.uiContainer.querySelector('.chat-container')!;
    this.chatPanel = new ChatPanel({
      container: chatContainer as HTMLElement,
      onSendMessage: (channel, content, targetName) => {
        this.socketManager.sendChatMessage(channel, content, targetName);
      },
    });
  }

  private setupSocketListeners(): void {
    // Skill bar data
    this.unsubscribers.push(
      this.socketManager.on('skills:bar', (data) => {
        this.updateSkillBar(data);
      })
    );

    // Inventory data
    this.unsubscribers.push(
      this.socketManager.on('inventory:data', (data) => {
        this.updateInventory(data);
      })
    );

    // All skills data
    this.unsubscribers.push(
      this.socketManager.on('skills:all', (data) => {
        this.updateSkillsMenu(data);
      })
    );

    // Chat messages
    this.unsubscribers.push(
      this.socketManager.on('chat:message', (data) => {
        this.chatPanel.addMessage({
          id: Date.now(),
          channel: data.channel,
          senderName: data.senderName,
          senderId: data.senderId,
          content: data.content,
          timestamp: new Date(data.timestamp),
          isSystem: data.isSystem,
        });
      })
    );

    // Rewards
    this.unsubscribers.push(
      this.socketManager.on('reward:gained', (data) => {
        if (data.gold > 0) {
          this.showNotification(`+${data.gold} Or`, 'success');
        }
        if (data.experience > 0) {
          this.showNotification(`+${data.experience} XP`, 'info');
        }
      })
    );
  }

  private updateInventory(data: { id: number; quantity: number; item: { id: number; name: string; description: string | null; type: string; rarity: string } }[]): void {
    if (!this.inventoryPanel) return;

    const items = data.map((entry) => ({
      item: {
        id: entry.item.id,
        name: entry.item.name,
        description: entry.item.description ?? undefined,
        type: entry.item.type,
        rarity: entry.item.rarity,
        stackable: entry.quantity > 1,
        maxStack: 99,
      },
      quantity: entry.quantity,
    }));

    this.inventoryPanel.setItems(items);
  }

  private updateSkillsMenu(data: { byWeapon: Record<string, any[]>; byElement: Record<string, any[]>; general: any[] }): void {
    if (!this.skillsMenu) return;

    // Mapping des noms d'arme vers les codes (le serveur renvoie les noms)
    const weaponNameToCode: Record<string, string> = {
      'Épée': 'SWORD',
      'Double Dagues': 'DUAL_DAGGERS',
      'Dagues': 'DUAL_DAGGERS',
      'Arc': 'BOW',
      'Hache à deux mains': 'TWO_HANDED_AXE',
      'Hache': 'TWO_HANDED_AXE',
      'Baguette': 'WAND',
      'Sceptre': 'SCEPTER',
    };

    // Mettre à jour les skills par arme
    for (const [weaponName, skills] of Object.entries(data.byWeapon)) {
      const weaponCode = weaponNameToCode[weaponName] ?? weaponName;
      const entries = skills.map((s) => ({
        skill: {
          id: s.id,
          name: s.name,
          description: s.description,
          baseDamage: s.baseDamage,
          damageScaling: s.damageScaling ?? 1.0,
          manaCost: s.manaCost,
          cooldown: s.cooldown,
          range: s.range,
          areaOfEffect: s.areaOfEffect,
          damageType: s.damageType,
          element: s.element ?? 'NONE',
          telegraphShape: s.telegraphShape,
          telegraphWidth: s.telegraphWidth,
          telegraphLength: s.telegraphLength,
        },
        isUnlocked: s.isUnlocked ?? false,
        assignedSlot: s.assignedKey as SkillSlot | null,
        currentLevel: 1,
        requiredRank: s.requiredRank ?? 'E',
        canUnlock: s.canLearn ?? true,
        unlockCost: s.goldCost ?? 0,
      }));
      this.skillsMenu.setWeaponSkills(weaponCode as any, entries);
    }

    // Mettre à jour les skills par élément
    for (const [elementCode, skills] of Object.entries(data.byElement)) {
      const entries = skills.map((s) => ({
        skill: {
          id: s.id,
          name: s.name,
          description: s.description,
          baseDamage: s.baseDamage,
          damageScaling: s.damageScaling ?? 1.0,
          manaCost: s.manaCost,
          cooldown: s.cooldown,
          range: s.range,
          areaOfEffect: s.areaOfEffect,
          damageType: s.damageType,
          element: s.element ?? elementCode,
          telegraphShape: s.telegraphShape,
          telegraphWidth: s.telegraphWidth,
          telegraphLength: s.telegraphLength,
        },
        isUnlocked: s.isUnlocked ?? false,
        assignedSlot: s.assignedKey as SkillSlot | null,
        currentLevel: 1,
        requiredRank: s.requiredRank ?? 'E',
        canUnlock: s.canLearn ?? true,
        unlockCost: s.goldCost ?? 0,
      }));
      this.skillsMenu.setElementSkills(elementCode as any, entries);
    }
  }

  private updateSkillBar(data: Record<string, unknown>): void {
    const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];

    slots.forEach((slot) => {
      const slotData = data[slot] as { skillId: number; skill: Record<string, unknown> } | null;
      if (slotData && slotData.skill) {
        const skillData: SkillData = {
          id: slotData.skillId,
          name: slotData.skill.name as string,
          description: slotData.skill.description as string | undefined,
          baseDamage: slotData.skill.baseDamage as number,
          damageScaling: slotData.skill.damageScaling as number ?? 1.0,
          manaCost: slotData.skill.manaCost as number,
          cooldown: slotData.skill.cooldown as number,
          range: slotData.skill.range as number,
          areaOfEffect: slotData.skill.areaOfEffect as number,
          damageType: slotData.skill.damageType as SkillData['damageType'],
          element: slotData.skill.element as SkillData['element'],
          telegraphShape: slotData.skill.telegraphShape as SkillData['telegraphShape'],
          telegraphWidth: slotData.skill.telegraphWidth as number | undefined,
          telegraphLength: slotData.skill.telegraphLength as number | undefined,
        };
        this.skillBarData.set(slot, skillData);
        this.skillBar.setSkill(slot, skillData);
      } else {
        this.skillBarData.set(slot, null);
        this.skillBar.setSkill(slot, null);
      }
    });
  }

  /**
   * Récupère le skill assigné à un slot
   */
  getSkillInSlot(slot: SkillSlot): SkillData | null {
    return this.skillBarData.get(slot) ?? null;
  }

  /**
   * Déclenche l'animation de pression de touche
   */
  triggerKeyPress(slot: SkillSlot): void {
    this.skillBar.triggerKeyPress?.(slot);
  }

  /**
   * Déclenche le cooldown d'un skill
   */
  triggerCooldown(slot: SkillSlot): void {
    const skill = this.skillBarData.get(slot);
    if (skill) {
      this.startCooldown(slot, skill.cooldown);
    }
  }

  /**
   * Démarre un cooldown pour un skill
   */
  startCooldown(slot: SkillSlot, duration: number): void {
    this.cooldowns.set(slot, {
      startTime: Date.now(),
      duration: duration * 1000,
    });
  }

  private startCooldownLoop(): void {
    const updateCooldowns = () => {
      const now = Date.now();
      this.cooldowns.forEach((cooldown, slot) => {
        const elapsed = now - cooldown.startTime;
        const remaining = Math.max(0, cooldown.duration - elapsed);
        const total = cooldown.duration / 1000;

        if (remaining > 0) {
          this.skillBar.setCooldown(slot, remaining / 1000, total);
        } else {
          this.skillBar.setCooldown(slot, 0, total);
          this.cooldowns.delete(slot);
        }
      });

      requestAnimationFrame(updateCooldowns);
    };

    requestAnimationFrame(updateCooldowns);
  }

  /**
   * Met à jour les barres de statut (alias pour compatibilité)
   */
  updateCharacterStatus(health: number, maxHealth: number, mana: number, maxMana: number, gold: number): void {
    this.updateStatusBars(health, maxHealth, mana, maxMana, gold);
  }

  /**
   * Met à jour les barres de statut
   */
  updateStatusBars(health: number, maxHealth: number, mana: number, maxMana: number, gold: number): void {
    // Health bar
    const healthBar = this.uiContainer.querySelector('.health-bar')!;
    const healthFill = healthBar.querySelector('.bar-fill') as HTMLElement;
    const healthText = healthBar.querySelector('.bar-text')!;
    const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    healthFill.style.width = `${healthPercent}%`;
    healthText.textContent = `${health} / ${maxHealth}`;

    // Mana bar
    const manaBar = this.uiContainer.querySelector('.mana-bar')!;
    const manaFill = manaBar.querySelector('.bar-fill') as HTMLElement;
    const manaText = manaBar.querySelector('.bar-text')!;
    const manaPercent = Math.max(0, Math.min(100, (mana / maxMana) * 100));
    manaFill.style.width = `${manaPercent}%`;
    manaText.textContent = `${mana} / ${maxMana}`;

    // Gold
    const goldAmount = this.uiContainer.querySelector('.gold-amount')!;
    goldAmount.textContent = gold.toLocaleString();

    // Update skill bar mana states
    this.skillBar.updateManaStates(mana);
  }

  // ============================================
  // PANELS / MODALS
  // ============================================

  toggleInventory(): void {
    if (!this.inventoryPanel) {
      this.inventoryPanel = new InventoryPanel({
        container: this.modalContainer,
        slots: 40,
        columns: 8,
        onItemClick: (_slotIndex, item) => {
          if (item && item.type === 'WEAPON') {
            this.socketManager.equipItem(item.id);
          }
        },
        onItemDrop: (fromSlot, toSlot) => {
          console.log('Item drag:', fromSlot, '->', toSlot);
        },
      });
      this.socketManager.getInventory();
    }
    this.closeOtherPanels('inventory');
    this.inventoryPanel.toggle();
  }

  toggleSkillsMenu(): void {
    if (!this.skillsMenu) {
      this.skillsMenu = new SkillsMenu({
        container: this.modalContainer,
        onUnlockSkill: (skillId) => {
          this.socketManager.learnSkill(skillId);
        },
        onAssignSkill: (skillId, slot) => {
          this.socketManager.assignSkill(skillId, slot);
        },
        onUnassignSkill: (slot) => {
          this.socketManager.unassignSkill(slot);
        },
      });
      this.socketManager.getAllSkills();
    }
    this.closeOtherPanels('skills');
    this.skillsMenu.toggle();
  }

  toggleGuildPanel(): void {
    if (!this.guildPanel) {
      this.guildPanel = new GuildPanel({
        container: this.modalContainer,
        onCreateGuild: (name, tag) => {
          this.socketManager.createGuild(name, tag, '');
        },
        onLeaveGuild: () => {
          this.socketManager.leaveGuild();
        },
        onInviteMember: (name) => {
          this.socketManager.inviteToGuild(name);
        },
        onKickMember: (characterId) => {
          this.socketManager.kickFromGuild(characterId);
        },
        onPromoteMember: (characterId) => {
          this.socketManager.setGuildRank(characterId, 'OFFICER');
        },
        onDemoteMember: (characterId) => {
          this.socketManager.setGuildRank(characterId, 'MEMBER');
        },
        onDepositGold: (amount) => {
          this.socketManager.depositGuildGold(amount);
        },
      });
      this.socketManager.getGuild();
    }
    this.closeOtherPanels('guild');
    this.guildPanel.toggle();
  }

  toggleBankPanel(): void {
    if (!this.bankPanel) {
      this.bankPanel = new BankPanel({
        container: this.modalContainer,
        bankSlots: 100,
        inventorySlots: 40,
        columns: 10,
        onDeposit: (slotIndex, quantity) => {
          this.socketManager.depositToBank(slotIndex, quantity);
        },
        onWithdraw: (slotIndex, quantity) => {
          this.socketManager.withdrawFromBank(slotIndex, quantity);
        },
      });
      this.socketManager.getBank();
      this.socketManager.getInventory();
    }
    this.closeOtherPanels('bank');
    this.bankPanel.toggle();
  }

  toggleSettingsPanel(): void {
    if (!this.settingsPanel) {
      this.settingsPanel = new SettingsPanel({
        container: this.modalContainer,
        onSave: (settings) => {
          localStorage.setItem('gameSettings', JSON.stringify(settings));
          this.showNotification('Paramètres sauvegardés');
        },
      });
    }
    this.closeOtherPanels('settings');
    this.settingsPanel.toggle();
  }

  private closeOtherPanels(except: string): void {
    if (except !== 'inventory') this.inventoryPanel?.hide();
    if (except !== 'skills') this.skillsMenu?.hide();
    if (except !== 'guild') this.guildPanel?.hide();
    if (except !== 'bank') this.bankPanel?.hide();
    if (except !== 'settings') this.settingsPanel?.hide();
  }

  /**
   * Affiche une notification
   */
  showNotification(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    this.notificationContainer.appendChild(notification);

    // Forcer un reflow pour que l'animation fonctionne
    notification.offsetHeight;
    notification.classList.add('show');

    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Gère les raccourcis clavier
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    // Ignorer si on est dans un champ de texte
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return false;
    }

    switch (event.key.toUpperCase()) {
      case 'I':
        this.toggleInventory();
        return true;
      case 'K':
        this.toggleSkillsMenu();
        return true;
      case 'G':
        this.toggleGuildPanel();
        return true;
      case 'B':
        this.toggleBankPanel();
        return true;
      case 'ESCAPE':
        this.closeAllModals();
        return true;
      case 'ENTER':
        this.chatPanel.focus();
        return true;
    }

    return false;
  }

  private closeAllModals(): void {
    this.inventoryPanel?.hide();
    this.skillsMenu?.hide();
    this.guildPanel?.hide();
    this.bankPanel?.hide();
    this.settingsPanel?.hide();
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    // Retirer le listener clavier
    document.removeEventListener('keydown', this.boundKeyDownHandler);

    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    this.skillBar.destroy();
    this.chatPanel.destroy();
    this.inventoryPanel?.destroy();
    this.skillsMenu?.destroy();
    this.guildPanel?.destroy();
    this.bankPanel?.destroy();
    this.settingsPanel?.destroy();

    this.uiContainer.remove();
  }
}
