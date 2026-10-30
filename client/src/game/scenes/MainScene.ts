// Main Game Scene - Scène principale du jeu
// Intègre tous les systèmes: combat, input, telegraph, maps
// SekaiMMO v2.0

import Phaser from 'phaser';
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
} from '../types';
import { InputManager, type InputEvent } from '../systems/InputManager';
import { TelegraphManager } from '../systems/SkillTelegraph';
import { CombatManager } from '../systems/CombatManager';
import { TiledMapLoader } from '../systems/TiledMapLoader';

// Options de la scène (simplifiées pour le démarrage)
export interface MainSceneOptions {
  socket: Socket;
  characterId: number;
  initialPosition: { x: number; y: number };
  onMapChange?: (mapCode: string) => void;
  onReward?: (payload: { experience: number; gold: number; drops: { itemId: number; quantity: number }[] }) => void;
  onSkillCast?: (slot: SkillSlot) => void;
}

// État d'un autre joueur
interface OtherPlayer {
  characterId: number;
  sprite: Phaser.GameObjects.Rectangle;
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
  private mapLoader!: TiledMapLoader;

  // Tilemap et collisions
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  // Joueur local
  private player!: Phaser.GameObjects.Rectangle;
  private playerHealthBar!: Phaser.GameObjects.Graphics;
  private playerManaBar!: Phaser.GameObjects.Graphics;

  // Entités
  private otherPlayers: Map<number, OtherPlayer> = new Map();
  private monsters: Map<number, MonsterInstance> = new Map();

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

  // Auto-attaque
  private autoAttackTarget: number | null = null;
  private readonly AUTO_ATTACK_RANGE = 80; // Portée d'auto-attaque (alignée sur compétences de base)

  constructor(options: MainSceneOptions) {
    super('MainScene');
    this.options = options;

    // Données par défaut (seront mises à jour par le serveur)
    this.characterData = {
      id: options.characterId,
      name: 'Player',
      level: 1,
      health: 1000,
      maxHealth: 1000,
      mana: 500,
      maxMana: 500,
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
      gold: 0,
    };

    // Map par défaut
    this.mapData = {
      id: 1,
      code: 'starting_village',
      name: 'Village de Départ',
      width: 480,  // 30 tiles * 16px
      height: 320, // 20 tiles * 16px
      pvpEnabled: false,
      portals: [],
    };
  }

