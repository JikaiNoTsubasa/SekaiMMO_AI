type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    characterId: number | null;
  };
}

export interface CharacterSummary {
  id: number;
  name: string;
  health: number;
  mana: number;
  positionX: number;
  positionY: number;
  physicalDefense: number;
  magicalDefense: number;
}

export interface SkillBinding {
  skill: {
    id: number;
    name: string;
    description: string | null;
    category: 'ACTIVE' | 'PASSIVE';
    damageType: 'PURE' | 'PHYSICAL' | 'MAGICAL';
    baseDamage: number;
    cooldown: number;
    resourceCost: number;
  };
  characterSkill: null | {
    id: number;
    isUnlocked: boolean;
    assignedKey: string | null;
  };
}

export interface InventoryEntry {
  id: number;
  quantity: number;
  item: {
    id: number;
    name: string;
    description: string | null;
    type: string;
    rarity: string;
  };
}

export interface GameState {
  character: CharacterSummary & {
    skillBindings: Record<string, number>;
  };
  inventory: InventoryEntry[];
  skills: SkillBinding[];
}

export class ApiClient {
  declare private token: string | null;

  constructor(public readonly baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000') {
    this.token = null;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(path: string, options: RequestOptions = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if ((options.auth ?? true) && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message ?? 'Request failed');
    }

    return (await response.json()) as T;
  }

  login(email: string, password: string) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false
    });
  }

  register(email: string, password: string) {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password },
      auth: false
    });
  }

  getProfile() {
    return this.request<AuthResponse['user']>('/auth/me');
  }

  createCharacter(name: string) {
    return this.request<CharacterSummary>('/characters', {
      method: 'POST',
      body: { name }
    });
  }

  getCharacter() {
    return this.request<CharacterSummary>('/characters/me');
  }

  getGameState() {
    return this.request<GameState>('/game/state');
  }

  listSkills() {
    return this.request<SkillBinding[]>('/characters/skills');
  }

  assignSkill(skillId: number, slot: string) {
    return this.request<GameState['character']>('/characters/skills/assign', {
      method: 'POST',
      body: { skillId, slot }
    });
  }

  unlockSkill(skillId: number) {
    return this.request('/characters/skills/unlock', {
      method: 'POST',
      body: { skillId }
    });
  }
}
