// Game Server - Serveur de jeu temps réel
// SekaiMMO v2.0

import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { appConfig } from '../config/env';
import { prisma } from '../config/prisma';
import { WeaponCode, DamageType, GuildRank } from '../generated/prisma';
import { characterService } from '../services/characterService';
import { combatService } from '../services/combatService';
import { inventoryService } from '../services/inventoryService';
import { skillService } from '../services/skillService';
import { guildService } from '../services/guildService';
import { bankService } from '../services/bankService';
import { MonsterSpawnManager } from './MonsterSpawnManager';
import { MonsterAI } from './MonsterAI';
import { LootManager } from './LootManager';

interface SocketAuthPayload {
  userId: number;
  email: string;
  characterId: number;
}

interface ConnectedPlayer {
  socketId: string;
  characterId: number;
  mapId: number;
  positionX: number;
  positionY: number;
  weaponCode: string;
}

// Schémas de validation
const movementSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const skillCastSchema = z.object({
  skillId: z.number().int().positive(),
  slot: z.string(),
  targetX: z.number(),
  targetY: z.number(),
});

const mapChangeSchema = z.object({
  targetMapCode: z.string(),
});

const chatMessageSchema = z.object({
  channel: z.enum(['local', 'guild', 'whisper']),
  content: z.string().max(500),
  targetName: z.string().optional(),
});

// Schémas pour inventaire et équipement
const equipItemSchema = z.object({
  itemId: z.number().int().positive(),
});

const dropItemSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const switchWeaponSchema = z.object({
  weaponCode: z.enum(['SWORD', 'SPEAR', 'DAGGER', 'BOW', 'STAFF', 'FIST']),
});

// Schémas pour les skills
const learnSkillSchema = z.object({
  skillId: z.number().int().positive(),
});

const assignSkillSchema = z.object({
  skillId: z.number().int().positive(),
  slot: z.enum(['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F']),
});

const unassignSkillSchema = z.object({
  slot: z.enum(['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F']),
});

// Schémas pour la guilde
const createGuildSchema = z.object({
  name: z.string().min(3).max(30),
  tag: z.string().min(2).max(5),
  description: z.string().max(500).optional(),
});

const guildInviteSchema = z.object({
  targetName: z.string(),
});

const guildKickSchema = z.object({
  targetCharacterId: z.number().int().positive(),
});

const guildRankSchema = z.object({
  targetCharacterId: z.number().int().positive(),
  rank: z.enum(['OFFICER', 'MEMBER']),
});

const guildGoldSchema = z.object({
  amount: z.number().int().positive(),
});