  preload(): void {
    console.log('[MainScene] preload() called');

    // Ajouter des listeners pour le chargement
    this.load.on('filecomplete', (key: string, type: string) => {
      console.log(`[MainScene] Loaded: ${type} - ${key}`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[MainScene] Failed to load: ${file.key} from ${file.url}`);
    });

    // Charger la map Tiled JSON
    console.log('[MainScene] Loading tilemap: maps/starting_village.tmj');
    this.load.tilemapTiledJSON('starting_village', 'maps/starting_village.tmj');

    // Charger l'image du tileset
    console.log('[MainScene] Loading tileset: assets/tilesets/SunnysideWorld.png');
    this.load.image('CityBase16', 'assets/tilesets/SunnysideWorld.png');
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
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

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

    // Map Loader pour les cartes Tiled
    this.mapLoader = new TiledMapLoader(this, {
      basePath: 'assets/maps/',
      defaultTileSize: 16,
    });
  }

  /**
   * Charge la map actuelle
   */
  private loadMap(): void {
    console.log('[MainScene] loadMap() called');
    console.log('[MainScene] Attempting to load tilemap with key: starting_village');

    // Créer la tilemap depuis le fichier JSON
    const map = this.make.tilemap({ key: 'starting_village' });

    if (!map) {
      console.error('[MainScene] Failed to create tilemap - map is null/undefined');
      // Fallback sur la map procédurale
      this.mapLoader.createProceduralMap(this.mapData);
      return;
    }

    this.tilemap = map;

    console.log('[MainScene] Tilemap created successfully');
    console.log('[MainScene] Map dimensions:', map.width, 'x', map.height, 'tiles');
    console.log('[MainScene] Tile size:', map.tileWidth, 'x', map.tileHeight, 'px');
    console.log('[MainScene] Available tilesets:', map.tilesets.map(t => t.name));
    console.log('[MainScene] Available layers:', map.layers.map(l => l.name));

    // Ajouter le tileset - le nom doit correspondre au nom dans le fichier .tsx
    const tileset = map.addTilesetImage('CityBase16', 'CityBase16');

    if (!tileset) {
      console.error('[MainScene] Failed to add tileset "CityBase16"');
      console.log('[MainScene] Check that the tileset name matches the one in the .tmj file');
      this.mapLoader.createProceduralMap(this.mapData);
      return;
    }

    console.log('[MainScene] Tileset added successfully:', tileset.name);

    // Créer les layers
    const floorLayer = map.createLayer('Floor', tileset);
    const objectsLayer = map.createLayer('ObjectsLayer', tileset);

    if (floorLayer) {
      floorLayer.setDepth(0);
      console.log('[MainScene] Floor layer created');
    } else {
      console.warn('[MainScene] Floor layer not found or failed to create');
    }

    if (objectsLayer) {
      objectsLayer.setDepth(10); // Au-dessus du joueur pour les bâtiments
      console.log('[MainScene] ObjectsLayer created');

      // Configurer les collisions sur le layer ObjectsLayer
      // Toutes les tuiles non-vides (index > 0) sont des collisions
      objectsLayer.setCollisionByExclusion([-1, 0]);
      this.collisionLayer = objectsLayer;

      // Debug: afficher les tuiles de collision (décommenter pour visualiser)
      // this.showCollisionDebug(objectsLayer);

      console.log('[MainScene] Collisions enabled on ObjectsLayer');
    } else {
      console.warn('[MainScene] ObjectsLayer not found or failed to create');
    }

    // Mettre à jour les dimensions de la map
    this.mapData.width = map.widthInPixels;
    this.mapData.height = map.heightInPixels;

    console.log(`[MainScene] Map loaded successfully: ${map.widthInPixels}x${map.heightInPixels}px`);
  }

  /**
   * Crée le joueur local
   */
  private createPlayer(): void {
    const startX = Phaser.Math.Clamp(this.characterData.positionX, 0, this.mapData.width);
    const startY = Phaser.Math.Clamp(this.characterData.positionY, 0, this.mapData.height);

    // Sprite du joueur (rectangle 16x32 pixel art)
    this.player = this.add.rectangle(startX, startY, 16, 32, 0x4f9dff);
    this.player.setOrigin(0.5, 0.90625); // Centre horizontal, 3px au-dessus du bas (29/32)
    this.player.setDepth(10);

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
  private setupSocketEvents(): void {
    const socket = this.options.socket;

    console.log('[MainScene] Setting up socket events...');

    // Données de la map (reçues lors de la connexion)
    socket.on('map:data', (payload: { id: number; code: string; name: string; width: number; height: number; pvpEnabled: boolean }) => {
      console.log('[MainScene] Received map:data from server:', payload);
      this.mapData = {
        id: payload.id,
        code: payload.code,
        name: payload.name,
        width: payload.width,
        height: payload.height,
        pvpEnabled: payload.pvpEnabled,
        portals: [],
      };
      // Mettre à jour les bounds de la caméra
      this.cameras.main.setBounds(0, 0, payload.width, payload.height);
    });

    // Mouvement des joueurs
    socket.on('player:moved', (payload: PlayerMovedEvent) => {
      this.handlePlayerMoved(payload);
    });

    // Cast de skill
    socket.on('player:skillCast', (payload: SkillCastEvent) => {
      this.handleRemoteSkillCast(payload);
    });

    // Dégâts
    socket.on('combat:damage', (payload: DamageEvent) => {
      this.handleDamage(payload);
    });

    // Monstre vaincu
    socket.on('monster:defeated', (payload: MonsterDefeatedEvent) => {
      this.handleMonsterDefeated(payload);
    });

    // Spawn de monstre
    socket.on('monster:spawn', (payload: MonsterData) => {
      this.spawnMonster(payload);
    });

    // Liste initiale des monstres (quand on rejoint une map)
    socket.on('monsters:initial', (monsters: MonsterData[]) => {
      console.log(`[MainScene] Received ${monsters.length} initial monsters`);
      for (const monster of monsters) {
        this.spawnMonster(monster);
      }
    });

    // Mise à jour de santé du monstre
    socket.on('monster:healthUpdate', (payload: { spawnId: number; health: number }) => {
      this.updateMonsterHealth(payload);
    });

    // Mouvement du monstre
    socket.on('monster:moved', (payload: { spawnId: number; positionX: number; positionY: number }) => {
      this.handleMonsterMoved(payload);
    });

    // Attaque du monstre sur le joueur
    socket.on('monster:attack', (payload: { spawnId: number; targetId: number; damage: number; damageType: string; element: string }) => {
      this.handleMonsterAttack(payload);
    });

    // Changement de map
    socket.on('map:change', (payload: { mapCode: string; positionX: number; positionY: number }) => {
      this.options.onMapChange?.(payload.mapCode);
    });

    // Récompenses
    socket.on('player:reward', (payload) => {
      this.options.onReward?.(payload);
    });

    // Joueur rejoint la map
    socket.on('player:joined', (payload: { character: Partial<CharacterData> }) => {
      this.addOtherPlayer(payload.character);
    });

    // Joueur quitte la map
    socket.on('player:left', (payload: { characterId: number }) => {
      this.removeOtherPlayer(payload.characterId);
    });

    // Mise à jour de la barre de skills
    socket.on('skills:bar', (data: Record<string, { skillId: number; skill: SkillData } | null>) => {
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
    camera.startFollow(this.player, true, 0.1, 0.1);
    camera.roundPixels = true;
  }

  /**
   * Boucle de mise à jour
   */
  update(time: number, delta: number): void {
    // Mettre à jour l'input manager
    this.inputManager.update();

    // Mettre à jour le telegraph
    if (this.telegraphManager.isActive()) {
      const mousePos = this.inputManager.getMousePosition();
      this.telegraphManager.update(mousePos.x, mousePos.y);
    }

    // Auto-attaque
    this.updateAutoAttack(time, delta);

    // Mouvement du joueur
    this.updatePlayerMovement(delta);

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

    // Si trop loin, se rapprocher
    if (distance > this.AUTO_ATTACK_RANGE) {
      // Calculer la position intermédiaire (à portée d'attaque)
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        monster.sprite.x,
        monster.sprite.y
      );
      const targetX = monster.sprite.x - Math.cos(angle) * (this.AUTO_ATTACK_RANGE - 20);
      const targetY = monster.sprite.y - Math.sin(angle) * (this.AUTO_ATTACK_RANGE - 20);

      // Se déplacer vers la cible
      const speed = this.characterData.movementSpeed;
      const velocity = speed * (delta / 1000);
      const moveAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
      const nextX = this.player.x + Math.cos(moveAngle) * velocity;
      const nextY = this.player.y + Math.sin(moveAngle) * velocity;

      if (!this.checkCollision(nextX, nextY)) {
        this.player.x = Phaser.Math.Clamp(nextX, 0, this.mapData.width);
        this.player.y = Phaser.Math.Clamp(nextY, 0, this.mapData.height);
        this.updatePlayerBars();
      }
    } else {
      // À portée - attaquer avec le skill Q (attaque de base)
      const basicSkill = this.skills.get('Q');
      const cooldown = this.skillCooldowns.get('Q') ?? 0;

      if (basicSkill && cooldown <= 0) {
        // Lancer l'attaque vers le monstre
        this.handleSkillCast({
          slot: 'Q',
          skill: basicSkill,
          targetX: monster.sprite.x,
          targetY: monster.sprite.y,
        });
      }
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
    if (portal) {
      // Émettre l'événement de changement de map
      this.options.socket.emit('map:changeRequest', {
        targetMapCode: portal.targetMapCode,
      });
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
    // Vérifier le cooldown
    if ((this.skillCooldowns.get(data.slot) ?? 0) > 0) return;

    // Vérifier le mana
    if (this.characterData.mana < data.skill.manaCost) return;

    // Afficher le telegraph
    this.telegraphManager.activate(data.slot, data.skill, this.player.x, this.player.y);
  }

  private handleSkillCast(data: { slot: SkillSlot; skill: SkillData; targetX: number; targetY: number }): void {
    const { slot, skill, targetX, targetY } = data;

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
        monster.nameText.setPosition(monster.sprite.x, monster.sprite.y - 35);
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
    if (!data.id || data.id === this.characterData.id) return;

    const sprite = this.add.rectangle(data.positionX ?? 0, data.positionY ?? 0, 16, 32, 0xff6b6b);
    sprite.setOrigin(0.5, 0.90625); // Centre horizontal, 3px au-dessus du bas
    sprite.setDepth(8);

    const nameText = this.add.text(0, 0, data.name ?? 'Player', {
      fontSize: '12px',
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

    nameText.setPosition(sprite.x, sprite.y - 35);

    healthBar.clear();
    const healthPercent = (data.health ?? 100) / (data.maxHealth ?? 100);
    const barWidth = 40;
    const barHeight = 4;

    healthBar.fillStyle(0x333333);
    healthBar.fillRect(sprite.x - barWidth / 2, sprite.y - 41, barWidth, barHeight);

    healthBar.fillStyle(0x00ff00);
    healthBar.fillRect(sprite.x - barWidth / 2, sprite.y - 41, barWidth * healthPercent, barHeight);
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
      fontSize: '10px',
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
    healthBar.fillRect(sprite.x - barWidth / 2, sprite.y - 41, barWidth, barHeight);

    healthBar.fillStyle(healthPercent > 0.3 ? 0xff4444 : 0xff0000);
    healthBar.fillRect(sprite.x - barWidth / 2, sprite.y - 41, barWidth * healthPercent, barHeight);
  }

  // === Utilitaires ===

  private updatePlayerBars(): void {
    const x = this.player.x;
    const y = this.player.y;

    // Barre de vie
    this.playerHealthBar.clear();
    const healthPercent = this.characterData.health / this.characterData.maxHealth;
    const barWidth = 40;
    const barHeight = 4;

    this.playerHealthBar.fillStyle(0x333333);
    this.playerHealthBar.fillRect(x - barWidth / 2, y - 34, barWidth, barHeight);

    this.playerHealthBar.fillStyle(0x00ff00);
    this.playerHealthBar.fillRect(x - barWidth / 2, y - 34, barWidth * healthPercent, barHeight);

    // Barre de mana
    this.playerManaBar.clear();
    const manaPercent = this.characterData.mana / this.characterData.maxMana;

    this.playerManaBar.fillStyle(0x333333);
    this.playerManaBar.fillRect(x - barWidth / 2, y - 29, barWidth, barHeight);

    this.playerManaBar.fillStyle(0x0088ff);
    this.playerManaBar.fillRect(x - barWidth / 2, y - 29, barWidth * manaPercent, barHeight);
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
   * Affiche les tuiles de collision en surbrillance (debug)
   */
  private showCollisionDebug(layer: Phaser.Tilemaps.TilemapLayer): void {
    const debugGraphics = this.add.graphics();
    debugGraphics.setDepth(100);

    layer.renderDebug(debugGraphics, {
      tileColor: null, // Ne pas colorier les tuiles normales
      collidingTileColor: new Phaser.Display.Color(255, 0, 0, 100), // Rouge transparent pour les collisions
      faceColor: new Phaser.Display.Color(0, 255, 0, 100), // Vert pour les faces de collision
    });

    console.log('[MainScene] Collision debug visualization enabled');
  }

  /**
   * Vérifie la collision à une position donnée
   */
  private checkCollision(x: number, y: number): boolean {
    // Vérifier les limites de la map
    if (x < 0 || y < 0 || x > this.mapData.width || y > this.mapData.height) {
      return true;
    }

    // Vérifier le layer de collision
    if (this.collisionLayer) {
      const tile = this.collisionLayer.getTileAtWorldXY(x, y);
      if (tile && tile.index > 0) {
        return true; // Collision détectée
      }
    }

    return false;
  }

  /**
   * Nettoyage des ressources
   */
  private cleanup(): void {
    const socket = this.options.socket;

    socket.off('player:moved');
    socket.off('player:skillCast');
    socket.off('combat:damage');
    socket.off('monster:defeated');
    socket.off('monster:spawn');
    socket.off('monsters:initial');
    socket.off('monster:healthUpdate');
    socket.off('map:change');
    socket.off('player:reward');
    socket.off('player:joined');
    socket.off('player:left');
    socket.off('skills:bar');

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

    this.inputManager.destroy();
    this.telegraphManager.destroy();
    this.combatManager.destroy();
    this.mapLoader.destroy();
  }
}
