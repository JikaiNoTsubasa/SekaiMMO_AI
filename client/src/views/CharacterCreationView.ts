interface CharacterCreationOptions {
  onCreate: (name: string) => Promise<void>;
  onLogout: () => void;
}

export class CharacterCreationView {
  declare private container: HTMLElement | null;

  constructor(private readonly options: CharacterCreationOptions) {
    this.container = null;
  }

  render(parent: HTMLElement) {
    parent.innerHTML = '';
    this.container = document.createElement('div');
    this.container.className = 'view character-view';
    this.container.innerHTML = `
      <div class="panel">
        <h1>Création de personnage</h1>
        <p>Choisissez un nom unique pour votre aventurier.</p>
        <form class="form" id="character-form">
          <label>Nom du personnage
            <input type="text" name="name" required minlength="3" maxlength="24" />
          </label>
          <button type="submit" class="primary">Entrer dans Sekai</button>
          <p class="error" role="alert"></p>
        </form>
        <button type="button" class="secondary" id="logout-btn">Se déconnecter</button>
      </div>
    `;

    parent.appendChild(this.container);

    const form = this.container.querySelector<HTMLFormElement>('#character-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit(form);
    });

    const logoutButton = this.container.querySelector<HTMLButtonElement>('#logout-btn');
    logoutButton?.addEventListener('click', () => this.options.onLogout());
  }

  private async handleSubmit(form: HTMLFormElement) {
    const errorElement = this.container?.querySelector('.error');
    if (errorElement) {
      errorElement.textContent = '';
    }

    const formData = new FormData(form);
    const name = String(formData.get('name'));

    try {
      await this.options.onCreate(name.trim());
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error instanceof Error ? error.message : 'Impossible de créer le personnage.';
      }
    }
  }
}