// Schémas pour la banque
const bankItemSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export class GameServer {
  private spawnManager: MonsterSpawnManager;
  private monsterAI: MonsterAI;
  private lootManager: LootManager;
  private connectedPlayers: Map<number, ConnectedPlayer> = new Map();
  private initializedMaps: Set<number> = new Set();

  constructor(private readonly io: Server) {
    this.spawnManager = new MonsterSpawnManager(io);
    this.monsterAI = new MonsterAI(io, this.spawnManager);
    this.lootManager = new LootManager();

    this.io.use(this.authenticateSocket);
    this.io.on('connection', (socket) => this.handleConnection(socket));

    // Démarrer les systèmes
    this.spawnManager.startRespawnLoop();
    this.monsterAI.start();

    console.log('[GameServer] Initialized');
  }

  /**
   * Authentification du socket
   */
  private authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined) ??
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);

      if (!token) {
        throw new Error('Authentication required');
      }

      const payload = jwt.verify(token, appConfig.jwtSecret) as SocketAuthPayload;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          character: {
            include: {
              equippedWeaponType: true,
            },
          },
        },
      });

      if (!user?.character) {
        throw new Error('Character not found');
      }

      socket.data.userId = user.id;
      socket.data.characterId = user.character.id;
      socket.data.character = user.character;

      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Unauthorized connection'));
    }
  };

  /**
   * Gestion d'une nouvelle connexion
   */
  private async handleConnection(socket: Socket) {
    const characterId = socket.data.characterId as number;
    const character = socket.data.character;

    console.log(`[GameServer] Player ${characterId} connected`);
    console.log(`[GameServer] Character data:`, {
      id: character.id,
      name: character.name,
      currentMapId: character.currentMapId,
      positionX: character.positionX,
      positionY: character.positionY,
    });

    // Créer/mettre à jour la session
    await prisma.playerSession.upsert({
      where: { characterId },
      update: {
        socketId: socket.id,
        lastActive: new Date(),
      },
      create: {
        characterId,
        socketId: socket.id,
      },
    });

    // Récupérer la map du joueur
    const mapId = character.currentMapId ?? 1;
    console.log(`[GameServer] Player ${characterId} joining map ${mapId}`);

    // Charger les données de la map depuis la DB
    const mapData = await prisma.gameMap.findUnique({
      where: { id: mapId },
    });

    if (mapData) {
      console.log(`[GameServer] Map found:`, {
        id: mapData.id,
        code: mapData.code,
        name: mapData.name,
        width: mapData.width,
        height: mapData.height,
      });

      // Envoyer les données de la map au client
      socket.emit('map:data', {
        id: mapData.id,
        code: mapData.code,
        name: mapData.name,
        width: mapData.width,
        height: mapData.height,
        pvpEnabled: mapData.pvpEnabled,
      });
    } else {
      console.error(`[GameServer] Map ${mapId} not found in database!`);
    }

    await this.joinMap(socket, mapId);

    // Enregistrer les handlers
    this.registerHandlers(socket);

    // Envoyer les monstres de la map
    const monsters = this.spawnManager.getMonstersOnMap(mapId);
    console.log(`[GameServer] Sending ${monsters.length} monsters to player ${characterId}`);
    socket.emit('monsters:initial', monsters.map((m) => ({
      spawnId: m.spawnId,
      monsterId: m.monsterId,
      name: m.name,
      level: m.level,
      health: m.health,
      maxHealth: m.maxHealth,
      positionX: m.positionX,
      positionY: m.positionY,
      element: m.element,
    })));

    // Envoyer les autres joueurs
    const otherPlayers = Array.from(this.connectedPlayers.values())
      .filter((p) => p.mapId === mapId && p.characterId !== characterId);

    console.log(`[GameServer] Sending ${otherPlayers.length} other players to player ${characterId}`);

    for (const player of otherPlayers) {
      const playerChar = await prisma.character.findUnique({
        where: { id: player.characterId },
        select: { id: true, name: true, health: true, maxHealth: true, positionX: true, positionY: true },
      });
      if (playerChar) {
        socket.emit('player:joined', { character: playerChar });
      }
    }

    console.log(`[GameServer] Player ${characterId} connection setup complete`);
  }

  /**
   * Rejoint une map
   */
  private async joinMap(socket: Socket, mapId: number): Promise<void> {
    const characterId = socket.data.characterId as number;
    const character = socket.data.character;

    console.log(`[GameServer] joinMap called for player ${characterId}, mapId=${mapId}`);

    // Quitter l'ancienne map
    const oldPlayer = this.connectedPlayers.get(characterId);
    if (oldPlayer) {
      console.log(`[GameServer] Player ${characterId} leaving map ${oldPlayer.mapId}`);
      socket.leave(`map:${oldPlayer.mapId}`);
      socket.to(`map:${oldPlayer.mapId}`).emit('player:left', { characterId });
      this.monsterAI.removePlayer(characterId);
    }

    // Rejoindre la nouvelle map
    socket.join(`map:${mapId}`);
    console.log(`[GameServer] Player ${characterId} joined room map:${mapId}`);

    // Initialiser la map si nécessaire
    if (!this.initializedMaps.has(mapId)) {
      console.log(`[GameServer] Map ${mapId} not initialized yet, initializing...`);
      await this.spawnManager.initializeMap(mapId);
      this.initializedMaps.add(mapId);

      // Initialiser l'AI pour les monstres de la map
      const monsters = this.spawnManager.getMonstersOnMap(mapId);
      console.log(`[GameServer] Initialized ${monsters.length} monsters AI for map ${mapId}`);
      for (const monster of monsters) {
        this.monsterAI.initializeMonster(monster);
      }
    } else {
      console.log(`[GameServer] Map ${mapId} already initialized`);
    }

    // Enregistrer le joueur
    this.connectedPlayers.set(characterId, {
      socketId: socket.id,
      characterId,
      mapId,
      positionX: character.positionX,
      positionY: character.positionY,
      weaponCode: character.equippedWeaponType?.code ?? 'SWORD',
    });

    // Mettre à jour la position dans l'AI
    this.monsterAI.updatePlayerPosition(characterId, mapId, character.positionX, character.positionY);

    // Notifier les autres joueurs
    socket.to(`map:${mapId}`).emit('player:joined', {
      character: {
        id: characterId,
        name: character.name,
        health: character.health,
        maxHealth: character.maxHealth,
        positionX: character.positionX,
        positionY: character.positionY,
      },
    });
  }

  /**
   * Enregistre les handlers d'événements
   */
  private registerHandlers(socket: Socket): void {
    const characterId = socket.data.characterId as number;

    // Mouvement
    socket.on('player:move', async (payload) => {
      try {
        const data = movementSchema.parse(payload);
        const player = this.connectedPlayers.get(characterId);
        if (!player) return;

        player.positionX = data.x;
        player.positionY = data.y;

        await characterService.updatePosition(characterId, data);
        this.monsterAI.updatePlayerPosition(characterId, player.mapId, data.x, data.y);

        socket.to(`map:${player.mapId}`).emit('player:moved', {
          characterId,
          position: data,
        });
      } catch (error) {
        console.error('[player:move]', error);
      }
    });

    // Cast de skill
    socket.on('skill:cast', async (payload) => {
      try {
        const data = skillCastSchema.parse(payload);
        await this.handleSkillCast(socket, characterId, data);
      } catch (error) {
        console.error('[skill:cast]', error);
      }
    });

    // Changement de map
    socket.on('map:changeRequest', async (payload) => {
      try {
        const data = mapChangeSchema.parse(payload);
        await this.handleMapChange(socket, characterId, data.targetMapCode);
      } catch (error) {
        console.error('[map:changeRequest]', error);
      }
    });

    // Chat
    socket.on('chat:message', async (payload) => {
      try {
        const data = chatMessageSchema.parse(payload);
        await this.handleChatMessage(socket, characterId, data);
      } catch (error) {
        console.error('[chat:message]', error);
      }
    });

    // Interaction
    socket.on('interact:check', async (payload) => {
      try {
        const player = this.connectedPlayers.get(characterId);
        if (!player) return;

        // Vérifier les NPCs à proximité
        const npcs = await prisma.nPC.findMany({
          where: { mapId: player.mapId },
        });

        for (const npc of npcs) {
          const distance = Math.sqrt(
            Math.pow(payload.x - npc.positionX, 2) + Math.pow(payload.y - npc.positionY, 2)
          );

          if (distance < 50) {
            socket.emit('npc:interact', {
              npcId: npc.id,
              name: npc.name,
              title: npc.title,
              isWeaponMaster: npc.isWeaponMaster,
              weaponMasterFor: npc.weaponMasterFor,
              isElementMaster: npc.isElementMaster,
              elementMasterFor: npc.elementMasterFor,
              isMerchant: npc.isMerchant,
              isBanker: npc.isBanker,
            });
            break;
          }
        }
      } catch (error) {
        console.error('[interact:check]', error);
      }
    });

    // ============================================
    // INVENTAIRE ET ÉQUIPEMENT
    // ============================================

    // Récupérer l'inventaire
    socket.on('inventory:get', async () => {
      try {
        const inventory = await inventoryService.getInventory(characterId);
        socket.emit('inventory:data', inventory);
      } catch (error) {
        console.error('[inventory:get]', error);
      }
    });

    // Équiper un item
    socket.on('inventory:equip', async (payload) => {
      try {
        const data = equipItemSchema.parse(payload);
        const item = await prisma.item.findUnique({
          where: { id: data.itemId },
          include: { weaponType: true },
        });
        if (!item || item.type !== 'WEAPON' || !item.weaponTypeId) {
          socket.emit('inventory:error', { reason: 'Not a valid weapon' });
          return;
        }

        await prisma.character.update({
          where: { id: characterId },
          data: { equippedWeaponTypeId: item.weaponTypeId },
        });

        const player = this.connectedPlayers.get(characterId);
        if (player && item.weaponType) {
          player.weaponCode = item.weaponType.code;
        }

        socket.emit('inventory:equipped', { itemId: data.itemId, weaponCode: item.weaponType?.code ?? null });
      } catch (error) {
        console.error('[inventory:equip]', error);
      }
    });

    // Jeter un item
    socket.on('inventory:drop', async (payload) => {
      try {
        const data = dropItemSchema.parse(payload);
        const inventoryItem = await prisma.inventoryItem.findUnique({
          where: { characterId_itemId: { characterId, itemId: data.itemId } },
        });

        if (!inventoryItem || inventoryItem.quantity < data.quantity) {
          socket.emit('inventory:error', { reason: 'Not enough items' });
          return;
        }

        if (inventoryItem.quantity === data.quantity) {
          await prisma.inventoryItem.delete({ where: { id: inventoryItem.id } });
        } else {
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { quantity: { decrement: data.quantity } },
          });
        }

        socket.emit('inventory:dropped', { itemId: data.itemId, quantity: data.quantity });
      } catch (error) {
        console.error('[inventory:drop]', error);
      }
    });

    // Changer d'arme
    socket.on('weapon:switch', async (payload) => {
      try {
        const data = switchWeaponSchema.parse(payload);

        // Trouver le type d'arme par son code
        const weaponType = await prisma.weaponType.findUnique({
          where: { code: data.weaponCode as any },
        });

        if (!weaponType) {
          socket.emit('weapon:error', { reason: 'Invalid weapon type' });
          return;
        }

        await prisma.character.update({
          where: { id: characterId },
          data: { equippedWeaponTypeId: weaponType.id },
        });

        const player = this.connectedPlayers.get(characterId);
        if (player) {
          player.weaponCode = data.weaponCode;
        }

        socket.emit('weapon:switched', { weaponCode: data.weaponCode });
        socket.to(`map:${player?.mapId}`).emit('player:weaponChanged', {
          characterId,
          weaponCode: data.weaponCode,
        });
      } catch (error) {
        console.error('[weapon:switch]', error);
      }
    });

    // ============================================
    // COMPÉTENCES
    // ============================================

    // Récupérer la barre de skills
    socket.on('skills:getBar', async () => {
      try {
        const skillBar = await skillService.getSkillBar(characterId);
        socket.emit('skills:bar', skillBar);
      } catch (error) {
        console.error('[skills:getBar]', error);
      }
    });

    // Récupérer tous les skills disponibles
    socket.on('skills:getAll', async () => {
      try {
        const skills = await skillService.listSkillsByCategory(characterId);
        socket.emit('skills:all', skills);
      } catch (error) {
        console.error('[skills:getAll]', error);
      }
    });

    // Apprendre un skill
    socket.on('skills:learn', async (payload) => {
      try {
        const data = learnSkillSchema.parse(payload);
        const result = await skillService.learnSkill(characterId, data.skillId);
        socket.emit('skills:learned', result);
      } catch (error: any) {
        socket.emit('skills:error', { reason: error.message || 'Cannot learn skill' });
      }
    });

    // Assigner un skill à un slot
    socket.on('skills:assign', async (payload) => {
      try {
        const data = assignSkillSchema.parse(payload);
        await skillService.assignSkillToSlot(characterId, data.skillId, data.slot);
        const skillBar = await skillService.getSkillBar(characterId);
        socket.emit('skills:bar', skillBar);
      } catch (error: any) {
        socket.emit('skills:error', { reason: error.message || 'Cannot assign skill' });
      }
    });

    // Retirer un skill d'un slot
    socket.on('skills:unassign', async (payload) => {
      try {
        const data = unassignSkillSchema.parse(payload);
        await skillService.unassignSkillFromSlot(characterId, data.slot);
        const skillBar = await skillService.getSkillBar(characterId);
        socket.emit('skills:bar', skillBar);
      } catch (error: any) {
        socket.emit('skills:error', { reason: error.message || 'Cannot unassign skill' });
      }
    });

    // ============================================
    // GUILDE
    // ============================================

    // Récupérer sa guilde
    socket.on('guild:get', async () => {
      try {
        const guildData = await guildService.getCharacterGuild(characterId);
        socket.emit('guild:data', guildData);
      } catch (error) {
        console.error('[guild:get]', error);
      }
    });

    // Créer une guilde
    socket.on('guild:create', async (payload) => {
      try {
        const data = createGuildSchema.parse(payload);
        const guild = await guildService.createGuild(
          characterId,
          data.name,
          data.tag,
          data.description
        );
        socket.emit('guild:created', guild);
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot create guild' });
      }
    });

    // Quitter la guilde
    socket.on('guild:leave', async () => {
      try {
        await guildService.leaveGuild(characterId);
        socket.emit('guild:left', { success: true });
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot leave guild' });
      }
    });

    // Inviter un joueur
    socket.on('guild:invite', async (payload) => {
      try {
        const data = guildInviteSchema.parse(payload);
        const target = await prisma.character.findFirst({
          where: { name: data.targetName },
        });

        if (!target) {
          socket.emit('guild:error', { reason: 'Player not found' });
          return;
        }

        await guildService.invitePlayer(characterId, target.id);

        // Notifier le joueur invité s'il est en ligne
        const targetPlayer = this.connectedPlayers.get(target.id);
        if (targetPlayer) {
          this.io.to(targetPlayer.socketId).emit('guild:invited', {
            guildId: (await guildService.getCharacterGuild(characterId))?.guild.id,
          });
        }

        socket.emit('guild:inviteSent', { targetName: data.targetName });
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot invite player' });
      }
    });

    // Exclure un membre
    socket.on('guild:kick', async (payload) => {
      try {
        const data = guildKickSchema.parse(payload);
        await guildService.kickMember(characterId, data.targetCharacterId);

        // Notifier le joueur exclu
        const targetPlayer = this.connectedPlayers.get(data.targetCharacterId);
        if (targetPlayer) {
          this.io.to(targetPlayer.socketId).emit('guild:kicked');
        }

        socket.emit('guild:kickSuccess', { targetId: data.targetCharacterId });
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot kick member' });
      }
    });

    // Changer le rang d'un membre
    socket.on('guild:setRank', async (payload) => {
      try {
        const data = guildRankSchema.parse(payload);
        await guildService.setMemberRank(characterId, data.targetCharacterId, data.rank as GuildRank);
        const guildData = await guildService.getCharacterGuild(characterId);
        socket.emit('guild:data', guildData);
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot change rank' });
      }
    });

    // Déposer de l'or dans la guilde
    socket.on('guild:depositGold', async (payload) => {
      try {
        const data = guildGoldSchema.parse(payload);
        await guildService.depositGold(characterId, data.amount);
        const guildData = await guildService.getCharacterGuild(characterId);
        socket.emit('guild:data', guildData);
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot deposit gold' });
      }
    });

    // Retirer de l'or de la guilde
    socket.on('guild:withdrawGold', async (payload) => {
      try {
        const data = guildGoldSchema.parse(payload);
        await guildService.withdrawGold(characterId, data.amount);
        const guildData = await guildService.getCharacterGuild(characterId);
        socket.emit('guild:data', guildData);
      } catch (error: any) {
        socket.emit('guild:error', { reason: error.message || 'Cannot withdraw gold' });
      }
    });

    // ============================================
    // BANQUE PERSONNELLE
    // ============================================

    // Récupérer le contenu de la banque
    socket.on('bank:get', async () => {
      try {
        const [contents, stats] = await Promise.all([
          bankService.getBankContents(characterId),
          bankService.getBankStats(characterId),
        ]);
        socket.emit('bank:data', { contents, stats });
      } catch (error) {
        console.error('[bank:get]', error);
      }
    });

    // Déposer un item
    socket.on('bank:deposit', async (payload) => {
      try {
        const data = bankItemSchema.parse(payload);
        await bankService.depositItem(characterId, data.itemId, data.quantity);
        const [contents, stats, inventory] = await Promise.all([
          bankService.getBankContents(characterId),
          bankService.getBankStats(characterId),
          inventoryService.getInventory(characterId),
        ]);
        socket.emit('bank:data', { contents, stats });
        socket.emit('inventory:data', inventory);
      } catch (error: any) {
        socket.emit('bank:error', { reason: error.message || 'Cannot deposit' });
      }
    });

    // Retirer un item
    socket.on('bank:withdraw', async (payload) => {
      try {
        const data = bankItemSchema.parse(payload);
        await bankService.withdrawItem(characterId, data.itemId, data.quantity);
        const [contents, stats, inventory] = await Promise.all([
          bankService.getBankContents(characterId),
          bankService.getBankStats(characterId),
          inventoryService.getInventory(characterId),
        ]);
        socket.emit('bank:data', { contents, stats });
        socket.emit('inventory:data', inventory);
      } catch (error: any) {
        socket.emit('bank:error', { reason: error.message || 'Cannot withdraw' });
      }
    });

    // ============================================
    // STATISTIQUES PERSONNAGE
    // ============================================

    // Récupérer les stats du personnage
    socket.on('character:getStats', async () => {
      try {
        const character = await prisma.character.findUnique({
          where: { id: characterId },
          include: {
            weaponProgress: true,
            elementProgress: true,
          },
        });
        socket.emit('character:stats', character);
      } catch (error) {
        console.error('[character:getStats]', error);
      }
    });

    // Récupérer les progressions d'armes
    socket.on('character:getWeaponProgress', async () => {
      try {
        const progress = await prisma.characterWeaponProgress.findMany({
          where: { characterId },
        });
        socket.emit('character:weaponProgress', progress);
      } catch (error) {
        console.error('[character:getWeaponProgress]', error);
      }
    });

    // Récupérer les progressions d'éléments
    socket.on('character:getElementProgress', async () => {
      try {
        const progress = await prisma.characterElementProgress.findMany({
          where: { characterId },
        });
        socket.emit('character:elementProgress', progress);
      } catch (error) {
        console.error('[character:getElementProgress]', error);
      }
    });

    // ============================================
    // DÉCONNEXION
    // ============================================

    // Déconnexion
    socket.on('disconnect', async () => {
      console.log(`[GameServer] Player ${characterId} disconnected`);

      const player = this.connectedPlayers.get(characterId);
      if (player) {
        socket.to(`map:${player.mapId}`).emit('player:left', { characterId });
        this.monsterAI.removePlayer(characterId);
        this.connectedPlayers.delete(characterId);
      }

      await prisma.playerSession.deleteMany({ where: { characterId } });
    });
  }

  /**
   * Gère le cast d'un skill
   */
  private async handleSkillCast(
    socket: Socket,
    characterId: number,
    data: { skillId: number; slot: string; targetX: number; targetY: number }
  ): Promise<void> {
    const player = this.connectedPlayers.get(characterId);
    if (!player) return;

    // Récupérer le skill et le personnage
    const [skill, character] = await Promise.all([
      prisma.skill.findUnique({ where: { id: data.skillId } }),
      prisma.character.findUnique({ where: { id: characterId } }),
    ]);

    if (!skill || !character) return;

    // Vérifier le mana
    if (character.mana < skill.manaCost) {
      socket.emit('skill:failed', { reason: 'Not enough mana' });
      return;
    }

    // Déduire le mana
    await prisma.character.update({
      where: { id: characterId },
      data: { mana: { decrement: skill.manaCost } },
    });

    // Émettre le cast aux autres joueurs
    this.io.to(`map:${player.mapId}`).emit('player:skillCast', {
      characterId,
      skillId: skill.id,
      slot: data.slot,
      targetX: data.targetX,
      targetY: data.targetY,
    });

    // Calculer les dégâts et les cibles (monstres dans la zone)
    const monsters = this.spawnManager.getMonstersOnMap(player.mapId);
    const hitMonsters = this.getTargetsInArea(
      data.targetX,
      data.targetY,
      skill.areaOfEffect,
      skill.telegraphShape ?? 'circle',
      player.positionX,
      player.positionY,
      skill.range,
      monsters
    );

    // Statistiques du joueur pour le calcul de dégâts
    const attackerStats = {
      physicalAttack: character.physicalAttack,
      magicalAttack: character.magicalAttack,
      physicalDefense: character.physicalDefense,
      magicalDefense: character.magicalDefense,
      physicalPenetration: character.physicalPenetration,
      magicalPenetration: character.magicalPenetration,
      critChance: character.critChance,
      critDamage: character.critDamage,
    };

    // Infliger les dégâts aux monstres touchés
    for (const monster of hitMonsters) {
      const defenderStats = {
        physicalAttack: monster.physicalAttack,
        magicalAttack: monster.magicalAttack,
        physicalDefense: monster.physicalDefense,
        magicalDefense: monster.magicalDefense,
        physicalPenetration: 0,
        magicalPenetration: 0,
        critChance: 0,
        critDamage: 1.5,
      };

      const damageResult = combatService.calculateDamage(
        attackerStats,
        defenderStats,
        skill.baseDamage,
        skill.damageScaling,
        skill.damageType as DamageType
      );

      const { killed, actualDamage } = this.spawnManager.damageMonster(
        monster.spawnId,
        damageResult.damage,
        characterId
      );

      // Émettre l'événement de dégâts
      this.io.to(`map:${player.mapId}`).emit('combat:damage', {
        targetId: monster.spawnId,
        targetType: 'monster',
        damage: actualDamage,
        isCritical: damageResult.isCritical,
        damageType: skill.damageType,
        element: skill.element,
      });

      // Si le monstre est tué
      if (killed) {
        await this.handleMonsterKill(socket, characterId, monster);
      }
    }
  }

  /**
   * Gère la mort d'un monstre
   */
  private async handleMonsterKill(
    socket: Socket,
    characterId: number,
    monster: { spawnId: number; monsterId: number; mapId: number; baseExperience: number; baseGold: number } | import('./MonsterSpawnManager').SpawnedMonster
  ): Promise<void> {
    const player = this.connectedPlayers.get(characterId);
    if (!player) return;

    const character = await prisma.character.findUnique({ where: { id: characterId } });
    if (!character) return;

    // Calculer les récompenses
    const fullMonster = this.spawnManager.getMonster(monster.spawnId);
    if (!fullMonster) return;

    const rewards = await this.lootManager.calculateRewards(
      fullMonster,
      character.level,
      player.weaponCode as WeaponCode
    );

    // Appliquer les récompenses
    await this.lootManager.applyRewards(characterId, rewards, player.weaponCode as WeaponCode);

    // Émettre les événements
    this.io.to(`map:${player.mapId}`).emit('monster:defeated', {
      spawnId: monster.spawnId,
      monsterId: monster.monsterId,
      defeatedBy: characterId,
      experience: rewards.experience,
      gold: rewards.gold,
      drops: rewards.drops,
    });

    socket.emit('player:reward', {
      experience: rewards.experience,
      gold: rewards.gold,
      drops: rewards.drops,
    });
  }

  /**
   * Trouve les cibles dans une zone
   */
  private getTargetsInArea<T extends { spawnId: number; positionX: number; positionY: number }>(
    targetX: number,
    targetY: number,
    areaSize: number,
    shape: string,
    originX: number,
    originY: number,
    range: number,
    monsters: T[]
  ): T[] {
    return monsters.filter((m) => {
      const distToTarget = Math.sqrt(
        Math.pow(m.positionX - targetX, 2) + Math.pow(m.positionY - targetY, 2)
      );

      switch (shape) {
        case 'circle':
          return distToTarget <= areaSize;

        case 'line':
          // Vérifier si le monstre est sur la ligne entre origin et target
          const lineAngle = Math.atan2(targetY - originY, targetX - originX);
          const monsterAngle = Math.atan2(m.positionY - originY, m.positionX - originX);
          const angleDiff = Math.abs(lineAngle - monsterAngle);
          const distToOrigin = Math.sqrt(
            Math.pow(m.positionX - originX, 2) + Math.pow(m.positionY - originY, 2)
          );
          return angleDiff < 0.2 && distToOrigin <= range;

        case 'cone':
          // Vérifier si le monstre est dans le cône
          const coneAngle = Math.atan2(targetY - originY, targetX - originX);
          const mAngle = Math.atan2(m.positionY - originY, m.positionX - originX);
          const aDiff = Math.abs(coneAngle - mAngle);
          const coneWidth = (areaSize / 180) * Math.PI; // areaSize en degrés
          const dToOrigin = Math.sqrt(
            Math.pow(m.positionX - originX, 2) + Math.pow(m.positionY - originY, 2)
          );
          return aDiff <= coneWidth / 2 && dToOrigin <= range;

        default:
          return distToTarget <= areaSize;
      }
    });
  }

  /**
   * Gère le changement de map
   */
  private async handleMapChange(
    socket: Socket,
    characterId: number,
    targetMapCode: string
  ): Promise<void> {
    const map = await prisma.gameMap.findUnique({
      where: { code: targetMapCode },
    });

    if (!map) {
      socket.emit('map:changeFailed', { reason: 'Map not found' });
      return;
    }

    // Trouver le portail de destination
    const defaultX = map.width / 2;
    const defaultY = map.height / 2;

    // Mettre à jour la position du personnage
    await prisma.character.update({
      where: { id: characterId },
      data: {
        currentMapId: map.id,
        positionX: defaultX,
        positionY: defaultY,
      },
    });

    // Mettre à jour le character dans socket.data
    socket.data.character = {
      ...socket.data.character,
      currentMapId: map.id,
      positionX: defaultX,
      positionY: defaultY,
    };

    // Rejoindre la nouvelle map
    await this.joinMap(socket, map.id);

    // Notifier le client
    socket.emit('map:change', {
      mapCode: map.code,
      mapId: map.id,
      positionX: defaultX,
      positionY: defaultY,
    });

    // Envoyer les monstres de la nouvelle map
    const monsters = this.spawnManager.getMonstersOnMap(map.id);
    socket.emit('monsters:initial', monsters.map((m) => ({
      spawnId: m.spawnId,
      monsterId: m.monsterId,
      name: m.name,
      level: m.level,
      health: m.health,
      maxHealth: m.maxHealth,
      positionX: m.positionX,
      positionY: m.positionY,
      element: m.element,
    })));
  }

  /**
   * Gère les messages de chat
   */
  private async handleChatMessage(
    socket: Socket,
    characterId: number,
    data: { channel: string; content: string; targetName?: string }
  ): Promise<void> {
    const player = this.connectedPlayers.get(characterId);
    if (!player) return;

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { name: true },
    });

    if (!character) return;

    const message = {
      senderId: characterId,
      senderName: character.name,
      channel: data.channel,
      content: data.content,
      timestamp: new Date(),
    };

    switch (data.channel) {
      case 'local':
        this.io.to(`map:${player.mapId}`).emit('chat:message', message);
        break;

      case 'guild':
        // TODO: Envoyer à la guilde
        socket.emit('chat:message', { ...message, isSystem: true, content: 'Guild chat not implemented yet' });
        break;

      case 'whisper':
        if (data.targetName) {
          const target = await prisma.character.findFirst({
            where: { name: data.targetName },
            include: { user: { include: { character: true } } },
          });

          if (target) {
            const targetPlayer = this.connectedPlayers.get(target.id);
            if (targetPlayer) {
              this.io.to(targetPlayer.socketId).emit('chat:message', {
                ...message,
                channel: 'whisper',
              });
              socket.emit('chat:message', {
                ...message,
                channel: 'whisper',
                content: `À ${data.targetName}: ${data.content}`,
              });
            } else {
              socket.emit('chat:message', {
                ...message,
                isSystem: true,
                content: `${data.targetName} n'est pas en ligne.`,
              });
            }
          }
        }
        break;
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    this.spawnManager.destroy();
    this.monsterAI.destroy();
    this.connectedPlayers.clear();
  }
}
