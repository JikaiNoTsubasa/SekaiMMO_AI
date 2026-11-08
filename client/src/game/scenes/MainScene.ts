// Main Game Scene - Scène principale du jeu
// Intègre tous les systèmes: combat, input, telegraph, maps
// SekaiMMO v2.0

import Phaser from 'phaser';
import { PIXEL_FONT } from '../fonts';
import type { Socket } from 'socket.io-client';
import type {
  CharacterData,
  MapData,
  SkillData,
  SkillSlot,
  DamageEvent,
  MonsterDefeatedEvent,
  SkillCastEvent,
  PlayerMovedEvent,
  MonsterData,
  AutoAttackProfile,
} from '../types';
import { InputManager, type InputEvent } from '../systems/InputManager';
import { TelegraphManager } from '../systems/SkillTelegraph';
import { CombatManager } from '../systems/CombatManager';
import { CharacterAnimator } from '../systems/CharacterAnimator';
import { SekaiMapLoader } from '../systems/SekaiMapLoader';
import { isSkillWeaponEquipped } from '../../utils/skillWeapon';

// Décalage vertical des barres de vie/mana sous les pieds des personnages et monstres
const BAR_OFFSET_BELOW = 4;

// Options de la scène (simplifiées pour le démarrage)
export interface MainSceneOptions {
  socket: Socket;
  characterId: number;
  initialPosition: { x: number; y: number };
  mapCode?: string; // Fichier public/maps/<mapCode>.sm
  onMapChange?: (mapCode: string) => void;
  onReward?: (payload: { gold: number; drops: { itemId: number; quantity: number }[] }) => void;
  onSkillCast?: (slot: SkillSlot) => void;
  onWrongWeapon?: (skill: SkillData) => void;
  // Stats réelles du personnage (sinon valeurs par défaut) et notification des changements
  character?: PlayerStatus;
  onStatusChange?: (status: PlayerStatus) => void;
}

export interface PlayerStatus {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  gold: number;
}

// Données passées à scene.restart() lors d'un changement de map
interface MainSceneInitData {
  mapCode?: string;
  position?: { x: number; y: number };
}

// État de la map envoyé par le serveur (réponse à map:requestState)
interface MapStateEvent {
  map: { id: number; code: string; name: string; width: number; height: number; pvpEnabled: boolean };
  position: { x: number; y: number };
  monsters: MonsterData[];
  npcs?: NpcData[];
  players: Partial<CharacterData>[];
}

// PNJ affiché sur la map (l'interaction passe par le clic droit, voir InputManager)
interface NpcData {
  id: number;
  name: string;
  title: string | null;
  positionX: number;
  positionY: number;
}

interface NpcInstance {
  sprite: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
}

// État d'un autre joueur
interface OtherPlayer {
  characterId: number;
  sprite: Phaser.GameObjects.Sprite;
  animator: CharacterAnimator;
  stopTimer: Phaser.Time.TimerEvent | null; // Retour au repos quand les mises à jour de position cessent
  nameText: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Graphics;
  data: Partial<CharacterData>;
}

// État d'un monstre
interface MonsterInstance {
  spawnId: number;
  sprite: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Graphics;
  data: MonsterData;
}

export class MainScene extends Phaser.Scene {
  // Options
  private options!: MainSceneOptions;

  // Systèmes
  private inputManager!: InputManager;
  private telegraphManager!: TelegraphManager;
  private combatManager!: CombatManager;
  private mapLoader!: SekaiMapLoader;


  // Joueur local
  private player!: Phaser.GameObjects.Sprite;
  private playerAnimator!: CharacterAnimator;
  private playerMoveAngle: number | null = null; // Direction du déplacement de cette frame
  private playerHealthBar!: Phaser.GameObjects.Graphics;
  private playerManaBar!: Phaser.GameObjects.Graphics;

  // Entités
  private otherPlayers: Map<number, OtherPlayer> = new Map();
  private monsters: Map<number, MonsterInstance> = new Map();
  private npcs: Map<number, NpcInstance> = new Map();

  // Marqueur de mouvement
  private moveMarker!: Phaser.GameObjects.Arc;
  private moveTarget: Phaser.Math.Vector2 | null = null;

  // État
  private lastBroadcast: number = 0;
  private characterData!: CharacterData;
  private mapData!: MapData;
  private skills: Map<SkillSlot, SkillData | null> = new Map();

  // Cooldowns des skills
  private skillCooldowns: Map<SkillSlot, number> = new Map();

  // Listeners socket de la scène (retirés un par un au shutdown, sans toucher ceux de l'UI)
  private socketHandlers: { event: string; handler: (...args: any[]) => void }[] = [];

  // Warps : armés seulement une fois que le joueur n'est plus sur un warp (évite les allers-retours)
  private warpArmed: boolean = false;
  private pendingMapChange: boolean = false;

  // Auto-attaque (indépendante des compétences, style MOBA)
  private autoAttackTarget: number | null = null;
  private autoAttackCooldown: number = 0; // Secondes avant la prochaine attaque
  private autoAttackProfile: AutoAttackProfile = {
    weaponItemId: null,
    weaponName: null,
    weaponCode: null,
    damageType: 'PHYSICAL',
    range: 70,
    attacksPerSecond: 1,
    masteryNames: [],
    masteryFlatDamage: 0,
    masteryAttackScaling: 0,
    masteryMagicScaling: 0,
  };

