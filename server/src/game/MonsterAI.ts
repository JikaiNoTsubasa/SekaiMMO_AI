// Monster AI - Intelligence artificielle des monstres
// SekaiMMO v2.0

import type { Server } from 'socket.io';
import type { SpawnedMonster, MonsterSpawnManager } from './MonsterSpawnManager';

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'return';

export interface PlayerPosition {
  characterId: number;
  mapId: number;
  x: number;
  y: number;
}

export interface MonsterAIState {
  spawnId: number;
  state: AIState;
  targetId: number | null;
  lastAttackTime: number;
  patrolTarget: { x: number; y: number } | null;
  stateStartTime: number;
}

export class MonsterAI {
  private aiStates: Map<number, MonsterAIState> = new Map();
  private playerPositions: Map<number, PlayerPosition> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 200; // ms entre chaque update

  // Configuration AI
  private readonly PATROL_RADIUS = 150; // Distance max de patrouille
  private readonly CHASE_TIMEOUT = 5000; // Temps avant abandon de poursuite
  private readonly LEASH_DISTANCE = 400; // Distance max avant retour au spawn
  private readonly ATTACK_COOLDOWN = 1500; // ms entre attaques

  constructor(
    private readonly io: Server,
    private readonly spawnManager: MonsterSpawnManager
  ) {}

  /**
   * Initialise l'IA pour un monstre
   */
  initializeMonster(monster: SpawnedMonster): void {
    this.aiStates.set(monster.spawnId, {
      spawnId: monster.spawnId,
      state: 'idle',
      targetId: null,
      lastAttackTime: 0,
      patrolTarget: null,
      stateStartTime: Date.now(),
    });
  }

  /**
   * Met à jour la position d'un joueur
   */
  updatePlayerPosition(characterId: number, mapId: number, x: number, y: number): void {
    this.playerPositions.set(characterId, { characterId, mapId, x, y });
  }

  /**
   * Retire un joueur (déconnexion ou changement de map)
   */
  removePlayer(characterId: number): void {
    this.playerPositions.delete(characterId);

    // Reset l'aggro des monstres qui ciblaient ce joueur
    for (const state of this.aiStates.values()) {
      if (state.targetId === characterId) {
        state.targetId = null;
        state.state = 'return';
        state.stateStartTime = Date.now();
      }
    }
  }

