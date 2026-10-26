"use strict";
// Monster Spawn Manager - Gestion du spawn des monstres
// SekaiMMO v2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonsterSpawnManager = void 0;
const prisma_1 = require("../config/prisma");
class MonsterSpawnManager {
    constructor(io) {
        this.io = io;
        this.monsters = new Map();
        this.spawnPoints = new Map();
        this.spawnCounter = 0;
        this.updateInterval = null;
    }
    /**
     * Initialise le spawn manager pour une map
     */
    async initializeMap(mapId) {
        // Charger les points de spawn de la map
        const spawns = await prisma_1.prisma.monsterSpawn.findMany({
            where: { mapId },
            include: { monster: true },
        });
        for (const spawn of spawns) {
            const spawnPoint = {
                id: spawn.id,
                mapId: spawn.mapId,
                monsterId: spawn.monsterId,
                positionX: spawn.positionX,
                positionY: spawn.positionY,
                patrolRadius: spawn.patrolRadius,
                maxCount: spawn.maxCount,
                respawnSeconds: spawn.monster.respawnTime,
            };
            this.spawnPoints.set(spawn.id, spawnPoint);
            // Spawn initial des monstres
            for (let i = 0; i < spawn.maxCount; i++) {
                this.spawnMonster(spawnPoint, spawn.monster);
            }
        }
        console.log(`[SpawnManager] Map ${mapId}: ${this.monsters.size} monsters spawned`);
    }
    /**
     * Spawn un monstre à un point de spawn
     */
    spawnMonster(spawnPoint, monsterData) {
        this.spawnCounter++;
        const spawnId = this.spawnCounter;
        // Position aléatoire dans le rayon de patrouille
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * spawnPoint.patrolRadius;
        const positionX = spawnPoint.positionX + Math.cos(angle) * radius;
        const positionY = spawnPoint.positionY + Math.sin(angle) * radius;
        const monster = {
            spawnId,
            monsterId: monsterData.id,
            mapId: spawnPoint.mapId,
            name: monsterData.name,
            level: monsterData.level,
            health: monsterData.health,
            maxHealth: monsterData.health,
            positionX,
            positionY,
            spawnX: positionX,
            spawnY: positionY,
            element: monsterData.element,
            baseExperience: monsterData.baseExperience,
            baseGold: monsterData.baseGold,
            physicalAttack: monsterData.physicalAttack,
            magicalAttack: monsterData.magicalAttack,
            physicalDefense: monsterData.physicalDefense,
            magicalDefense: monsterData.magicalDefense,
            attackSpeed: monsterData.attackSpeed,
            movementSpeed: monsterData.movementSpeed,
            attackRange: monsterData.attackRange,
            aggroRange: monsterData.aggroRange,
            isDead: false,
            respawnTime: spawnPoint.respawnSeconds * 1000,
            respawnAt: null,
        };
        this.monsters.set(spawnId, monster);
        // Émettre l'événement de spawn
        this.io.to(`map:${spawnPoint.mapId}`).emit('monster:spawn', {
            spawnId: monster.spawnId,
            monsterId: monster.monsterId,
            name: monster.name,
            level: monster.level,
            health: monster.health,
            maxHealth: monster.maxHealth,
            positionX: monster.positionX,
            positionY: monster.positionY,
            element: monster.element,
        });
        return monster;
    }
    /**
     * Inflige des dégâts à un monstre
     */
    damageMonster(spawnId, damage, attackerId) {
        const monster = this.monsters.get(spawnId);
        if (!monster || monster.isDead) {
            return { killed: false, monster: null, actualDamage: 0 };
        }
        const actualDamage = Math.min(damage, monster.health);
        monster.health -= actualDamage;
        // Émettre la mise à jour de santé
        this.io.to(`map:${monster.mapId}`).emit('monster:healthUpdate', {
            spawnId: monster.spawnId,
            health: monster.health,
            maxHealth: monster.maxHealth,
        });
        if (monster.health <= 0) {
            monster.isDead = true;
            monster.health = 0;
            monster.respawnAt = Date.now() + monster.respawnTime;
            return { killed: true, monster, actualDamage };
        }
        return { killed: false, monster, actualDamage };
    }
    /**
     * Récupère un monstre par son spawnId
     */
    getMonster(spawnId) {
        return this.monsters.get(spawnId);
    }
    /**
     * Récupère tous les monstres d'une map
     */
    getMonstersOnMap(mapId) {
        return Array.from(this.monsters.values()).filter((m) => m.mapId === mapId && !m.isDead);
    }
    /**
     * Met à jour la position d'un monstre
     */
    updateMonsterPosition(spawnId, x, y) {
        const monster = this.monsters.get(spawnId);
        if (monster && !monster.isDead) {
            monster.positionX = x;
            monster.positionY = y;
            this.io.to(`map:${monster.mapId}`).emit('monster:moved', {
                spawnId: monster.spawnId,
                positionX: x,
                positionY: y,
            });
        }
    }
    /**
     * Démarre la boucle de respawn
     */
    startRespawnLoop() {
        if (this.updateInterval)
            return;
        this.updateInterval = setInterval(() => {
            this.checkRespawns();
        }, 1000);
    }
    /**
     * Vérifie et respawn les monstres morts
     */
    async checkRespawns() {
        const now = Date.now();
        for (const monster of this.monsters.values()) {
            if (monster.isDead && monster.respawnAt && now >= monster.respawnAt) {
                // Respawn du monstre
                monster.health = monster.maxHealth;
                monster.isDead = false;
                monster.respawnAt = null;
                // Position aléatoire proche du spawn original
                const offsetX = (Math.random() - 0.5) * 100;
                const offsetY = (Math.random() - 0.5) * 100;
                monster.positionX = monster.spawnX + offsetX;
                monster.positionY = monster.spawnY + offsetY;
                // Émettre l'événement de spawn
                this.io.to(`map:${monster.mapId}`).emit('monster:spawn', {
                    spawnId: monster.spawnId,
                    monsterId: monster.monsterId,
                    name: monster.name,
                    level: monster.level,
                    health: monster.health,
                    maxHealth: monster.maxHealth,
                    positionX: monster.positionX,
                    positionY: monster.positionY,
                    element: monster.element,
                });
            }
        }
    }
    /**
     * Arrête la boucle de respawn
     */
    stopRespawnLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    /**
     * Nettoie les monstres d'une map
     */
    clearMap(mapId) {
        for (const [spawnId, monster] of this.monsters.entries()) {
            if (monster.mapId === mapId) {
                this.monsters.delete(spawnId);
            }
        }
        for (const [id, spawn] of this.spawnPoints.entries()) {
            if (spawn.mapId === mapId) {
                this.spawnPoints.delete(id);
            }
        }
    }
    /**
     * Nettoie toutes les ressources
     */
    destroy() {
        this.stopRespawnLoop();
        this.monsters.clear();
        this.spawnPoints.clear();
    }
}
exports.MonsterSpawnManager = MonsterSpawnManager;