  constructor(options: MainSceneOptions) {
    super('MainScene');
    this.options = options;

    // Données par défaut (seront mises à jour par le serveur)
    this.characterData = {
      id: options.characterId,
      name: 'Player',
      level: 1,
      health: options.character?.health ?? 100,
      maxHealth: options.character?.maxHealth ?? 100,
      mana: options.character?.mana ?? 50,
      maxMana: options.character?.maxMana ?? 50,
      positionX: options.initialPosition.x,
      positionY: options.initialPosition.y,
      physicalAttack: 50,
      magicalAttack: 50,
      physicalDefense: 20,
      magicalDefense: 20,
      movementSpeed: 200,
      attackSpeed: 1,
      critChance: 0.05,
      critDamage: 1.5,
      gold: options.character?.gold ?? 0,
    };

    // Map par défaut
    this.mapData = {
      id: 1,
      code: options.mapCode ?? 'starting_village',
      name: 'Village de Départ',
      width: 480,  // 30 tiles * 16px
      height: 320, // 20 tiles * 16px
      pvpEnabled: false,
      portals: [],
    };
  }

  /**
   * Appelé avant preload() à chaque démarrage, y compris scene.restart() lors d'un warp
   */
  init(data?: MainSceneInitData): void {
    if (data?.mapCode) {
      this.mapData = { ...this.mapData, code: data.mapCode, portals: [] };
    }
    if (data?.position) {
      this.characterData.positionX = data.position.x;
      this.characterData.positionY = data.position.y;
    }

    this.moveTarget = null;
    this.autoAttackTarget = null;
    this.autoAttackCooldown = 0;
    this.warpArmed = false;
    this.pendingMapChange = false;
  }

  preload(): void {
    // Le LoaderPlugin survit aux restart : ne pas empiler le listener
    this.load.off('loaderror', this.onLoadError, this);
    this.load.on('loaderror', this.onLoadError, this);

    // Map .sm (SekaiMapEditor) + images de ses tilesets
    this.mapLoader = new SekaiMapLoader(this, {
      mapBasePath: 'maps/',
      tilesetBasePath: 'assets/tilesets/',
      defaultTileSize: 16,
    });
    this.mapLoader.preloadMap(this.mapData.code);

    // Spritesheet des personnages (32x32)
    CharacterAnimator.preload(this);
  }

  private onLoadError(file: Phaser.Loader.File): void {
    console.error(`[MainScene] Failed to load: ${file.key} from ${file.url}`);
  }

  create(): void {
    console.log('[MainScene] create() called');
    console.log('[MainScene] Initial position:', this.options.initialPosition);

    // Initialiser les systèmes
    this.initializeSystems();

    // Charger la map
    this.loadMap();

    // Créer le joueur
    this.createPlayer();

    // Configurer les inputs
    this.setupInputs();

    // Configurer les événements socket
    this.setupSocketEvents();

    // Configurer la caméra
    this.setupCamera();

    // Événement de nettoyage
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    // Map prête : demander au serveur l'état de la map (monstres, joueurs, position)
    this.options.socket.emit('map:requestState');

    console.log('[MainScene] create() complete');
  }

  /**
   * Initialise tous les systèmes
   */
  private initializeSystems(): void {
    // Input Manager avec les touches MOBA
    this.inputManager = new InputManager(this, {
      quickCast: false,
      quickCastWithIndicator: true,
    });
    this.inputManager.setSkillBar(this.skills);

    // Telegraph Manager pour les indicateurs de skills
    this.telegraphManager = new TelegraphManager(this);

    // Combat Manager pour les effets visuels
    this.combatManager = new CombatManager(this);

    // Animations des personnages (ou placeholder si le spritesheet est absent)
    CharacterAnimator.setup(this);
  }

  /**
   * Charge la map actuelle
   */
  private loadMap(): void {
    if (!this.mapLoader.createMap(this.mapData.code)) {
      // Fallback sur la map procédurale
      this.mapLoader.createProceduralMap(this.mapData);
      return;
    }

    // Mettre à jour les dimensions de la map
    this.mapData.width = this.mapLoader.getWidthInPixels() ?? this.mapData.width;
    this.mapData.height = this.mapLoader.getHeightInPixels() ?? this.mapData.height;
    this.mapData.portals = this.mapLoader.getPortals();

    // Debug: afficher les collisions et événements (décommenter pour visualiser)
    // this.mapLoader.showDebug();
  }

  /**
   * Crée le joueur local
   */
  private createPlayer(): void {
    const startX = Phaser.Math.Clamp(this.characterData.positionX, 0, this.mapData.width);
    const startY = Phaser.Math.Clamp(this.characterData.positionY, 0, this.mapData.height);

    // Sprite du joueur (frame 32x32, ancré aux pieds)
    this.player = CharacterAnimator.createSprite(this, startX, startY, 0x4f9dff);
    this.player.setDepth(10);
    this.playerAnimator = new CharacterAnimator(this.player);

    // Barre de vie
    this.playerHealthBar = this.add.graphics();
    this.playerHealthBar.setDepth(11);

    // Barre de mana
    this.playerManaBar = this.add.graphics();
    this.playerManaBar.setDepth(11);

    this.updatePlayerBars();

    // Marqueur de mouvement
    this.moveMarker = this.add.circle(0, 0, 8, 0xffd166, 0.5);
    this.moveMarker.setVisible(false);
    this.moveMarker.setDepth(9);
  }

