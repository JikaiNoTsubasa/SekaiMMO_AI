import Phaser from 'phaser';
import { io, type Socket } from 'socket.io-client';

import type { ApiClient, GameState, SkillBinding } from '../api/client';
import { createSekaiGame } from '../game/createGame';
import type { AppStore } from '../state/appStore';
import { isValidSkillSlot, skillSlots } from '../utils/skillSlots';

export class GameView {
  declare private root: HTMLElement | null;
  declare private canvasHost: HTMLElement | null;
  declare private statsElement: HTMLElement | null;
  declare private skillsElement: HTMLElement | null;
  declare private inventoryElement: HTMLElement | null;
  declare private skillBarElement: HTMLElement | null;
  declare private notificationsElement: HTMLElement | null;
  declare private socket: Socket | null;
  declare private game: Phaser.Game | null;
  declare private currentState: GameState | null;

  constructor(private readonly api: ApiClient, private readonly store: AppStore) {
    this.root = null;
    this.canvasHost = null;
    this.statsElement = null;
    this.skillsElement = null;
    this.inventoryElement = null;
    this.skillBarElement = null;
    this.notificationsElement = null;
    this.socket = null;
    this.game = null;
    this.currentState = null;
  }

  mount(parent: HTMLElement, token: string, state: GameState) {
    this.currentState = state;

    if (!this.root) {
      this.root = document.createElement('div');
      this.root.className = 'view game-view';
      this.root.innerHTML = `
        <div class="game-layout">
          <div class="game-canvas" id="game-canvas"></div>
          <aside class="game-sidebar">
            <section class="panel" id="stats-panel"></section>
            <section class="panel" id="skills-panel">
              <h2>Compétences</h2>
              <ul class="skill-list"></ul>
            </section>
            <section class="panel" id="inventory-panel">
              <h2>Inventaire</h2>
              <ul class="inventory-list"></ul>
            </section>
            <button class="secondary" id="logout-btn">Se déconnecter</button>
          </aside>
        </div>
        <div class="skill-bar" id="skill-bar"></div>
        <div class="notifications" id="notifications"></div>
      `;

      parent.innerHTML = '';
      parent.appendChild(this.root);

      this.canvasHost = this.root.querySelector('#game-canvas');
      this.statsElement = this.root.querySelector('#stats-panel');
      this.skillsElement = this.root.querySelector('.skill-list');
      this.inventoryElement = this.root.querySelector('.inventory-list');
      this.skillBarElement = this.root.querySelector('#skill-bar');
      this.notificationsElement = this.root.querySelector('#notifications');

      const logoutButton = this.root.querySelector<HTMLButtonElement>('#logout-btn');
      logoutButton?.addEventListener('click', () => this.store.logout());
    }

    this.ensureSocket(token, state);
    this.renderUi(state);
  }

  update(state: GameState) {
    this.currentState = state;
    this.renderUi(state);
  }

