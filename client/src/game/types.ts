// Types partagés pour le jeu client
// SekaiMMO v2.0

// Types de dégâts
export type DamageType = 'PHYSICAL' | 'MAGICAL' | 'PURE';

// Éléments magiques
export type MagicElement = 'NONE' | 'FIRE' | 'WATER' | 'EARTH' | 'AIR' | 'LIGHTNING' | 'ICE' | 'DARKNESS' | 'LIGHT';

// Types d'armes
export type WeaponCode = 'SWORD' | 'DUAL_DAGGERS' | 'BOW' | 'TWO_HANDED_AXE' | 'WAND' | 'SCEPTER';

// Ranks
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A';

// Formes de telegraph
export type TelegraphShape = 'circle' | 'cone' | 'line' | 'rectangle';

// Slots de skills
export type SkillSlot = 'Q' | 'W' | 'E' | 'R' | 'T' | 'A' | 'S' | 'D' | 'F';

// Données d'un skill
export interface SkillData {
  id: number;
  name: string;
  description?: string;
  damageType: DamageType;
  element: MagicElement;
  baseDamage: number;
  damageScaling: number;
  manaCost: number;
  cooldown: number;
  range: number;
  areaOfEffect: number;
  telegraphShape?: TelegraphShape;
  telegraphWidth?: number;
  telegraphLength?: number;
}

// Données d'un personnage
export interface CharacterData {
  id: number;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  positionX: number;
  positionY: number;
  physicalAttack: number;
  magicalAttack: number;
  physicalDefense: number;
  magicalDefense: number;
  attackSpeed: number;
  movementSpeed: number;
  critChance: number;
  critDamage: number;
  gold: number;
  currentMapId?: number;
}

// Apparence du personnage
export interface CharacterAppearance {
  skinTone: number;
  hairStyle: number;
  hairColor: number;
  eyeStyle: number;
  eyeColor: number;
  faceStyle: number;
}

// Données d'un monstre
export interface MonsterData {
  id: number;
  spawnId: number;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  positionX: number;
  positionY: number;
  element: MagicElement;
}

// Données d'une map
export interface MapData {
  id: number;
  code: string;
  name: string;
  width: number;
  height: number;
  pvpEnabled: boolean;
  tiledFile?: string;
  portals: PortalData[];
}

// Données d'un portail
export interface PortalData {
  targetMapCode: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Données d'un NPC
export interface NPCData {
  id: number;
  name: string;
  title?: string;
  positionX: number;
  positionY: number;
  isWeaponMaster: boolean;
  weaponMasterFor?: WeaponCode;
  isElementMaster: boolean;
  elementMasterFor?: MagicElement;
  isMerchant: boolean;
  isBanker: boolean;
}

// Événements Socket
export interface PlayerMovedEvent {
  characterId: number;
  position: { x: number; y: number };
}

export interface SkillCastEvent {
  characterId: number;
  skillId: number;
  slot: SkillSlot;
  targetX: number;
  targetY: number;
}

export interface DamageEvent {
  targetId: number;
  targetType: 'character' | 'monster';
  damage: number;
  isCritical: boolean;
  damageType: DamageType;
  element: MagicElement;
}

export interface MonsterDefeatedEvent {
  monsterId: number;
  spawnId: number;
  defeatedBy: number;
  experience: number;
  gold: number;
  drops: { itemId: number; quantity: number }[];
}

export interface MapChangeEvent {
  newMapId: number;
  newMapCode: string;
  positionX: number;
  positionY: number;
}

// Résultat d'un cast de skill
export interface SkillCastResult {
  success: boolean;
  reason?: string;
  damage?: number;
  isCritical?: boolean;
  manaCost?: number;
}

// Configuration des couleurs des éléments
export const ELEMENT_COLORS: Record<MagicElement, number> = {
  NONE: 0xaaaaaa,
  FIRE: 0xff4400,
  WATER: 0x0088ff,
  EARTH: 0x8b4513,
  AIR: 0x88ffff,
  LIGHTNING: 0xffff00,
  ICE: 0x00ffff,
  DARKNESS: 0x440066,
  LIGHT: 0xffffaa,
};

// Configuration des couleurs des types de dégâts
export const DAMAGE_TYPE_COLORS: Record<DamageType, number> = {
  PHYSICAL: 0xff6b6b,
  MAGICAL: 0x6b6bff,
  PURE: 0xffffff,
};

// Touches par défaut pour les skills
export const DEFAULT_SKILL_KEYS: Record<SkillSlot, string> = {
  Q: 'Q',
  W: 'W',
  E: 'E',
  R: 'R',
  T: 'T',
  A: 'A',
  S: 'S',
  D: 'D',
  F: 'F',
};