  /**
   * Configure les inputs
   */
  private setupInputs(): void {
    this.inputManager.onInput((event: InputEvent) => {
      switch (event.type) {
        case 'move':
          this.handleMoveInput(event.data as { x: number; y: number });
          break;
        case 'skill-start':
          this.handleSkillStart(event.data as { slot: SkillSlot; skill: SkillData });
          break;
        case 'skill-cast':
          this.handleSkillCast(event.data as { slot: SkillSlot; skill: SkillData; targetX: number; targetY: number });
          break;
        case 'skill-cancel':
          this.handleSkillCancel();
          break;
        case 'stop':
          this.handleStop();
          break;
        case 'interact':
          this.handleInteract(event.data as { x: number; y: number });
          break;
      }
    });
  }

  /**
   * Configure les événements socket
   */
  /**
   * Enregistre un listener socket propre à la scène (retiré au shutdown)
   */
  private listen<T = any>(event: string, handler: (payload: T) => void): void {
    this.options.socket.on(event, handler);
    this.socketHandlers.push({ event, handler });
  }

  private setupSocketEvents(): void {
    console.log('[MainScene] Setting up socket events...');

    // État de la map (réponse à map:requestState)
    this.listen<MapStateEvent>('map:state', (payload) => {
      this.handleMapState(payload);
    });

    // Changement de map refusé par le serveur
    this.listen<{ reason: string }>('map:changeFailed', (payload) => {
      console.warn('[MainScene] Map change failed:', payload.reason);
      this.pendingMapChange = false;
      this.warpArmed = false; // Réarmé quand le joueur quitte le warp
    });

    // Mouvement des joueurs
    this.listen<PlayerMovedEvent>('player:moved', (payload) => {
      this.handlePlayerMoved(payload);
    });

    // Cast de skill
    this.listen<SkillCastEvent>('player:skillCast', (payload) => {
      this.handleRemoteSkillCast(payload);
    });

    // Dégâts
    this.listen<DamageEvent>('combat:damage', (payload) => {
      this.handleDamage(payload);
    });

    // Profil d'auto-attaque (change avec l'arme équipée et les maîtrises)
    this.listen<AutoAttackProfile>('combat:autoAttackProfile', (profile) => {
      this.autoAttackProfile = profile;
    });

    // Auto-attaques des autres joueurs (effet visuel)
    this.listen<{ characterId: number; targetId: number; weaponCode: string | null }>('player:autoAttack', (payload) => {
      if (payload.characterId === this.characterData.id) return;
      const attacker = this.otherPlayers.get(payload.characterId);
      const monster = this.monsters.get(payload.targetId);
      if (!attacker || !monster) return;
      const isMagical = payload.weaponCode === 'WAND' || payload.weaponCode === 'SCEPTER';
      attacker.animator.playAction(
        'attack',
        Phaser.Math.Angle.Between(attacker.sprite.x, attacker.sprite.y, monster.sprite.x, monster.sprite.y)
      );
      this.playAutoAttackEffect(attacker.sprite.x, attacker.sprite.y, monster.sprite.x, monster.sprite.y, isMagical);
    });

    // Monstre vaincu
    this.listen<MonsterDefeatedEvent>('monster:defeated', (payload) => {
      this.handleMonsterDefeated(payload);
    });

    // Spawn de monstre
    this.listen<MonsterData>('monster:spawn', (payload) => {
      this.spawnMonster(payload);
    });

    // Liste initiale des monstres (quand on rejoint une map)
    this.listen<MonsterData[]>('monsters:initial', (monsters) => {
      console.log(`[MainScene] Received ${monsters.length} initial monsters`);
      for (const monster of monsters) {
        this.spawnMonster(monster);
      }
    });

    // Mise à jour de santé du monstre
    this.listen<{ spawnId: number; health: number }>('monster:healthUpdate', (payload) => {
      this.updateMonsterHealth(payload);
    });

    // Mouvement du monstre
    this.listen<{ spawnId: number; positionX: number; positionY: number }>('monster:moved', (payload) => {
      this.handleMonsterMoved(payload);
    });

    // Attaque du monstre sur le joueur
    this.listen<{ spawnId: number; targetId: number; damage: number; damageType: string; element: string }>('monster:attack', (payload) => {
      this.handleMonsterAttack(payload);
    });

    // Changement de map
    this.listen<{ mapCode: string; positionX: number; positionY: number }>('map:change', (payload) => {
      this.options.onMapChange?.(payload.mapCode);
      this.changeMap(payload.mapCode, { x: payload.positionX, y: payload.positionY });
    });

    // Récompenses
    this.listen('player:reward', (payload) => {
      this.options.onReward?.(payload);
    });

    // Joueur rejoint la map
    this.listen<{ character: Partial<CharacterData> }>('player:joined', (payload) => {
      this.addOtherPlayer(payload.character);
    });

    // Joueur quitte la map
    this.listen<{ characterId: number }>('player:left', (payload) => {
      this.removeOtherPlayer(payload.characterId);
    });

    // Mise à jour de la barre de skills
    this.listen<Record<string, { skillId: number; skill: SkillData } | null>>('skills:bar', (data) => {
      const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
      for (const slot of slots) {
        const slotData = data[slot];
        if (slotData && slotData.skill) {
          this.skills.set(slot, slotData.skill as SkillData);
        } else {
          this.skills.set(slot, null);
        }
      }
      this.inputManager.setSkillBar(this.skills);
      console.log('[MainScene] Skills bar updated', this.skills);
    });
  }

