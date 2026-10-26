// Socket Manager - Gestion centralisée des événements Socket.IO
// SekaiMMO v2.0

import { io, type Socket } from 'socket.io-client';

// Types pour les événements reçus du serveur
export interface MonsterData {
  spawnId: number;
  monsterId: number;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  positionX: number;
  positionY: number;
  element: string;
}

export interface PlayerData {
  character: {
    id: number;
    name: string;
    health: number;
    maxHealth: number;
    positionX: number;
    positionY: number;
  };
}

export interface SkillBarData {
  [key: string]: {
    skillId: number;
    skill: {
      id: number;
      name: string;
      manaCost: number;
      cooldown: number;
      range: number;
      areaOfEffect: number;
      telegraphShape: string | null;
      telegraphWidth: number | null;
      telegraphLength: number | null;
      damageType: string;
      element: string;
      baseDamage: number;
      damageScaling: number;
    };
  } | null;
}

export interface InventoryItem {
  id: number;
  quantity: number;
  item: {
    id: number;
    name: string;
    description: string | null;
    type: string;
    rarity: string;
    weaponCode: string | null;
  };
}

export interface BankData {
  contents: {
    id: number;
    item: {
      id: number;
      name: string;
      type: string;
      rarity: string;
    };
    quantity: number;
  }[];
  stats: {
    usedSlots: number;
    maxSlots: number;
    totalItems: number;
  };
}

export type GuildData = {
  guild: {
    id: number;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    gold: number;
    members: {
      id: number;
      rank: string;
      character: {
        id: number;
        name: string;
        level: number;
      };
    }[];
  };
  myRank: string;
} | null;

export interface ChatMessage {
  senderId: number;
  senderName: string;
  channel: 'local' | 'guild' | 'whisper';
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface CombatDamageEvent {
  targetId: number;
  targetType: 'monster' | 'player';
  damage: number;
  isCritical: boolean;
  damageType: string;
  element: string;
}

export interface MonsterAttackEvent {
  spawnId: number;
  targetId: number;
  damage: number;
  damageType: string;
  element: string;
}

export interface RewardEvent {
  experience: number;
  gold: number;
  drops: {
    itemId: number;
    itemName: string;
    quantity: number;
    rarity: string;
  }[];
}

export interface SkillsAllData {
  byWeapon: Record<string, any[]>;
  byElement: Record<string, any[]>;
  general: any[];
}

export interface CharacterStats {
  id: number;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  gold: number;
  physicalAttack: number;
  magicalAttack: number;
  physicalDefense: number;
  magicalDefense: number;
  physicalPenetration: number;
  magicalPenetration: number;
  critChance: number;
  critDamage: number;
  attackSpeed: number;
  movementSpeed: number;
  equippedWeaponCode: string | null;
}

// Event types pour le système d'événements interne
export type SocketEvents = {
  // Connexion
  'connected': void;
  'disconnected': void;

  // Monstres
  'monsters:initial': MonsterData[];
  'monster:spawn': MonsterData;
  'monster:healthUpdate': { spawnId: number; health: number; maxHealth: number };
  'monster:moved': { spawnId: number; positionX: number; positionY: number };
  'monster:defeated': { spawnId: number; monsterId: number; defeatedBy: number; experience: number; gold: number; drops: any[] };
  'monster:attack': MonsterAttackEvent;

  // Joueurs
  'player:joined': PlayerData;
  'player:left': { characterId: number };
  'player:moved': { characterId: number; position: { x: number; y: number } };
  'player:skillCast': { characterId: number; skillId: number; slot: string; targetX: number; targetY: number };
  'player:weaponChanged': { characterId: number; weaponCode: string };
  'player:reward': RewardEvent;

  // Combat
  'combat:damage': CombatDamageEvent;

  // Map
  'map:change': { mapCode: string; mapId: number; positionX: number; positionY: number };
  'map:changeFailed': { reason: string };

  // Inventaire
  'inventory:data': InventoryItem[];
  'inventory:equipped': { itemId: number; weaponCode: string };
  'inventory:dropped': { itemId: number; quantity: number };
  'inventory:error': { reason: string };

  // Armes
  'weapon:switched': { weaponCode: string };

  // Skills
  'skills:bar': SkillBarData;
  'skills:all': SkillsAllData;
  'skills:learned': { success: boolean; skill: { id: number; name: string }; goldSpent: number; message?: string };
  'skills:error': { reason: string };
  'skill:failed': { reason: string };

  // Guilde
  'guild:data': GuildData;
  'guild:created': { id: number; name: string; tag: string };
  'guild:left': { success: boolean };
  'guild:inviteSent': { targetName: string };
  'guild:invited': { guildId: number };
  'guild:kicked': void;
  'guild:kickSuccess': { targetId: number };
  'guild:error': { reason: string };

  // Banque
  'bank:data': BankData;
  'bank:error': { reason: string };

  // Chat
  'chat:message': ChatMessage;

  // NPC
  'npc:interact': {
    npcId: number;
    name: string;
    title: string | null;
    isWeaponMaster: boolean;
    weaponMasterFor: string | null;
    isElementMaster: boolean;
    elementMasterFor: string | null;
    isMerchant: boolean;
    isBanker: boolean;
  };

  // Personnage
  'character:stats': CharacterStats;
  'character:weaponProgress': any[];
  'character:elementProgress': any[];

  // Récompenses
  'reward:gained': RewardEvent;
};

type EventCallback<T> = (data: T) => void;

export class SocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();
  private connected = false;

