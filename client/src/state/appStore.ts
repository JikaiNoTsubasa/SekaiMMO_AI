import type { ApiClient, AuthResponse, GameState } from '../api/client';

type View = 'loading' | 'login' | 'character-creation' | 'game';

export interface AppState {
  view: View;
  token: string | null;
  user: AuthResponse['user'] | null;
  gameState: GameState | null;
}

type Listener = (state: AppState) => void;

export class AppStore {
  declare private state: AppState;
  declare private readonly listeners: Set<Listener>;

  constructor(private readonly api: ApiClient) {
    this.listeners = new Set();
    this.state = {
      view: 'loading',
      token: null,
      user: null,
      gameState: null
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  async bootstrap() {
    const token = localStorage.getItem('sekai_token');

    if (!token) {
      this.setState({ view: 'login' });
      return;
    }

    this.api.setToken(token);

    try {
      const user = await this.api.getProfile();
      this.setState({ token, user });

      if (user.characterId) {
        await this.loadGameState();
        this.setState({ view: 'game' });
      } else {
        this.setState({ view: 'character-creation' });
      }
    } catch (error) {
      console.error(error);
      this.logout();
    }
  }

  async login(email: string, password: string) {
    const result = await this.api.login(email, password);
    this.api.setToken(result.token);
    localStorage.setItem('sekai_token', result.token);

    this.setState({ token: result.token, user: result.user });

    if (result.user.characterId) {
      await this.loadGameState();
      this.setState({ view: 'game' });
    } else {
      this.setState({ view: 'character-creation' });
    }
  }

  async register(email: string, password: string) {
    const result = await this.api.register(email, password);
    this.api.setToken(result.token);
    localStorage.setItem('sekai_token', result.token);

    this.setState({ token: result.token, user: result.user });

    if (result.user.characterId) {
      await this.loadGameState();
      this.setState({ view: 'game' });
    } else {
      this.setState({ view: 'character-creation' });
    }
  }

  async createCharacter(name: string) {
    const character = await this.api.createCharacter(name);
    const user = this.state.user;

    if (!user) {
      return;
    }

    this.setState({
      user: { ...user, characterId: character.id }
    });

    await this.loadGameState();
    this.setState({ view: 'game' });
  }

  async loadGameState() {
    const gameState = await this.api.getGameState();
    this.setState({ gameState });
  }

  async refreshSkills() {
    const current = this.state.gameState;
    if (!current) {
      return;
    }

    const skills = await this.api.listSkills();
    this.setState({
      gameState: {
        ...current,
        skills
      }
    });
  }

  async assignSkill(skillId: number, slot: string) {
    const character = await this.api.assignSkill(skillId, slot);

    const current = this.state.gameState;

    if (!current) {
      return;
    }

    this.setState({
      gameState: {
        ...current,
        character
      }
    });
  }

  async unlockSkill(skillId: number) {
    await this.api.unlockSkill(skillId);
    await this.refreshSkills();
  }

  logout() {
    this.api.clearToken();
    localStorage.removeItem('sekai_token');
    this.setState({
      token: null,
      user: null,
      gameState: null,
      view: 'login'
    });
  }

  get snapshot() {
    return this.state;
  }
}