  /**
   * Configure la caméra
   */
  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor('#141625');
    camera.setBounds(0, 0, this.mapData.width, this.mapData.height);
    // Pas de lissage (lerp = 1) : avec un lerp < 1, caméra et joueur sont arrondis séparément
    // et le personnage tremble d'un pixel à l'écran pendant la marche
    camera.startFollow(this.player, true, 1, 1);
    camera.roundPixels = true;
  }

  /**
   * Boucle de mise à jour
   */
  update(time: number, delta: number): void {
    // Mettre à jour l'input manager
    this.inputManager.update();

    // Animations des tiles de la map
    this.mapLoader.update(delta);

    // Mettre à jour le telegraph
    if (this.telegraphManager.isActive()) {
      const mousePos = this.inputManager.getMousePosition();
      this.telegraphManager.update(mousePos.x, mousePos.y);
    }

    // Auto-attaque
    this.playerMoveAngle = null;
    this.autoAttackCooldown = Math.max(0, this.autoAttackCooldown - delta / 1000);
    this.updateAutoAttack(time, delta);

    // Mouvement du joueur
    this.updatePlayerMovement(delta);

    // Animation : marche si le joueur s'est déplacé, sinon repos
    if (this.playerMoveAngle !== null) {
      this.playerAnimator.walk(this.playerMoveAngle);
    } else {
      this.playerAnimator.idle();
    }

    // Mise à jour des cooldowns
    this.updateCooldowns(delta);

    // Broadcast de position périodique (toujours, pour sync avec le serveur)
    if (time - this.lastBroadcast > 100) {
      this.broadcastPosition();
      this.lastBroadcast = time;
    }

    // Vérifier les portails
    this.checkPortals();
  }

  /**
   * Gère l'auto-attaque
   */
  private updateAutoAttack(_time: number, delta: number): void {
    if (this.autoAttackTarget === null) return;

    const monster = this.monsters.get(this.autoAttackTarget);
    if (!monster) {
      // Cible morte ou invalide
      this.stopAutoAttack();
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      monster.sprite.x,
      monster.sprite.y
    );

    const range = this.autoAttackProfile.range;

    // Si trop loin, se rapprocher
    if (distance > range) {
      // Calculer la position intermédiaire (à portée d'attaque)
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        monster.sprite.x,
        monster.sprite.y
      );
      const targetX = monster.sprite.x - Math.cos(angle) * (range - 20);
      const targetY = monster.sprite.y - Math.sin(angle) * (range - 20);

      // Se déplacer vers la cible
      const speed = this.characterData.movementSpeed;
      const velocity = speed * (delta / 1000);
      const moveAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
      const nextX = this.player.x + Math.cos(moveAngle) * velocity;
      const nextY = this.player.y + Math.sin(moveAngle) * velocity;

      if (!this.checkCollision(nextX, nextY)) {
        this.player.x = Phaser.Math.Clamp(nextX, 0, this.mapData.width);
        this.player.y = Phaser.Math.Clamp(nextY, 0, this.mapData.height);
        this.playerMoveAngle = moveAngle;
        this.updatePlayerBars();
      }
    } else if (this.autoAttackCooldown <= 0) {
      // À portée - auto-attaque (arme équipée ou mains nues), aucune compétence requise
      this.autoAttackCooldown = 1 / this.autoAttackProfile.attacksPerSecond;
      const isMagical = this.autoAttackProfile.damageType === 'MAGICAL';
      const attackAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, monster.sprite.x, monster.sprite.y);
      this.playerAnimator.playAction('attack', attackAngle, 1000 / this.autoAttackProfile.attacksPerSecond);
      this.playAutoAttackEffect(this.player.x, this.player.y, monster.sprite.x, monster.sprite.y, isMagical);
      this.options.socket.emit('combat:autoAttack', { targetId: monster.spawnId });
    }
  }

  /**
   * Effet visuel d'une auto-attaque : projectile pour les armes à distance, impact au corps à corps
   */
  private playAutoAttackEffect(fromX: number, fromY: number, toX: number, toY: number, isMagical: boolean): void {
    const color = isMagical ? 0x9b6bff : 0xffffff;
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);

    if (distance > 120) {
      this.combatManager.createProjectile({
        startX: fromX,
        startY: fromY,
        targetX: toX,
        targetY: toY,
        speed: 900,
        color,
        size: 3,
      });
    } else {
      this.combatManager.createImpactEffect(toX, toY, color);
    }
  }

  /**
   * Met à jour le mouvement du joueur
   */
  private updatePlayerMovement(delta: number): void {
    if (!this.moveTarget) return;

    const speed = this.characterData.movementSpeed;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.moveTarget.x,
      this.moveTarget.y
    );

    if (distance < 4) {
      this.moveTarget = null;
      this.moveMarker.setVisible(false);
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.moveTarget.x,
      this.moveTarget.y
    );

    const velocity = speed * (delta / 1000);
    const nextX = this.player.x + Math.cos(angle) * velocity;
    const nextY = this.player.y + Math.sin(angle) * velocity;

    // Vérifier les collisions
    if (!this.checkCollision(nextX, nextY)) {
      this.player.x = Phaser.Math.Clamp(nextX, 0, this.mapData.width);
      this.player.y = Phaser.Math.Clamp(nextY, 0, this.mapData.height);
      this.playerMoveAngle = angle;
    }

    // Mettre à jour les barres du joueur
    this.updatePlayerBars();
  }

  /**
   * Met à jour les cooldowns
   */
  private updateCooldowns(delta: number): void {
    const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
    for (const slot of slots) {
      const remaining = this.skillCooldowns.get(slot) ?? 0;
      if (remaining > 0) {
        this.skillCooldowns.set(slot, Math.max(0, remaining - delta / 1000));
      }
    }
  }

  /**
   * Vérifie si le joueur est sur un portail
   */
  private checkPortals(): void {
    const portal = this.mapLoader.checkPortalCollision(this.player.x, this.player.y);

    if (!portal) {
      this.warpArmed = true;
      return;
    }

    if (!this.warpArmed || this.pendingMapChange) return;

    // Envoyer la position exacte avant la demande pour que le serveur valide le warp
    this.broadcastPosition();
    this.pendingMapChange = true;
    this.options.socket.emit('map:changeRequest', {
      targetMapCode: portal.targetMapCode,
    });
  }

  /**
   * Recharge la scène sur une autre map (fichier maps/<mapCode>.sm)
   */
  private changeMap(mapCode: string, position: { x: number; y: number }): void {
    console.log(`[MainScene] Changing map to ${mapCode} at (${position.x}, ${position.y})`);
    this.scene.restart({ mapCode, position } satisfies MainSceneInitData);
  }

  /**
   * Applique l'état de la map reçu du serveur
   */
  private handleMapState(state: MapStateEvent): void {
    // Le personnage est sur une autre map côté serveur (ex: reconnexion) : charger la bonne
    if (state.map.code !== this.mapData.code) {
      this.changeMap(state.map.code, state.position);
      return;
    }

    this.mapData.id = state.map.id;
    this.mapData.name = state.map.name;
    this.mapData.pvpEnabled = state.map.pvpEnabled;

    // Position faisant autorité
    this.player.setPosition(state.position.x, state.position.y);
    this.characterData.positionX = state.position.x;
    this.characterData.positionY = state.position.y;
    this.updatePlayerBars();

    for (const monster of state.monsters) {
      this.spawnMonster(monster);
    }
    for (const npc of state.npcs ?? []) {
      this.spawnNpc(npc);
    }
    for (const player of state.players) {
      this.addOtherPlayer(player);
    }
  }

  // === Handlers d'input ===

  private handleMoveInput(target: { x: number; y: number }): void {
    // Vérifier si on clique sur un monstre pour auto-attack
    const clickedMonster = this.getMonsterAtPosition(target.x, target.y);
    if (clickedMonster) {
      this.startAutoAttack(clickedMonster.spawnId);
      return;
    }

    // Arrêter l'auto-attaque si on se déplace manuellement
    this.stopAutoAttack();

    const targetX = Phaser.Math.Clamp(target.x, 0, this.mapData.width);
    const targetY = Phaser.Math.Clamp(target.y, 0, this.mapData.height);

    this.moveTarget = new Phaser.Math.Vector2(targetX, targetY);
    this.moveMarker.setPosition(targetX, targetY);
    this.moveMarker.setVisible(true);

    // Animation du marqueur
    this.tweens.add({
      targets: this.moveMarker,
      scale: { from: 1.5, to: 1 },
      alpha: { from: 0.8, to: 0.5 },
      duration: 200,
    });
  }

  /**
   * Trouve un monstre à une position donnée
   */
  private getMonsterAtPosition(x: number, y: number): MonsterInstance | null {
    for (const monster of this.monsters.values()) {
      // Détection basée sur le rectangle 16x32
      const dx = Math.abs(x - monster.sprite.x);
      const dy = Math.abs(y - monster.sprite.y);
      if (dx < 12 && dy < 20) {
        return monster;
      }
    }
    return null;
  }

  private handleSkillStart(data: { slot: SkillSlot; skill: SkillData }): void {
    // Vérifier l'arme équipée (le message s'affiche au lancer)
    if (!isSkillWeaponEquipped(data.skill, this.autoAttackProfile.weaponCode)) return;

    // Vérifier le cooldown
    if ((this.skillCooldowns.get(data.slot) ?? 0) > 0) return;

    // Vérifier le mana
    if (this.characterData.mana < data.skill.manaCost) return;

    // Afficher le telegraph
    this.telegraphManager.activate(data.slot, data.skill, this.player.x, this.player.y);
  }

  private handleSkillCast(data: { slot: SkillSlot; skill: SkillData; targetX: number; targetY: number }): void {
    const { slot, skill, targetX, targetY } = data;

    // Vérifier l'arme équipée
    if (!isSkillWeaponEquipped(skill, this.autoAttackProfile.weaponCode)) {
      this.options.onWrongWeapon?.(skill);
      return;
    }

    // Vérifier le cooldown
    if ((this.skillCooldowns.get(slot) ?? 0) > 0) return;

    // Vérifier le mana
    if (this.characterData.mana < skill.manaCost) return;

    // Vérifier la portée
    const distanceToTarget = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      targetX,
      targetY
    );
    if (distanceToTarget > skill.range) {
      console.log(`[MainScene] Skill ${skill.name} out of range: ${distanceToTarget} > ${skill.range}`);
      return;
    }

    // Calculer la direction
    const direction = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
    this.playerAnimator.playAction('cast', direction);

    // Jouer l'effet visuel
    this.combatManager.playSkillEffect({
      x: skill.telegraphShape === 'circle' ? targetX : this.player.x,
      y: skill.telegraphShape === 'circle' ? targetY : this.player.y,
      skill,
      direction,
    });

    // Émettre au serveur
    this.options.socket.emit('skill:cast', {
      skillId: skill.id,
      slot,
      targetX,
      targetY,
    });

    // Notifier l'UI (pour les cooldowns visuels)
    this.options.onSkillCast?.(slot);

    // Mettre le cooldown
    this.skillCooldowns.set(slot, skill.cooldown);

    // Déduire le mana localement (sera confirmé par le serveur)
    this.characterData.mana = Math.max(0, this.characterData.mana - skill.manaCost);
    this.updatePlayerBars();

    // Masquer le telegraph
    this.telegraphManager.deactivate();
  }

  private handleSkillCancel(): void {
    this.telegraphManager.deactivate();
  }

  private handleStop(): void {
    this.moveTarget = null;
    this.moveMarker.setVisible(false);
  }

  private handleInteract(target: { x: number; y: number }): void {
    // Chercher un NPC ou objet à proximité
    this.options.socket.emit('interact:check', {
      x: target.x,
      y: target.y,
    });
  }

  // === Handlers socket ===

  private handlePlayerMoved(payload: PlayerMovedEvent): void {
    if (payload.characterId === this.characterData.id) return;

    const other = this.otherPlayers.get(payload.characterId);
    if (other) {
      // Animation de marche dans la direction du déplacement, repos si plus de mise à jour
      const distance = Phaser.Math.Distance.Between(other.sprite.x, other.sprite.y, payload.position.x, payload.position.y);
      if (distance > 0.5) {
        other.animator.walk(
          Phaser.Math.Angle.Between(other.sprite.x, other.sprite.y, payload.position.x, payload.position.y)
        );
        other.stopTimer?.remove();
        other.stopTimer = this.time.delayedCall(200, () => {
          other.stopTimer = null;
          other.animator.idle();
        });
      }

      // Interpolation vers la nouvelle position
      this.tweens.add({
        targets: other.sprite,
        x: payload.position.x,
        y: payload.position.y,
        duration: 100,
        onUpdate: () => {
          this.updateOtherPlayerVisuals(other);
        },
      });
    }
  }

  private handleRemoteSkillCast(payload: SkillCastEvent): void {
    if (payload.characterId === this.characterData.id) return;

    const other = this.otherPlayers.get(payload.characterId);
    if (!other) return;

    const skill = this.skills.get(payload.slot as SkillSlot);
    if (!skill) return;

    const direction = Phaser.Math.Angle.Between(
      other.sprite.x,
      other.sprite.y,
      payload.targetX,
      payload.targetY
    );
    other.animator.playAction('cast', direction);

    this.combatManager.playSkillEffect({
      x: skill.telegraphShape === 'circle' ? payload.targetX : other.sprite.x,
      y: skill.telegraphShape === 'circle' ? payload.targetY : other.sprite.y,
      skill,
      direction,
    });
  }

  private handleDamage(payload: DamageEvent): void {
    let x: number, y: number;

    if (payload.targetType === 'character') {
      if (payload.targetId === this.characterData.id) {
        x = this.player.x;
        y = this.player.y;
        // Mettre à jour la santé locale
        this.characterData.health = Math.max(0, this.characterData.health - payload.damage);
        this.updatePlayerBars();
      } else {
        const other = this.otherPlayers.get(payload.targetId);
        if (!other) return;
        x = other.sprite.x;
        y = other.sprite.y;
      }
    } else {
      const monster = this.monsters.get(payload.targetId);
      if (!monster) return;
      x = monster.sprite.x;
      y = monster.sprite.y;
    }

    // Afficher le texte de dégâts
    this.combatManager.showDamageText({
      x,
      y,
      damage: payload.damage,
      isCritical: payload.isCritical,
      damageType: payload.damageType,
      element: payload.element,
    });
  }

  private handleMonsterDefeated(payload: MonsterDefeatedEvent): void {
    const monster = this.monsters.get(payload.spawnId);
    if (monster) {
      // Arrêter l'auto-attaque si c'était notre cible
      if (this.autoAttackTarget === payload.spawnId) {
        this.stopAutoAttack();
      }

      // Effet de mort
      this.combatManager.createDeathEffect(monster.sprite.x, monster.sprite.y);

      // Supprimer le monstre
      monster.sprite.destroy();
      monster.nameText.destroy();
      monster.healthBar.destroy();
      this.monsters.delete(payload.spawnId);
    }

    // Flash de caméra pour le joueur qui a vaincu
    if (payload.defeatedBy === this.characterData.id) {
      this.cameras.main.flash(120, 255, 255, 255);
    }
  }

  private handleMonsterMoved(payload: { spawnId: number; positionX: number; positionY: number }): void {
    const monster = this.monsters.get(payload.spawnId);
    if (!monster) return;

    // Interpoler vers la nouvelle position
    this.tweens.add({
      targets: monster.sprite,
      x: payload.positionX,
      y: payload.positionY,
      duration: 100,
      onUpdate: () => {
        // Mettre à jour la position du texte et de la barre de vie
        monster.nameText.setPosition(Math.floor(monster.sprite.x), Math.floor(monster.sprite.y) - 35);
        this.updateMonsterVisuals(monster);
      },
    });
  }

  private handleMonsterAttack(payload: { spawnId: number; targetId: number; damage: number; damageType: string; element: string }): void {
    // Vérifier si c'est le joueur local qui est attaqué
    if (payload.targetId !== this.characterData.id) return;

    // Appliquer les dégâts localement
    this.characterData.health = Math.max(0, this.characterData.health - payload.damage);
    this.updatePlayerBars();

    // Afficher le texte de dégâts
    this.combatManager.showDamageText({
      x: this.player.x,
      y: this.player.y,
      damage: payload.damage,
      isCritical: false,
      damageType: payload.damageType as 'PHYSICAL' | 'MAGICAL' | 'PURE',
      element: payload.element as any,
    });

    // Flash rouge si dégâts importants
    if (payload.damage > this.characterData.maxHealth * 0.2) {
      this.cameras.main.flash(80, 255, 0, 0, false, 0.3);
    }
  }

  // === Gestion des entités ===

  private addOtherPlayer(data: Partial<CharacterData>): void {
    if (!data.id || data.id === this.characterData.id || this.otherPlayers.has(data.id)) return;

    const sprite = CharacterAnimator.createSprite(this, data.positionX ?? 0, data.positionY ?? 0, 0xff6b6b);
    sprite.setDepth(8);

    const nameText = this.add.text(0, 0, data.name ?? 'Player', {
      fontFamily: PIXEL_FONT,
      fontSize: '8px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(9);

    const healthBar = this.add.graphics();
    healthBar.setDepth(9);

    const other: OtherPlayer = {
      characterId: data.id,
      sprite,
      animator: new CharacterAnimator(sprite),
      stopTimer: null,
      nameText,
      healthBar,
      data,
    };

    this.updateOtherPlayerVisuals(other);
    this.otherPlayers.set(data.id, other);
  }

  private removeOtherPlayer(characterId: number): void {
    const other = this.otherPlayers.get(characterId);
    if (other) {
      other.sprite.destroy();
      other.nameText.destroy();
      other.healthBar.destroy();
      this.otherPlayers.delete(characterId);
    }
  }

  private updateOtherPlayerVisuals(other: OtherPlayer): void {
    const { sprite, nameText, healthBar, data } = other;

    nameText.setPosition(Math.floor(sprite.x), Math.floor(sprite.y) - 35);

    healthBar.clear();
    const healthPercent = (data.health ?? 100) / (data.maxHealth ?? 100);
    const barWidth = 40;
    const barHeight = 4;

    healthBar.fillStyle(0x333333);
    healthBar.fillRect(Math.floor(sprite.x) - barWidth / 2, Math.floor(sprite.y) + BAR_OFFSET_BELOW, barWidth, barHeight);

    healthBar.fillStyle(0x00ff00);
    healthBar.fillRect(Math.floor(sprite.x) - barWidth / 2, Math.floor(sprite.y) + BAR_OFFSET_BELOW, barWidth * healthPercent, barHeight);
  }

  private spawnNpc(data: NpcData): void {
    if (this.npcs.has(data.id)) return;

    // Placeholder en attendant le sprite du PNJ
    const sprite = this.add.rectangle(data.positionX, data.positionY, 16, 32, 0x4477aa);
    sprite.setOrigin(0.5, 0.90625);
    sprite.setDepth(7);
    sprite.setInteractive({ useHandCursor: true });

    const nameText = this.add.text(data.positionX, data.positionY - 35, data.name, {
      fontFamily: PIXEL_FONT,
      fontSize: '8px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 2,
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(8);

    this.npcs.set(data.id, { sprite, nameText });
  }

  private spawnMonster(data: MonsterData): void {
    if (this.monsters.has(data.spawnId)) return;

    const sprite = this.add.rectangle(data.positionX, data.positionY, 16, 32, 0xaa4444);
    sprite.setOrigin(0.5, 0.90625); // Centre horizontal, 3px au-dessus du bas
    sprite.setDepth(7);

    // Rendre le sprite interactif pour le ciblage
    sprite.setInteractive({ useHandCursor: true });
    sprite.setData('spawnId', data.spawnId);

    // Clic droit sur le monstre = auto-attaque
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.startAutoAttack(data.spawnId);
      }
    });

    const nameText = this.add.text(data.positionX, data.positionY - 35, `${data.name} Lv.${data.level}`, {
      fontFamily: PIXEL_FONT,
      fontSize: '8px',
      color: '#ff8888',
      stroke: '#000000',
      strokeThickness: 2,
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(8);

    const healthBar = this.add.graphics();
    healthBar.setDepth(8);

    const monster: MonsterInstance = {
      spawnId: data.spawnId,
      sprite,
      nameText,
      healthBar,
      data,
    };

    this.updateMonsterVisuals(monster);
    this.monsters.set(data.spawnId, monster);
  }

  /**
   * Démarre l'auto-attaque sur un monstre
   */
  private startAutoAttack(spawnId: number): void {
    const monster = this.monsters.get(spawnId);
    if (!monster) return;

    this.autoAttackTarget = spawnId;
    this.moveTarget = null; // Annuler le mouvement manuel
    console.log(`[MainScene] Auto-attack started on monster ${spawnId}`);
  }

  /**
   * Arrête l'auto-attaque
   */
  private stopAutoAttack(): void {
    if (this.autoAttackTarget !== null) {
      console.log(`[MainScene] Auto-attack stopped`);
      this.autoAttackTarget = null;
    }
  }

  private updateMonsterHealth(payload: { spawnId: number; health: number }): void {
    const monster = this.monsters.get(payload.spawnId);
    if (monster) {
      monster.data.health = payload.health;
      this.updateMonsterVisuals(monster);
    }
  }

  private updateMonsterVisuals(monster: MonsterInstance): void {
    const { sprite, healthBar, data } = monster;

    healthBar.clear();
    const healthPercent = data.health / data.maxHealth;
    const barWidth = 50;
    const barHeight = 5;

    healthBar.fillStyle(0x333333);
    healthBar.fillRect(Math.floor(sprite.x) - barWidth / 2, Math.floor(sprite.y) + BAR_OFFSET_BELOW, barWidth, barHeight);

    healthBar.fillStyle(healthPercent > 0.3 ? 0xff4444 : 0xff0000);
    healthBar.fillRect(Math.floor(sprite.x) - barWidth / 2, Math.floor(sprite.y) + BAR_OFFSET_BELOW, barWidth * healthPercent, barHeight);
  }

  // === Utilitaires ===

  private lastStatusKey = '';

  /** Prévient l'UI quand vie, mana ou or changent */
  private notifyStatus(): void {
    const { health, maxHealth, mana, maxMana, gold } = this.characterData;
    const key = `${health}|${maxHealth}|${mana}|${maxMana}|${gold}`;
    if (key === this.lastStatusKey) return;
    this.lastStatusKey = key;
    this.options.onStatusChange?.({ health, maxHealth, mana, maxMana, gold });
  }

  private updatePlayerBars(): void {
    this.notifyStatus();
    // Arrondi comme le rendu du sprite (roundPixels) pour rester alignées au pixel
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);

    // Barre de vie
    this.playerHealthBar.clear();
    const healthPercent = this.characterData.health / this.characterData.maxHealth;
    const barWidth = 32;
    const barHeight = 1;

    this.playerHealthBar.fillStyle(0x333333);
    this.playerHealthBar.fillRect(x - barWidth / 2, y + BAR_OFFSET_BELOW, barWidth, barHeight);

    this.playerHealthBar.fillStyle(0x00ff00);
    this.playerHealthBar.fillRect(x - barWidth / 2, y + BAR_OFFSET_BELOW, barWidth * healthPercent, barHeight);

    // Barre de mana
    this.playerManaBar.clear();
    const manaPercent = this.characterData.mana / this.characterData.maxMana;

    this.playerManaBar.fillStyle(0x333333);
    this.playerManaBar.fillRect(x - barWidth / 2, y + BAR_OFFSET_BELOW + 2, barWidth, barHeight);

    this.playerManaBar.fillStyle(0x0088ff);
    this.playerManaBar.fillRect(x - barWidth / 2, y + BAR_OFFSET_BELOW + 2, barWidth * manaPercent, barHeight);
  }

  private broadcastPosition(): void {
    this.options.socket.emit('player:move', {
      x: this.player.x,
      y: this.player.y,
    });
  }

  /**
   * Met à jour les données du personnage (depuis le serveur)
   */
  updateCharacterData(data: Partial<CharacterData>): void {
    Object.assign(this.characterData, data);
    this.updatePlayerBars();

    // Effet de level up si applicable
    if (data.level && data.level > this.characterData.level) {
      this.combatManager.createLevelUpEffect(this.player.x, this.player.y);
    }
  }

  /**
   * Met à jour la barre de skills
   */
  updateSkillBar(skills: Map<SkillSlot, SkillData | null>): void {
    this.skills = skills;
    this.inputManager.setSkillBar(skills);
  }

  /**
   * Récupère le cooldown d'un skill
   */
  getSkillCooldown(slot: SkillSlot): number {
    return this.skillCooldowns.get(slot) ?? 0;
  }

  /**
   * Récupère la position du joueur
   */
  getPlayerPosition(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  /**
   * Vérifie la collision à une position donnée
   */
  private checkCollision(x: number, y: number): boolean {
    // Vérifier les limites de la map
    if (x < 0 || y < 0 || x > this.mapData.width || y > this.mapData.height) {
      return true;
    }

    // Vérifier le layer collider de la map
    return this.mapLoader.checkCollision(x, y);
  }

  /**
   * Nettoyage des ressources
   */
  private cleanup(): void {
    const socket = this.options.socket;

    // Ne retirer que les listeners de la scène (ceux de SocketManager/UI restent actifs)
    for (const { event, handler } of this.socketHandlers) {
      socket.off(event, handler);
    }
    this.socketHandlers = [];

    this.otherPlayers.forEach((p) => {
      p.sprite.destroy();
      p.nameText.destroy();
      p.healthBar.destroy();
    });
    this.otherPlayers.clear();

    this.monsters.forEach((m) => {
      m.sprite.destroy();
      m.nameText.destroy();
      m.healthBar.destroy();
    });
    this.monsters.clear();

    this.npcs.forEach((n) => {
      n.sprite.destroy();
      n.nameText.destroy();
    });
    this.npcs.clear();

    this.inputManager.destroy();
    this.telegraphManager.destroy();
    this.combatManager.destroy();
    this.mapLoader.destroy();
  }
}
