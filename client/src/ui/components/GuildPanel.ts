// Guild Panel - Interface de guilde
// SekaiMMO v2.0

export type GuildRank = 'LEADER' | 'OFFICER' | 'MEMBER';

export interface GuildMember {
  characterId: number;
  name: string;
  rank: GuildRank;
  level: number;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface GuildData {
  id: number;
  name: string;
  tag: string;
  description?: string;
  level: number;
  memberCount: number;
  maxMembers: number;
  gold: number;
  createdAt: Date;
}

export interface GuildPanelConfig {
  container: HTMLElement;
  onLeaveGuild?: () => void;
  onPromoteMember?: (characterId: number) => void;
  onDemoteMember?: (characterId: number) => void;
  onKickMember?: (characterId: number) => void;
  onInviteMember?: (playerName: string) => void;
  onDepositGold?: (amount: number) => void;
  onCreateGuild?: (name: string, tag: string) => void;
}

type TabType = 'info' | 'members' | 'bank';

export class GuildPanel {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: GuildPanelConfig;
  private isVisible: boolean = false;

  private currentTab: TabType = 'info';
  private guildData: GuildData | null = null;
  private members: GuildMember[] = [];
  private currentUserRank: GuildRank = 'MEMBER';
  private currentUserId: number = 0;