  constructor(private readonly baseUrl: string) {}

  /**
   * Connecte au serveur avec le token d'authentification
   */
  connect(token: string): void {
    if (this.socket) {
      return;
    }

    this.socket = io(this.baseUrl, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token },
    });

    this.setupListeners();
  }

  /**
   * Configure les listeners Socket.IO
   */
  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connected = true;
      this.emit('connected', undefined);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected', undefined);
    });

    // Monstres
    this.socket.on('monsters:initial', (data) => this.emit('monsters:initial', data));
    this.socket.on('monster:spawn', (data) => this.emit('monster:spawn', data));
    this.socket.on('monster:healthUpdate', (data) => this.emit('monster:healthUpdate', data));
    this.socket.on('monster:moved', (data) => this.emit('monster:moved', data));
    this.socket.on('monster:defeated', (data) => this.emit('monster:defeated', data));
    this.socket.on('monster:attack', (data) => this.emit('monster:attack', data));

    // Joueurs
    this.socket.on('player:joined', (data) => this.emit('player:joined', data));
    this.socket.on('player:left', (data) => this.emit('player:left', data));
    this.socket.on('player:moved', (data) => this.emit('player:moved', data));
    this.socket.on('player:skillCast', (data) => this.emit('player:skillCast', data));
    this.socket.on('player:weaponChanged', (data) => this.emit('player:weaponChanged', data));
    this.socket.on('player:reward', (data) => this.emit('player:reward', data));

    // Combat
    this.socket.on('combat:damage', (data) => this.emit('combat:damage', data));

    // Map
    this.socket.on('map:change', (data) => this.emit('map:change', data));
    this.socket.on('map:changeFailed', (data) => this.emit('map:changeFailed', data));

    // Inventaire
    this.socket.on('inventory:data', (data) => this.emit('inventory:data', data));
    this.socket.on('inventory:equipped', (data) => this.emit('inventory:equipped', data));
    this.socket.on('inventory:dropped', (data) => this.emit('inventory:dropped', data));
    this.socket.on('inventory:error', (data) => this.emit('inventory:error', data));

    // Armes
    this.socket.on('weapon:switched', (data) => this.emit('weapon:switched', data));

    // Skills
    this.socket.on('skills:bar', (data) => this.emit('skills:bar', data));
    this.socket.on('skills:all', (data) => this.emit('skills:all', data));
    this.socket.on('skills:learned', (data) => this.emit('skills:learned', data));
    this.socket.on('skills:error', (data) => this.emit('skills:error', data));
    this.socket.on('skill:failed', (data) => this.emit('skill:failed', data));

    // Guilde
    this.socket.on('guild:data', (data) => this.emit('guild:data', data));
    this.socket.on('guild:created', (data) => this.emit('guild:created', data));
    this.socket.on('guild:left', (data) => this.emit('guild:left', data));
    this.socket.on('guild:inviteSent', (data) => this.emit('guild:inviteSent', data));
    this.socket.on('guild:invited', (data) => this.emit('guild:invited', data));
    this.socket.on('guild:kicked', () => this.emit('guild:kicked', undefined));
    this.socket.on('guild:kickSuccess', (data) => this.emit('guild:kickSuccess', data));
    this.socket.on('guild:error', (data) => this.emit('guild:error', data));

    // Banque
    this.socket.on('bank:data', (data) => this.emit('bank:data', data));
    this.socket.on('bank:error', (data) => this.emit('bank:error', data));

    // Chat
    this.socket.on('chat:message', (data) => this.emit('chat:message', data));

    // NPC
    this.socket.on('npc:interact', (data) => this.emit('npc:interact', data));

    // Personnage
    this.socket.on('character:stats', (data) => this.emit('character:stats', data));
    this.socket.on('character:weaponProgress', (data) => this.emit('character:weaponProgress', data));
    this.socket.on('character:elementProgress', (data) => this.emit('character:elementProgress', data));
  }

  /**
   * S'abonne à un événement
   */
  on<K extends keyof SocketEvents>(event: K, callback: EventCallback<SocketEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Retourne une fonction de désabonnement
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Émet un événement interne
   */
  private emit<K extends keyof SocketEvents>(event: K, data: SocketEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  // ============================================
  // MÉTHODES D'ENVOI
  // ============================================

  // Mouvement
  move(x: number, y: number): void {
    this.socket?.emit('player:move', { x, y });
  }

  // Skills
  castSkill(skillId: number, slot: string, targetX: number, targetY: number): void {
    this.socket?.emit('skill:cast', { skillId, slot, targetX, targetY });
  }

  getSkillBar(): void {
    this.socket?.emit('skills:getBar');
  }

  getAllSkills(): void {
    this.socket?.emit('skills:getAll');
  }

  learnSkill(skillId: number): void {
    this.socket?.emit('skills:learn', { skillId });
  }

  assignSkill(skillId: number, slot: string): void {
    this.socket?.emit('skills:assign', { skillId, slot });
  }

  unassignSkill(slot: string): void {
    this.socket?.emit('skills:unassign', { slot });
  }

  // Inventaire
  getInventory(): void {
    this.socket?.emit('inventory:get');
  }

  equipItem(itemId: number): void {
    this.socket?.emit('inventory:equip', { itemId });
  }

  dropItem(itemId: number, quantity: number): void {
    this.socket?.emit('inventory:drop', { itemId, quantity });
  }

  // Armes
  switchWeapon(weaponCode: string): void {
    this.socket?.emit('weapon:switch', { weaponCode });
  }

  // Guilde
  getGuild(): void {
    this.socket?.emit('guild:get');
  }

  createGuild(name: string, tag: string, description?: string): void {
    this.socket?.emit('guild:create', { name, tag, description });
  }

  leaveGuild(): void {
    this.socket?.emit('guild:leave');
  }

  inviteToGuild(targetName: string): void {
    this.socket?.emit('guild:invite', { targetName });
  }

  kickFromGuild(targetCharacterId: number): void {
    this.socket?.emit('guild:kick', { targetCharacterId });
  }

  setGuildRank(targetCharacterId: number, rank: string): void {
    this.socket?.emit('guild:setRank', { targetCharacterId, rank });
  }

  depositGuildGold(amount: number): void {
    this.socket?.emit('guild:depositGold', { amount });
  }

  withdrawGuildGold(amount: number): void {
    this.socket?.emit('guild:withdrawGold', { amount });
  }

  // Banque
  getBank(): void {
    this.socket?.emit('bank:get');
  }

  depositToBank(itemId: number, quantity: number): void {
    this.socket?.emit('bank:deposit', { itemId, quantity });
  }

  withdrawFromBank(itemId: number, quantity: number): void {
    this.socket?.emit('bank:withdraw', { itemId, quantity });
  }

  // Chat
  sendChatMessage(channel: 'local' | 'guild' | 'whisper', content: string, targetName?: string): void {
    this.socket?.emit('chat:message', { channel, content, targetName });
  }

  // Map
  requestMapChange(targetMapCode: string): void {
    this.socket?.emit('map:changeRequest', { targetMapCode });
  }

  // Interaction
  checkInteraction(x: number, y: number): void {
    this.socket?.emit('interact:check', { x, y });
  }

  // Personnage
  getCharacterStats(): void {
    this.socket?.emit('character:getStats');
  }

  getWeaponProgress(): void {
    this.socket?.emit('character:getWeaponProgress');
  }

  getElementProgress(): void {
    this.socket?.emit('character:getElementProgress');
  }

  /**
   * Retourne le socket brut (pour Phaser)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Vérifie si connecté
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Déconnecte
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.listeners.clear();
  }
}
