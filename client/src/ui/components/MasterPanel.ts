// Master Panel - Achat de rangs et de compétences auprès d'un maître
// SekaiMMO v2.0

import type { MasterOffer } from '../../network/SocketManager';
import { formatSkillDamage } from '../../utils/skillDamage';

export interface MasterPanelConfig {
  container: HTMLElement;
  onBuyRank?: (npcId: number) => void;
  onBuySkill?: (npcId: number, skillId: number) => void;
}

export class MasterPanel {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: MasterPanelConfig;

  constructor(config: MasterPanelConfig) {
    this.config = config;
    this.container = config.container;
    this.element = this.createElement();
    this.container.appendChild(this.element);
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'master-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title"></h2>
        <button class="panel-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="master-content"></div>
    `;

    const closeBtn = panel.querySelector('.panel-close')!;
    closeBtn.addEventListener('click', () => this.hide());

    return panel;
  }

  /**
   * Affiche l'offre du maître
   */
  setOffer(offer: MasterOffer): void {
    this.element.querySelector('.panel-title')!.textContent = offer.title ? `${offer.name} - ${offer.title}` : offer.name;

    const content = this.element.querySelector('.master-content')!;
    content.innerHTML = '';
    content.appendChild(this.createSummary(offer));

    if (offer.skills.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'skills-placeholder';
      placeholder.textContent = "Ce maître n'enseigne aucune compétence pour le moment";
      content.appendChild(placeholder);
      return;
    }

    offer.skills.forEach((skill) => content.appendChild(this.createSkillEntry(offer, skill)));
  }

  private createSummary(offer: MasterOffer): HTMLElement {
    const summary = document.createElement('div');
    summary.className = 'master-summary';

    const canBuyRank = offer.nextRankCost !== null && offer.experience >= offer.nextRankCost;
    summary.innerHTML = `
      <div class="master-balance">
        <span>Solde ${offer.discipline} : <strong>${offer.experience} XP</strong></span>
        <span class="item-rank">Rang ${offer.rank}</span>
      </div>
      <div class="master-rank">
        ${offer.nextRank
          ? `<span>Rang ${offer.nextRank} : ${offer.nextRankCost} XP</span>
             <button class="btn-buy btn-buy-rank" ${canBuyRank ? '' : 'disabled'}>Acheter</button>`
          : '<span>Rang maximum atteint</span>'}
      </div>
    `;

    summary.querySelector('.btn-buy-rank')?.addEventListener('click', () => {
      this.config.onBuyRank?.(offer.npcId);
    });

    return summary;
  }

  private createSkillEntry(offer: MasterOffer, skill: MasterOffer['skills'][number]): HTMLElement {
    const isPassive = skill.category === 'PASSIVE';
    const entry = document.createElement('div');
    entry.className = `skill-entry${isPassive ? ' passive' : ''}`;
    entry.innerHTML = `
      <div class="skill-header">
        <span class="skill-name">${skill.name}${isPassive ? ' (Passif)' : ''}</span>
        <span class="skill-rank">Rang ${skill.requiredRank}</span>
      </div>
      <div class="skill-desc">${skill.description ?? ''}</div>
      <div class="skill-stats">
        ${isPassive ? `
          <span>Auto-attaques: +${formatSkillDamage(skill)} dégâts</span>
        ` : `
          <span>Dégâts: ${formatSkillDamage(skill)}</span>
          <span>Mana: ${skill.manaCost}</span>
          <span>CD: ${skill.cooldown}s</span>
          <span>Portée: ${skill.range}</span>
        `}
      </div>
      <div class="skill-actions">
        ${skill.isUnlocked ? `
          <span class="assigned-info">Déjà apprise</span>
        ` : `
          <button class="btn-buy btn-buy-skill" ${skill.canLearn ? '' : 'disabled'}>
            Apprendre (${skill.xpCost} XP)
          </button>
        `}
      </div>
      ${!skill.isUnlocked && skill.missingRequirements.length > 0
        ? `<div class="master-missing">${skill.missingRequirements.join(' · ')}</div>`
        : ''}
    `;

    entry.querySelector('.btn-buy-skill')?.addEventListener('click', () => {
      this.config.onBuySkill?.(offer.npcId, skill.id);
    });

    return entry;
  }

  /**
   * Affiche le panneau
   */
  show(): void {
    this.element.classList.add('visible');
  }

  /**
   * Cache le panneau
   */
  hide(): void {
    this.element.classList.remove('visible');
  }

  /**
   * Détruit le composant
   */
  destroy(): void {
    this.element.remove();
  }
}