  constructor(config: GuildPanelConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.container.appendChild(this.element);
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'guild-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Guilde</h2>
        <button class="panel-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="guild-content">
        <div class="no-guild-view">
          <p>Vous n'êtes pas dans une guilde.</p>
          <div class="create-guild-form">
            <h3>Créer une guilde</h3>
            <input type="text" class="guild-name-input" placeholder="Nom de la guilde" maxlength="32">
            <input type="text" class="guild-tag-input" placeholder="Tag (3-5 car.)" maxlength="5">
            <p class="create-cost">Coût: 1000 Or</p>
            <button class="btn-create-guild">Créer</button>
          </div>
        </div>
        <div class="guild-view" style="display: none;">
          <div class="guild-tabs">
            <button class="guild-tab active" data-tab="info">Infos</button>
            <button class="guild-tab" data-tab="members">Membres</button>
            <button class="guild-tab" data-tab="bank">Banque</button>
          </div>
          <div class="guild-tab-content"></div>
        </div>
      </div>
    `;

    // Close button
    const closeBtn = panel.querySelector('.panel-close')!;
    closeBtn.addEventListener('click', () => this.hide());

    // Create guild button
    const createBtn = panel.querySelector('.btn-create-guild')!;
    createBtn.addEventListener('click', () => this.handleCreateGuild());

    // Tab buttons
    const tabBtns = panel.querySelectorAll<HTMLButtonElement>('.guild-tab');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as TabType;
        this.switchTab(tab);
      });
    });

    return panel;
  }

  private handleCreateGuild(): void {
    const nameInput = this.element.querySelector<HTMLInputElement>('.guild-name-input')!;
    const tagInput = this.element.querySelector<HTMLInputElement>('.guild-tag-input')!;

    const name = nameInput.value.trim();
    const tag = tagInput.value.trim().toUpperCase();

    if (!name || name.length < 3) {
      alert('Le nom doit contenir au moins 3 caractères.');
      return;
    }

    if (!tag || tag.length < 3 || tag.length > 5) {
      alert('Le tag doit contenir entre 3 et 5 caractères.');
      return;
    }

    this.config.onCreateGuild?.(name, tag);
  }

  private switchTab(tab: TabType): void {
    this.currentTab = tab;

    const tabBtns = this.element.querySelectorAll('.guild-tab');
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    this.renderTabContent();
  }

  private renderTabContent(): void {
    const content = this.element.querySelector('.guild-tab-content')!;

    switch (this.currentTab) {
      case 'info':
        this.renderInfoTab(content);
        break;
      case 'members':
        this.renderMembersTab(content);
        break;
      case 'bank':
        this.renderBankTab(content);
        break;
    }
  }

  private renderInfoTab(container: Element): void {
    if (!this.guildData) {
      container.innerHTML = '<p>Chargement...</p>';
      return;
    }

    container.innerHTML = `
      <div class="guild-info">
        <div class="guild-header-info">
          <h3 class="guild-name">[${this.guildData.tag}] ${this.guildData.name}</h3>
          <span class="guild-level">Niveau ${this.guildData.level}</span>
        </div>
        <p class="guild-desc">${this.guildData.description ?? 'Aucune description.'}</p>
        <div class="guild-stats">
          <div class="stat">
            <span class="stat-label">Membres</span>
            <span class="stat-value">${this.guildData.memberCount}/${this.guildData.maxMembers}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Trésorerie</span>
            <span class="stat-value gold">${this.guildData.gold.toLocaleString()} Or</span>
          </div>
          <div class="stat">
            <span class="stat-label">Créée le</span>
            <span class="stat-value">${this.guildData.createdAt.toLocaleDateString()}</span>
          </div>
        </div>
        <div class="guild-actions">
          <button class="btn-leave-guild">Quitter la guilde</button>
        </div>
      </div>
    `;

    const leaveBtn = container.querySelector('.btn-leave-guild')!;
    leaveBtn.addEventListener('click', () => {
      if (confirm('Êtes-vous sûr de vouloir quitter la guilde?')) {
        this.config.onLeaveGuild?.();
      }
    });
  }

  private renderMembersTab(container: Element): void {
    const isLeader = this.currentUserRank === 'LEADER';
    const isOfficer = this.currentUserRank === 'OFFICER' || isLeader;

    container.innerHTML = `
      <div class="guild-members">
        ${isOfficer ? `
          <div class="invite-section">
            <input type="text" class="invite-input" placeholder="Nom du joueur">
            <button class="btn-invite">Inviter</button>
          </div>
        ` : ''}
        <div class="members-list"></div>
      </div>
    `;

    if (isOfficer) {
      const inviteBtn = container.querySelector('.btn-invite')!;
      const inviteInput = container.querySelector<HTMLInputElement>('.invite-input')!;
      inviteBtn.addEventListener('click', () => {
        const name = inviteInput.value.trim();
        if (name) {
          this.config.onInviteMember?.(name);
          inviteInput.value = '';
        }
      });
    }

    const membersList = container.querySelector('.members-list')!;

    // Sort by rank then online status
    const sortedMembers = [...this.members].sort((a, b) => {
      const rankOrder: Record<GuildRank, number> = { LEADER: 0, OFFICER: 1, MEMBER: 2 };
      if (rankOrder[a.rank] !== rankOrder[b.rank]) {
        return rankOrder[a.rank] - rankOrder[b.rank];
      }
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    sortedMembers.forEach((member) => {
      const memberEl = document.createElement('div');
      memberEl.className = `member-item ${member.isOnline ? 'online' : 'offline'}`;

      const rankLabels: Record<GuildRank, string> = {
        LEADER: 'Chef',
        OFFICER: 'Officier',
        MEMBER: 'Membre',
      };

      let actions = '';
      if (isLeader && member.characterId !== this.currentUserId) {
        if (member.rank === 'MEMBER') {
          actions += '<button class="btn-promote" title="Promouvoir">↑</button>';
        }
        if (member.rank === 'OFFICER') {
          actions += '<button class="btn-demote" title="Rétrograder">↓</button>';
        }
        actions += '<button class="btn-kick" title="Exclure">✕</button>';
      } else if (isOfficer && member.rank === 'MEMBER' && member.characterId !== this.currentUserId) {
        actions += '<button class="btn-kick" title="Exclure">✕</button>';
      }

      memberEl.innerHTML = `
        <div class="member-status ${member.isOnline ? 'online' : 'offline'}"></div>
        <div class="member-info">
          <span class="member-name">${member.name}</span>
          <span class="member-rank rank-${member.rank.toLowerCase()}">${rankLabels[member.rank]}</span>
        </div>
        <div class="member-level">Nv. ${member.level}</div>
        <div class="member-actions">${actions}</div>
      `;

      // Action events
      if (actions) {
        const promoteBtn = memberEl.querySelector('.btn-promote');
        const demoteBtn = memberEl.querySelector('.btn-demote');
        const kickBtn = memberEl.querySelector('.btn-kick');

        promoteBtn?.addEventListener('click', () => {
          this.config.onPromoteMember?.(member.characterId);
        });

        demoteBtn?.addEventListener('click', () => {
          this.config.onDemoteMember?.(member.characterId);
        });

        kickBtn?.addEventListener('click', () => {
          if (confirm(`Exclure ${member.name} de la guilde?`)) {
            this.config.onKickMember?.(member.characterId);
          }
        });
      }

      membersList.appendChild(memberEl);
    });
  }

  private renderBankTab(container: Element): void {
    container.innerHTML = `
      <div class="guild-bank">
        <div class="bank-gold">
          <span>Trésorerie: </span>
          <span class="gold-amount">${this.guildData?.gold.toLocaleString() ?? 0} Or</span>
        </div>
        <div class="deposit-section">
          <input type="number" class="deposit-input" placeholder="Montant" min="1">
          <button class="btn-deposit">Déposer</button>
        </div>
        <p class="bank-note">Les retraits sont réservés au chef de guilde.</p>
      </div>
    `;

    const depositBtn = container.querySelector('.btn-deposit')!;
    const depositInput = container.querySelector<HTMLInputElement>('.deposit-input')!;

    depositBtn.addEventListener('click', () => {
      const amount = parseInt(depositInput.value, 10);
      if (amount > 0) {
        this.config.onDepositGold?.(amount);
        depositInput.value = '';
      }
    });
  }

  /**
   * Met à jour les données de guilde
   */
  setGuildData(data: GuildData | null): void {
    this.guildData = data;
    this.updateView();
  }

  /**
   * Met à jour la liste des membres
   */
  setMembers(members: GuildMember[]): void {
    this.members = members;
    if (this.currentTab === 'members') {
      this.renderTabContent();
    }
  }

  /**
   * Définit le rang et l'ID de l'utilisateur courant
   */
  setCurrentUser(characterId: number, rank: GuildRank): void {
    this.currentUserId = characterId;
    this.currentUserRank = rank;
  }

  private updateView(): void {
    const noGuildView = this.element.querySelector<HTMLElement>('.no-guild-view')!;
    const guildView = this.element.querySelector<HTMLElement>('.guild-view')!;

    if (this.guildData) {
      noGuildView.style.display = 'none';
      guildView.style.display = 'block';
      this.renderTabContent();
    } else {
      noGuildView.style.display = 'block';
      guildView.style.display = 'none';
    }
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