  private ensureSocket(token: string, state: GameState) {
    if (this.socket) {
      return;
    }

    this.socket = io(this.api.baseUrl, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token }
    });

    this.socket.on('connect', () => {
      this.pushNotification('Connecté au serveur de jeu.');
    });

    this.socket.on('disconnect', () => {
      this.pushNotification('Connexion perdue. Reconnexion en cours...');
    });

    if (this.canvasHost) {
      this.game = createSekaiGame({
        container: this.canvasHost,
        socket: this.socket,
        characterId: state.character.id,
        position: {
          x: state.character.positionX,
          y: state.character.positionY
        },
        onReward: async (payload) => {
          const loot = payload.drops.length
            ? payload.drops.map((drop) => `${drop.quantity}x objet ${drop.itemId}`).join(', ')
            : 'aucun objet';
          this.pushNotification(`+${payload.experience} XP arme, butin: ${loot}`);
          await this.store.loadGameState();
        }
      });
    }
  }

  private renderUi(state: GameState) {
    if (!this.statsElement || !this.skillsElement || !this.inventoryElement || !this.skillBarElement) {
      return;
    }

    this.statsElement.innerHTML = `
      <h2>${state.character.name}</h2>
      <ul class="stats-list">
        <li>Vie: ${state.character.health}</li>
        <li>Mana: ${state.character.mana}</li>
        <li>Défense physique: ${state.character.physicalDefense}</li>
        <li>Défense magique: ${state.character.magicalDefense}</li>
      </ul>
    `;

    this.renderSkills(state.skills);
    this.renderInventory(state);
    this.renderSkillBar(state.character.skillBindings);
  }

  private renderSkills(skills: SkillBinding[]) {
    if (!this.skillsElement) {
      return;
    }

    this.skillsElement.innerHTML = '';

    skills.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'skill-item';
      item.innerHTML = `
        <div>
          <strong>${entry.skill.name}</strong>
          <small>${entry.skill.category === 'ACTIVE' ? 'Actif' : 'Passif'} · ${entry.skill.damageType.toLowerCase()}</small>
          <p>${entry.skill.description ?? ''}</p>
        </div>
        <div class="skill-actions"></div>
      `;

      const actions = item.querySelector('.skill-actions');
      if (actions) {
        if (!entry.characterSkill?.isUnlocked) {
          const unlockButton = document.createElement('button');
          unlockButton.className = 'primary';
          unlockButton.textContent = 'Débloquer';
          unlockButton.addEventListener('click', async () => {
            await this.store.unlockSkill(entry.skill.id);
          });
          actions.appendChild(unlockButton);
        } else {
          const assignButton = document.createElement('button');
          assignButton.className = 'secondary';
          assignButton.textContent = entry.characterSkill.assignedKey
            ? `Assigné (${entry.characterSkill.assignedKey})`
            : 'Assigner';
          assignButton.addEventListener('click', () => this.selectSlot(entry.skill.id));
          actions.appendChild(assignButton);
        }
      }

      this.skillsElement?.appendChild(item);
    });
  }

  private renderInventory(state: GameState) {
    if (!this.inventoryElement) {
      return;
    }

    this.inventoryElement.innerHTML = '';

    if (!state.inventory.length) {
      const empty = document.createElement('li');
      empty.textContent = 'Inventaire vide';
      this.inventoryElement.appendChild(empty);
      return;
    }

    state.inventory.forEach((entry) => {
      const item = document.createElement('li');
      item.innerHTML = `<strong>${entry.item.name}</strong> · ${entry.quantity} · ${entry.item.rarity.toLowerCase()}`;
      this.inventoryElement?.appendChild(item);
    });
  }

  private renderSkillBar(bindings: Record<string, number>) {
    if (!this.skillBarElement || !this.currentState) {
      return;
    }

    this.skillBarElement.innerHTML = '';

    skillSlots.forEach((slot) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'skill-slot';
      const skillId = bindings[slot];
      const skillName = skillId
        ? this.currentState?.skills.find((entry) => entry.skill.id === skillId)?.skill.name ?? '???'
        : '';

      wrapper.innerHTML = `
        <span class="key">${slot}</span>
        <span class="label">${skillName}</span>
      `;

      this.skillBarElement?.appendChild(wrapper);
    });
  }

  private async selectSlot(skillId: number) {
    const slot = prompt(`Assigner la compétence au slot (${skillSlots.join(', ')}).`)?.toUpperCase();

    if (!slot || !isValidSkillSlot(slot)) {
      this.pushNotification('Slot invalide.');
      return;
    }

    await this.store.assignSkill(skillId, slot);
    await this.store.refreshSkills();
  }

  private pushNotification(message: string) {
    if (!this.notificationsElement) {
      return;
    }

    const item = document.createElement('div');
    item.className = 'notification';
    item.textContent = message;
    this.notificationsElement.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 4000);
  }

  destroy() {
    this.socket?.disconnect();
    this.socket = null;
    this.game?.destroy(true);
    this.game = null;
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.canvasHost = null;
    this.statsElement = null;
    this.skillsElement = null;
    this.inventoryElement = null;
    this.skillBarElement = null;
    this.notificationsElement = null;
    this.currentState = null;
  }
}
