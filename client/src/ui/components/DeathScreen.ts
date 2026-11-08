// Death Screen - Message de mort, sans fermeture possible : seule la réapparition le retire
// SekaiMMO v2.0

export interface DeathScreenConfig {
  container: HTMLElement;
  onRespawn: () => void;
}

export class DeathScreen {
  private element: HTMLElement;
  private isVisible: boolean = false;

  constructor(config: DeathScreenConfig) {
    this.element = document.createElement('div');
    this.element.className = 'death-screen';
    this.element.innerHTML = `
      <div class="death-box">
        <h2 class="death-title">Vous êtes mort</h2>
        <p class="death-text">Votre personnage est tombé au combat.</p>
        <button class="btn-respawn">Réapparaître</button>
      </div>
    `;

    this.element.querySelector('.btn-respawn')!.addEventListener('click', () => config.onRespawn());
    config.container.appendChild(this.element);
  }

  /**
   * Affiche ou retire le message
   */
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.classList.toggle('visible', visible);
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Détruit le composant
   */
  destroy(): void {
    this.element.remove();
  }
}
