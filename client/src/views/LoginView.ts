interface LoginViewOptions {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

export class LoginView {
  declare private mode: 'login' | 'register';
  declare private container: HTMLElement | null;

  constructor(private readonly options: LoginViewOptions) {
    this.mode = 'login';
    this.container = null;
  }

  render(parent: HTMLElement) {
    parent.innerHTML = '';
    this.container = document.createElement('div');
    this.container.className = 'view login-view';
    this.container.innerHTML = `
      <div class="panel">
        <h1>SekaiMMO</h1>
        <p class="subtitle">Connectez-vous pour entrer dans le monde.</p>
        <form class="form" id="auth-form">
          <label>Email
            <input type="email" name="email" required />
          </label>
          <label>Mot de passe
            <input type="password" name="password" required minlength="6" />
          </label>
          <button type="submit" class="primary"></button>
          <p class="switch"></p>
          <p class="error" role="alert"></p>
        </form>
      </div>
    `;

    parent.appendChild(this.container);

    this.refreshTexts();

    const form = this.container.querySelector<HTMLFormElement>('#auth-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit(form);
    });

    const switchElement = this.container.querySelector<HTMLParagraphElement>('.switch');
    switchElement?.addEventListener('click', () => {
      this.mode = this.mode === 'login' ? 'register' : 'login';
      this.refreshTexts();
    });
  }

  private refreshTexts() {
    if (!this.container) {
      return;
    }

    const button = this.container.querySelector('button.primary');
    const switchElement = this.container.querySelector('.switch');

    if (button) {
      button.textContent = this.mode === 'login' ? 'Connexion' : 'Créer un compte';
    }

    if (switchElement) {
      switchElement.textContent = this.mode === 'login'
        ? 'Pas encore de compte ? Créez-en un.'
        : 'Déjà un compte ? Connectez-vous.';
      switchElement.classList.add('link');
    }
  }

  private async handleSubmit(form: HTMLFormElement) {
    const errorElement = this.container?.querySelector('.error');
    if (errorElement) {
      errorElement.textContent = '';
    }

    const formData = new FormData(form);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));

    try {
      if (this.mode === 'login') {
        await this.options.onLogin(email, password);
      } else {
        await this.options.onRegister(email, password);
      }
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error instanceof Error ? error.message : 'Une erreur est survenue.';
      }
    }
  }
}