  /**
   * Démarre la boucle d'update AI
   */
  start(): void {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.update();
    }, this.TICK_RATE);

    console.log('[MonsterAI] Started');
  }

  /**
   * Arrête la boucle d'update
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Boucle principale d'update
   */
  private update(): void {
    const now = Date.now();

    for (const state of this.aiStates.values()) {
      const monster = this.spawnManager.getMonster(state.spawnId);
      if (!monster || monster.isDead) continue;

      switch (state.state) {
        case 'idle':
          this.updateIdle(monster, state, now);
          break;
        case 'patrol':
          this.updatePatrol(monster, state, now);
          break;
        case 'chase':
          this.updateChase(monster, state, now);
          break;
        case 'attack':
          this.updateAttack(monster, state, now);
          break;
        case 'return':
          this.updateReturn(monster, state, now);
          break;
      }
    }
  }

  /**
   * État Idle: vérifie l'aggro, passe en patrouille aléatoirement
   */
  private updateIdle(monster: SpawnedMonster, state: MonsterAIState, now: number): void {
    // Vérifier si un joueur est dans la zone d'aggro
    const nearestPlayer = this.findNearestPlayerInRange(monster, monster.aggroRange);
    if (nearestPlayer) {
      state.targetId = nearestPlayer.characterId;
      state.state = 'chase';
      state.stateStartTime = now;
      return;
    }

    // Passer en patrouille après un certain temps
    if (now - state.stateStartTime > 3000 + Math.random() * 2000) {
      state.state = 'patrol';
      state.patrolTarget = this.generatePatrolTarget(monster);
      state.stateStartTime = now;
    }
  }

  /**
   * État Patrol: se déplace vers un point aléatoire
   */
  private updatePatrol(monster: SpawnedMonster, state: MonsterAIState, now: number): void {
    // Vérifier l'aggro
    const nearestPlayer = this.findNearestPlayerInRange(monster, monster.aggroRange);
    if (nearestPlayer) {
      state.targetId = nearestPlayer.characterId;
      state.state = 'chase';
      state.stateStartTime = now;
      return;
    }

    // Se déplacer vers la cible de patrouille
    if (state.patrolTarget) {
      const distance = this.getDistance(
        monster.positionX, monster.positionY,
        state.patrolTarget.x, state.patrolTarget.y
      );

      if (distance < 10) {
        // Arrivé à destination, retour en idle
        state.state = 'idle';
        state.patrolTarget = null;
        state.stateStartTime = now;
      } else {
        // Continuer à se déplacer
        this.moveTowards(monster, state.patrolTarget.x, state.patrolTarget.y);
      }
    } else {
      state.state = 'idle';
      state.stateStartTime = now;
    }

    // Timeout de patrouille
    if (now - state.stateStartTime > 5000) {
      state.state = 'idle';
      state.patrolTarget = null;
      state.stateStartTime = now;
    }
  }

  /**
   * État Chase: poursuit le joueur
   */
  private updateChase(monster: SpawnedMonster, state: MonsterAIState, now: number): void {
    if (!state.targetId) {
      state.state = 'return';
      state.stateStartTime = now;
      return;
    }

    const target = this.playerPositions.get(state.targetId);
    if (!target || target.mapId !== monster.mapId) {
      state.targetId = null;
      state.state = 'return';
      state.stateStartTime = now;
      return;
    }

    const distanceToTarget = this.getDistance(
      monster.positionX, monster.positionY,
      target.x, target.y
    );

    const distanceToSpawn = this.getDistance(
      monster.positionX, monster.positionY,
      monster.spawnX, monster.spawnY
    );

    // Vérifier le leash (distance max du spawn)
    if (distanceToSpawn > this.LEASH_DISTANCE) {
      state.targetId = null;
      state.state = 'return';
      state.stateStartTime = now;
      return;
    }

    // Timeout de poursuite
    if (now - state.stateStartTime > this.CHASE_TIMEOUT) {
      state.targetId = null;
      state.state = 'return';
      state.stateStartTime = now;
      return;
    }

    // Si à portée d'attaque, passer en mode attaque
    if (distanceToTarget <= monster.attackRange) {
      state.state = 'attack';
      state.stateStartTime = now;
    } else {
      // Continuer la poursuite
      this.moveTowards(monster, target.x, target.y);
      state.stateStartTime = now; // Reset le timeout
    }
  }

  /**
   * État Attack: attaque le joueur
   */
  private updateAttack(monster: SpawnedMonster, state: MonsterAIState, now: number): void {
    if (!state.targetId) {
      state.state = 'return';
      state.stateStartTime = now;
      return;
    }

    const target = this.playerPositions.get(state.targetId);
    if (!target || target.mapId !== monster.mapId) {
      state.targetId = null;
      state.state = 'return';
      state.stateStartTime = now;
      return;
    }

    const distanceToTarget = this.getDistance(
      monster.positionX, monster.positionY,
      target.x, target.y
    );

    // Si la cible est hors de portée, repasser en chase
    if (distanceToTarget > monster.attackRange * 1.2) {
      state.state = 'chase';
      state.stateStartTime = now;
      return;
    }

    // Calculer le cooldown basé sur l'attack speed
    const attackCooldown = this.ATTACK_COOLDOWN / monster.attackSpeed;

    // Attaquer si le cooldown est passé
    if (now - state.lastAttackTime >= attackCooldown) {
      this.performAttack(monster, state.targetId);
      state.lastAttackTime = now;
    }
  }

  /**
   * État Return: retourne au point de spawn
   */
  private updateReturn(monster: SpawnedMonster, state: MonsterAIState, now: number): void {
    const distanceToSpawn = this.getDistance(
      monster.positionX, monster.positionY,
      monster.spawnX, monster.spawnY
    );

    if (distanceToSpawn < 20) {
      // Arrivé au spawn, restaurer la vie et passer en idle
      monster.health = monster.maxHealth;
      state.state = 'idle';
      state.stateStartTime = now;

      this.io.to(`map:${monster.mapId}`).emit('monster:healthUpdate', {
        spawnId: monster.spawnId,
        health: monster.health,
        maxHealth: monster.maxHealth,
      });
    } else {
      // Continuer à retourner au spawn (plus rapide)
      this.moveTowards(monster, monster.spawnX, monster.spawnY, 1.5);
    }
  }

  /**
   * Effectue une attaque sur un joueur
   */
  private performAttack(monster: SpawnedMonster, targetId: number): void {
    // Calculer les dégâts (physique ou magique selon le monstre)
    const isPhysical = monster.physicalAttack > monster.magicalAttack;
    const baseDamage = isPhysical ? monster.physicalAttack : monster.magicalAttack;

    // Variation des dégâts (±15%)
    const variance = 0.85 + Math.random() * 0.3;
    const damage = Math.round(baseDamage * variance);

    // Émettre l'événement d'attaque
    this.io.to(`map:${monster.mapId}`).emit('monster:attack', {
      spawnId: monster.spawnId,
      targetId,
      damage,
      damageType: isPhysical ? 'PHYSICAL' : 'MAGICAL',
      element: monster.element,
    });
  }

  /**
   * Trouve le joueur le plus proche dans une portée
   */
  private findNearestPlayerInRange(monster: SpawnedMonster, range: number): PlayerPosition | null {
    let nearest: PlayerPosition | null = null;
    let nearestDistance = range;

    for (const player of this.playerPositions.values()) {
      if (player.mapId !== monster.mapId) continue;

      const distance = this.getDistance(
        monster.positionX, monster.positionY,
        player.x, player.y
      );

      if (distance < nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  /**
   * Génère un point de patrouille aléatoire
   */
  private generatePatrolTarget(monster: SpawnedMonster): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.PATROL_RADIUS;

    return {
      x: monster.spawnX + Math.cos(angle) * distance,
      y: monster.spawnY + Math.sin(angle) * distance,
    };
  }

  /**
   * Déplace un monstre vers une position
   */
  private moveTowards(
    monster: SpawnedMonster,
    targetX: number,
    targetY: number,
    speedMultiplier: number = 1
  ): void {
    const dx = targetX - monster.positionX;
    const dy = targetY - monster.positionY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) return;

    const speed = monster.movementSpeed * speedMultiplier * (this.TICK_RATE / 1000);
    const moveDistance = Math.min(speed, distance);

    const newX = monster.positionX + (dx / distance) * moveDistance;
    const newY = monster.positionY + (dy / distance) * moveDistance;

    this.spawnManager.updateMonsterPosition(monster.spawnId, newX, newY);
  }

  /**
   * Calcule la distance entre deux points
   */
  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Retire un monstre de l'AI
   */
  removeMonster(spawnId: number): void {
    this.aiStates.delete(spawnId);
  }

  /**
   * Nettoie toutes les ressources
   */
  destroy(): void {
    this.stop();
    this.aiStates.clear();
    this.playerPositions.clear();
  }
}
