// Game View - Vue principale du jeu
// SekaiMMO v2.0

import Phaser from 'phaser';

import type { ApiClient, GameState } from '../api/client';
import { createSekaiGame } from '../game/createGame';
import type { AppStore } from '../state/appStore';
import { SocketManager } from '../network/SocketManager';
import { UIManager } from '../ui';
import type { SkillSlot } from '../game/types';

export class GameView {
  private root: HTMLElement | null = null;
  private canvasHost: HTMLElement | null = null;
  private uiHost: HTMLElement | null = null;
  private game: Phaser.Game | null = null;
  private socketManager: SocketManager | null = null;
  private uiManager: UIManager | null = null;
  private currentState: GameState | null = null;

  constructor(
    private readonly api: ApiClient,
    private readonly store: AppStore
  ) {}

  mount(parent: HTMLElement, token: string, state: GameState) {
    this.currentState = state;

    if (!this.root) {
      this.root = document.createElement('div');
      this.root.className = 'view game-view';
      this.root.innerHTML = `
        <div class="game-container">
          <div class="game-canvas" id="game-canvas"></div>
          <div class="game-ui-host" id="game-ui-host"></div>
        </div>
      `;

      parent.innerHTML = '';
      parent.appendChild(this.root);

      this.canvasHost = this.root.querySelector('#game-canvas');
      this.uiHost = this.root.querySelector('#game-ui-host');
    }

    this.ensureConnection(token, state);
  }

  update(state: GameState) {
    this.currentState = state;

    // Mettre à jour l'UI avec les nouvelles données
    if (this.uiManager) {
      this.uiManager.updateCharacterStatus(
        state.character.health,
        1000, // maxHealth - à récupérer du serveur
        state.character.mana,
        500, // maxMana - à récupérer du serveur
        0 // gold - à récupérer du serveur
      );
    }
  }

  private ensureConnection(token: string, state: GameState) {
    if (this.socketManager) {
      return;
    }

    // Créer le SocketManager
    this.socketManager = new SocketManager(this.api.baseUrl);
    this.socketManager.connect(token);

    // Créer l'UIManager
    if (this.uiHost) {
      this.uiManager = new UIManager({
        container: this.uiHost,
        socketManager: this.socketManager,
        onSkillCast: (slot, skillId) => {
          this.handleSkillCast(slot, skillId);
        },
        onNotification: (message) => {
          console.log('[Notification]', message);
        },
        onLogout: () => {
          this.store.logout();
        },
      });
    }

    // Créer le jeu Phaser
    if (this.canvasHost) {
      this.game = createSekaiGame({
        container: this.canvasHost,
        socket: this.socketManager.getSocket()!,
        characterId: state.character.id,
        position: {
          x: state.character.positionX,
          y: state.character.positionY,
        },
        onReward: async (_payload) => {
          // L'UIManager gère déjà les notifications via socket
          await this.store.loadGameState();
        },
        onSkillCast: (slot: SkillSlot) => {
          // Récupérer le skill et déclencher le cast
          const skill = this.uiManager?.getSkillInSlot(slot);
          if (skill) {
            this.handleSkillCast(slot, skill.id);
          }
        },
      });
    }

    // Configurer les listeners Socket pour le jeu
    this.setupGameListeners();
  }

  private setupGameListeners() {
    if (!this.socketManager) return;

    // Dégâts des monstres sur le joueur
    this.socketManager.on('monster:attack', (data) => {
      if (this.currentState && data.targetId === this.currentState.character.id) {
        // Le joueur est touché - mettre à jour la vie via l'UI
        this.uiManager?.showNotification(`-${data.damage} dégâts!`, 'error');
      }
    });

    // Changement de map
    this.socketManager.on('map:change', (data) => {
      this.uiManager?.showNotification(`Téléportation vers ${data.mapCode}`);
      // TODO: Recharger la scène Phaser avec la nouvelle map
    });

    // Erreur de map
    this.socketManager.on('map:changeFailed', (data) => {
      this.uiManager?.showNotification(`Impossible de changer de map: ${data.reason}`, 'error');
    });

    // Interaction NPC
    this.socketManager.on('npc:interact', (data) => {
      this.handleNPCInteraction(data);
    });
  }

  private handleSkillCast(slot: SkillSlot, _skillId: number) {
    if (!this.game || !this.socketManager || !this.uiManager) return;

    const skill = this.uiManager.getSkillInSlot(slot);
    if (!skill) return;

    // Déclencher l'animation de touche
    this.uiManager.triggerKeyPress(slot);

    // Déclencher le cooldown
    this.uiManager.triggerCooldown(slot);

    // Le cast effectif est géré par le InputManager dans MainScene
    // qui émet l'événement skill:cast via le socket
  }

  private handleNPCInteraction(npc: {
    npcId: number;
    name: string;
    title: string | null;
    isWeaponMaster: boolean;
    weaponMasterFor: string | null;
    isElementMaster: boolean;
    elementMasterFor: string | null;
    isMerchant: boolean;
    isBanker: boolean;
  }) {
    // Afficher l'interface appropriée selon le type de NPC
    if (npc.isBanker) {
      this.uiManager?.toggleBankPanel();
    } else if (npc.isWeaponMaster || npc.isElementMaster) {
      this.uiManager?.toggleSkillsMenu();
    } else if (npc.isMerchant) {
      this.uiManager?.showNotification(`${npc.name}: "Bienvenue, voyageur!"`);
      // TODO: Ouvrir le shop
    } else {
      this.uiManager?.showNotification(`${npc.name}: "${npc.title ?? 'Bonjour!'}"`);
    }
  }

  destroy() {
    // Détruire l'UIManager
    this.uiManager?.destroy();
    this.uiManager = null;

    // Déconnecter le socket
    this.socketManager?.disconnect();
    this.socketManager = null;

    // Détruire le jeu Phaser
    this.game?.destroy(true);
    this.game = null;

    // Nettoyer le DOM
    if (this.root) {
      this.root.remove();
      this.root = null;
    }

    this.canvasHost = null;
    this.uiHost = null;
    this.currentState = null;
  }
}
