"use strict";
// Game Server - Serveur de jeu temps réel
// SekaiMMO v2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameServer = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const env_1 = require("../config/env");
const prisma_1 = require("../config/prisma");
const characterService_1 = require("../services/characterService");
const combatService_1 = require("../services/combatService");
const inventoryService_1 = require("../services/inventoryService");
const skillService_1 = require("../services/skillService");
const guildService_1 = require("../services/guildService");
const bankService_1 = require("../services/bankService");
const MonsterSpawnManager_1 = require("./MonsterSpawnManager");
const MonsterAI_1 = require("./MonsterAI");
const LootManager_1 = require("./LootManager");
// Schémas de validation
const movementSchema = zod_1.z.object({
    x: zod_1.z.number(),
    y: zod_1.z.number(),
});
const skillCastSchema = zod_1.z.object({
    skillId: zod_1.z.number().int().positive(),
    slot: zod_1.z.string(),
    targetX: zod_1.z.number(),
    targetY: zod_1.z.number(),
});
const mapChangeSchema = zod_1.z.object({
    targetMapCode: zod_1.z.string(),
});
const chatMessageSchema = zod_1.z.object({
    channel: zod_1.z.enum(['local', 'guild', 'whisper']),
    content: zod_1.z.string().max(500),
    targetName: zod_1.z.string().optional(),
});
// Schémas pour inventaire et équipement
const equipItemSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().positive(),
});
const dropItemSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
});
const switchWeaponSchema = zod_1.z.object({
    weaponCode: zod_1.z.enum(['SWORD', 'SPEAR', 'DAGGER', 'BOW', 'STAFF', 'FIST']),
});
// Schémas pour les skills
const learnSkillSchema = zod_1.z.object({
    skillId: zod_1.z.number().int().positive(),
});
const assignSkillSchema = zod_1.z.object({
    skillId: zod_1.z.number().int().positive(),
    slot: zod_1.z.enum(['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F']),
});
const unassignSkillSchema = zod_1.z.object({
    slot: zod_1.z.enum(['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F']),
});
// Schémas pour la guilde
const createGuildSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(30),
    tag: zod_1.z.string().min(2).max(5),
    description: zod_1.z.string().max(500).optional(),
});
const guildInviteSchema = zod_1.z.object({
    targetName: zod_1.z.string(),
});
const guildKickSchema = zod_1.z.object({
    targetCharacterId: zod_1.z.number().int().positive(),
});
const guildRankSchema = zod_1.z.object({
    targetCharacterId: zod_1.z.number().int().positive(),
    rank: zod_1.z.enum(['OFFICER', 'MEMBER']),
});
const guildGoldSchema = zod_1.z.object({
    amount: zod_1.z.number().int().positive(),
});
// Schémas pour la banque
const bankItemSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
});
class GameServer {
    constructor(io) {
        this.io = io;
        this.connectedPlayers = new Map();
        this.initializedMaps = new Set();
        /**
         * Authentification du socket
         */
        this.authenticateSocket = async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token ??
                    (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined) ??
                    (socket.handshake.headers.authorization?.startsWith('Bearer ')
                        ? socket.handshake.headers.authorization.slice(7)
                        : undefined);
                if (!token) {
                    throw new Error('Authentication required');
                }
                const payload = jsonwebtoken_1.default.verify(token, env_1.appConfig.jwtSecret);
                const user = await prisma_1.prisma.user.findUnique({
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
            }
            catch (error) {
                next(error instanceof Error ? error : new Error('Unauthorized connection'));
            }
        };
        this.spawnManager = new MonsterSpawnManager_1.MonsterSpawnManager(io);
        this.monsterAI = new MonsterAI_1.MonsterAI(io, this.spawnManager);
        this.lootManager = new LootManager_1.LootManager();
        this.io.use(this.authenticateSocket);
        this.io.on('connection', (socket) => this.handleConnection(socket));
        // Démarrer les systèmes
        this.spawnManager.startRespawnLoop();
        this.monsterAI.start();
        console.log('[GameServer] Initialized');
    }
    /**
     * Gestion d'une nouvelle connexion
     */
    async handleConnection(socket) {
        const characterId = socket.data.characterId;
        const character = socket.data.character;
        console.log(`[GameServer] Player ${characterId} connected`);
        // Créer/mettre à jour la session
        await prisma_1.prisma.playerSession.upsert({
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
        await this.joinMap(socket, mapId);
        // Enregistrer les handlers
        this.registerHandlers(socket);
        // Envoyer les monstres de la map
        const monsters = this.spawnManager.getMonstersOnMap(mapId);
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
        for (const player of otherPlayers) {
            const playerChar = await prisma_1.prisma.character.findUnique({
                where: { id: player.characterId },
                select: { id: true, name: true, health: true, maxHealth: true, positionX: true, positionY: true },
            });
            if (playerChar) {
                socket.emit('player:joined', { character: playerChar });
            }
        }
    }
    /**
     * Rejoint une map
     */
    async joinMap(socket, mapId) {
        const characterId = socket.data.characterId;
        const character = socket.data.character;
        // Quitter l'ancienne map
        const oldPlayer = this.connectedPlayers.get(characterId);
        if (oldPlayer) {
            socket.leave(`map:${oldPlayer.mapId}`);
            socket.to(`map:${oldPlayer.mapId}`).emit('player:left', { characterId });
            this.monsterAI.removePlayer(characterId);
        }
        // Rejoindre la nouvelle map
        socket.join(`map:${mapId}`);
        // Initialiser la map si nécessaire
        if (!this.initializedMaps.has(mapId)) {
            await this.spawnManager.initializeMap(mapId);
            this.initializedMaps.add(mapId);
            // Initialiser l'AI pour les monstres de la map
            const monsters = this.spawnManager.getMonstersOnMap(mapId);
            for (const monster of monsters) {
                this.monsterAI.initializeMonster(monster);
            }
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
    registerHandlers(socket) {
        const characterId = socket.data.characterId;
        // Mouvement
        socket.on('player:move', async (payload) => {
            try {
                const data = movementSchema.parse(payload);
                const player = this.connectedPlayers.get(characterId);
                if (!player)
                    return;
                player.positionX = data.x;
                player.positionY = data.y;
                await characterService_1.characterService.updatePosition(characterId, data);
                this.monsterAI.updatePlayerPosition(characterId, player.mapId, data.x, data.y);
                socket.to(`map:${player.mapId}`).emit('player:moved', {
                    characterId,
                    position: data,
                });
            }
            catch (error) {
                console.error('[player:move]', error);
            }
        });
        // Cast de skill
        socket.on('skill:cast', async (payload) => {
            try {
                const data = skillCastSchema.parse(payload);
                await this.handleSkillCast(socket, characterId, data);
            }
            catch (error) {
                console.error('[skill:cast]', error);
            }
        });
        // Changement de map
        socket.on('map:changeRequest', async (payload) => {
            try {
                const data = mapChangeSchema.parse(payload);
                await this.handleMapChange(socket, characterId, data.targetMapCode);
            }
            catch (error) {
                console.error('[map:changeRequest]', error);
            }
        });
        // Chat
        socket.on('chat:message', async (payload) => {
            try {
                const data = chatMessageSchema.parse(payload);
                await this.handleChatMessage(socket, characterId, data);
            }
            catch (error) {
                console.error('[chat:message]', error);
            }
        });
        // Interaction
        socket.on('interact:check', async (payload) => {
            try {
                const player = this.connectedPlayers.get(characterId);
                if (!player)
                    return;
                // Vérifier les NPCs à proximité
                const npcs = await prisma_1.prisma.nPC.findMany({
                    where: { mapId: player.mapId },
                });
                for (const npc of npcs) {
                    const distance = Math.sqrt(Math.pow(payload.x - npc.positionX, 2) + Math.pow(payload.y - npc.positionY, 2));
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
            }
            catch (error) {
                console.error('[interact:check]', error);
            }
        });
        // ============================================
        // INVENTAIRE ET ÉQUIPEMENT
        // ============================================
        // Récupérer l'inventaire
        socket.on('inventory:get', async () => {
            try {
                const inventory = await inventoryService_1.inventoryService.getInventory(characterId);
                socket.emit('inventory:data', inventory);
            }
            catch (error) {
                console.error('[inventory:get]', error);
            }
        });
        // Équiper un item
        socket.on('inventory:equip', async (payload) => {
            try {
                const data = equipItemSchema.parse(payload);
                const item = await prisma_1.prisma.item.findUnique({
                    where: { id: data.itemId },
                    include: { weaponType: true },
                });
                if (!item || item.type !== 'WEAPON' || !item.weaponTypeId) {
                    socket.emit('inventory:error', { reason: 'Not a valid weapon' });
                    return;
                }
                await prisma_1.prisma.character.update({
                    where: { id: characterId },
                    data: { equippedWeaponTypeId: item.weaponTypeId },
                });
                const player = this.connectedPlayers.get(characterId);
                if (player && item.weaponType) {
                    player.weaponCode = item.weaponType.code;
                }
                socket.emit('inventory:equipped', { itemId: data.itemId, weaponCode: item.weaponType?.code ?? null });
            }
            catch (error) {
                console.error('[inventory:equip]', error);
            }
        });
        // Jeter un item
        socket.on('inventory:drop', async (payload) => {
            try {
                const data = dropItemSchema.parse(payload);
                const inventoryItem = await prisma_1.prisma.inventoryItem.findUnique({
                    where: { characterId_itemId: { characterId, itemId: data.itemId } },
                });
                if (!inventoryItem || inventoryItem.quantity < data.quantity) {
                    socket.emit('inventory:error', { reason: 'Not enough items' });
                    return;
                }
                if (inventoryItem.quantity === data.quantity) {
                    await prisma_1.prisma.inventoryItem.delete({ where: { id: inventoryItem.id } });
                }
                else {
                    await prisma_1.prisma.inventoryItem.update({
                        where: { id: inventoryItem.id },
                        data: { quantity: { decrement: data.quantity } },
                    });
                }
                socket.emit('inventory:dropped', { itemId: data.itemId, quantity: data.quantity });
            }
            catch (error) {
                console.error('[inventory:drop]', error);
            }
        });
        // Changer d'arme
        socket.on('weapon:switch', async (payload) => {
            try {
                const data = switchWeaponSchema.parse(payload);
                // Trouver le type d'arme par son code
                const weaponType = await prisma_1.prisma.weaponType.findUnique({
                    where: { code: data.weaponCode },
                });
                if (!weaponType) {
                    socket.emit('weapon:error', { reason: 'Invalid weapon type' });
                    return;
                }
                await prisma_1.prisma.character.update({
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
            }
            catch (error) {
                console.error('[weapon:switch]', error);
            }
        });
        // ============================================
        // COMPÉTENCES
        // ============================================
        // Récupérer la barre de skills
        socket.on('skills:getBar', async () => {
            try {
                const skillBar = await skillService_1.skillService.getSkillBar(characterId);
                socket.emit('skills:bar', skillBar);
            }
            catch (error) {
                console.error('[skills:getBar]', error);
            }
        });
        // Récupérer tous les skills disponibles
        socket.on('skills:getAll', async () => {
            try {
                const skills = await skillService_1.skillService.listSkillsByCategory(characterId);
                socket.emit('skills:all', skills);
            }
            catch (error) {
                console.error('[skills:getAll]', error);
            }
        });
        // Apprendre un skill
        socket.on('skills:learn', async (payload) => {
            try {
                const data = learnSkillSchema.parse(payload);
                const result = await skillService_1.skillService.learnSkill(characterId, data.skillId);
                socket.emit('skills:learned', result);
            }
            catch (error) {
                socket.emit('skills:error', { reason: error.message || 'Cannot learn skill' });
            }
        });
        // Assigner un skill à un slot
        socket.on('skills:assign', async (payload) => {
            try {
                const data = assignSkillSchema.parse(payload);
                await skillService_1.skillService.assignSkillToSlot(characterId, data.skillId, data.slot);
                const skillBar = await skillService_1.skillService.getSkillBar(characterId);
                socket.emit('skills:bar', skillBar);
            }
            catch (error) {
                socket.emit('skills:error', { reason: error.message || 'Cannot assign skill' });
            }
        });
        // Retirer un skill d'un slot
        socket.on('skills:unassign', async (payload) => {
            try {
                const data = unassignSkillSchema.parse(payload);
                await skillService_1.skillService.unassignSkillFromSlot(characterId, data.slot);
                const skillBar = await skillService_1.skillService.getSkillBar(characterId);
                socket.emit('skills:bar', skillBar);
            }
            catch (error) {
                socket.emit('skills:error', { reason: error.message || 'Cannot unassign skill' });
            }
        });
        // ============================================
        // GUILDE
        // ============================================
        // Récupérer sa guilde
        socket.on('guild:get', async () => {
            try {
                const guildData = await guildService_1.guildService.getCharacterGuild(characterId);
                socket.emit('guild:data', guildData);
            }
            catch (error) {
                console.error('[guild:get]', error);
            }
        });
        // Créer une guilde
        socket.on('guild:create', async (payload) => {
            try {
                const data = createGuildSchema.parse(payload);
                const guild = await guildService_1.guildService.createGuild(characterId, data.name, data.tag, data.description);
                socket.emit('guild:created', guild);
            }
            catch (error) {
                socket.emit('guild:error', { reason: error.message || 'Cannot create guild' });
            }
        });
        // Quitter la guilde
        socket.on('guild:leave', async () => {
            try {
                await guildService_1.guildService.leaveGuild(characterId);
                socket.emit('guild:left', { success: true });
            }
            catch (error) {
                socket.emit('guild:error', { reason: error.message || 'Cannot leave guild' });
            }
        });
        // Inviter un joueur
        socket.on('guild:invite', async (payload) => {
            try {
                const data = guildInviteSchema.parse(payload);
                const target = await prisma_1.prisma.character.findFirst({
                    where: { name: data.targetName },
                });
                if (!target) {
                    socket.emit('guild:error', { reason: 'Player not found' });
                    return;
                }
                await guildService_1.guildService.invitePlayer(characterId, target.id);
                // Notifier le joueur invité s'il est en ligne
                const targetPlayer = this.connectedPlayers.get(target.id);
                if (targetPlayer) {
                    this.io.to(targetPlayer.socketId).emit('guild:invited', {
                        guildId: (await guildService_1.guildService.getCharacterGuild(characterId))?.guild.id,
                    });
                }
                socket.emit('guild:inviteSent', { targetName: data.targetName });
            }
            catch (error) {
                socket.emit('guild:error', { reason: error.message || 'Cannot invite player' });
            }
        });
        // Exclure un membre
        socket.on('guild:kick', async (payload) => {
            try {
                const data = guildKickSchema.parse(payload);
                await guildService_1.guildService.kickMember(characterId, data.targetCharacterId);
                // Notifier le joueur exclu
                const targetPlayer = this.connectedPlayers.get(data.targetCharacterId);
                if (targetPlayer) {
                    this.io.to(targetPlayer.socketId).emit('guild:kicked');
                }
                socket.emit('guild:kickSuccess', { targetId: data.targetCharacterId });
            }
            catch (error) {
                socket.emit('guild:error', { reason: error.message || 'Cannot kick member' });
            }
        });
        // Changer le rang d'un membre
        socket.on('guild:setRank', async (payload) => {
            try {
                const data = guildRankSchema.parse(payload);
                await guildService_1.guildService.setMemberRank(characterId, data.targetCharacterId, data.rank);
                const guildData = await guildService_1.guildService.getCharacterGuild(characterId);
                socket.emit('guild:data', guildData);
            }
            catch (error) {
                socket.emit('guild:error', { reason: error.message || 'Cannot change rank' });
            }
        });
        // Déposer de l'or dans la guilde
        socket.on('guild:depositGold', async (payload) => {
            try {
                const data = guildGoldSchema.parse(payload);
                await guildService_1.guildService.depositGold(characterId, data.amount);
                const guildData = await guildService_1.guildService.getCharacterGuild(characterId);
                socket.emit('guild:data', guildData);
            }
            catch (error) {
                socket.emit('guild:error', { reason: error.message || 'Cannot deposit gold' });
            }
        });
        // Retirer de l'or de la guilde
        socket.on('guild:withdrawGold', async (payload) => {
            try {
                const data = guildGoldSchema.parse(payload);
                await guildService_1.guildService.withdrawGold(characterId, data.amount);
                const guildData = await guildService_1.guildService.getCharacterGuild(characterId);
                socket.emit('guild:data', guildData);
            }
            catch (error) {
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
                    bankService_1.bankService.getBankContents(characterId),
                    bankService_1.bankService.getBankStats(characterId),
                ]);
                socket.emit('bank:data', { contents, stats });
            }
            catch (error) {
                console.error('[bank:get]', error);
            }
        });
        // Déposer un item
        socket.on('bank:deposit', async (payload) => {
            try {
                const data = bankItemSchema.parse(payload);
                await bankService_1.bankService.depositItem(characterId, data.itemId, data.quantity);
                const [contents, stats, inventory] = await Promise.all([
                    bankService_1.bankService.getBankContents(characterId),
                    bankService_1.bankService.getBankStats(characterId),
                    inventoryService_1.inventoryService.getInventory(characterId),
                ]);
                socket.emit('bank:data', { contents, stats });
                socket.emit('inventory:data', inventory);
            }
            catch (error) {
                socket.emit('bank:error', { reason: error.message || 'Cannot deposit' });
            }
        });
        // Retirer un item
        socket.on('bank:withdraw', async (payload) => {
            try {
                const data = bankItemSchema.parse(payload);
                await bankService_1.bankService.withdrawItem(characterId, data.itemId, data.quantity);
                const [contents, stats, inventory] = await Promise.all([
                    bankService_1.bankService.getBankContents(characterId),
                    bankService_1.bankService.getBankStats(characterId),
                    inventoryService_1.inventoryService.getInventory(characterId),
                ]);
                socket.emit('bank:data', { contents, stats });
                socket.emit('inventory:data', inventory);
            }
            catch (error) {
                socket.emit('bank:error', { reason: error.message || 'Cannot withdraw' });
            }
        });
        // ============================================
        // STATISTIQUES PERSONNAGE
        // ============================================
        // Récupérer les stats du personnage
        socket.on('character:getStats', async () => {
            try {
                const character = await prisma_1.prisma.character.findUnique({
                    where: { id: characterId },
                    include: {
                        weaponProgress: true,
                        elementProgress: true,
                    },
                });
                socket.emit('character:stats', character);
            }
            catch (error) {
                console.error('[character:getStats]', error);
            }
        });
        // Récupérer les progressions d'armes
        socket.on('character:getWeaponProgress', async () => {
            try {
                const progress = await prisma_1.prisma.characterWeaponProgress.findMany({
                    where: { characterId },
                });
                socket.emit('character:weaponProgress', progress);
            }
            catch (error) {
                console.error('[character:getWeaponProgress]', error);
            }
        });
        // Récupérer les progressions d'éléments
        socket.on('character:getElementProgress', async () => {
            try {
                const progress = await prisma_1.prisma.characterElementProgress.findMany({
                    where: { characterId },
                });
                socket.emit('character:elementProgress', progress);
            }
            catch (error) {
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
            await prisma_1.prisma.playerSession.deleteMany({ where: { characterId } });
        });
    }
    /**
     * Gère le cast d'un skill
     */
    async handleSkillCast(socket, characterId, data) {
        const player = this.connectedPlayers.get(characterId);
        if (!player)
            return;
        // Récupérer le skill et le personnage
        const [skill, character] = await Promise.all([
            prisma_1.prisma.skill.findUnique({ where: { id: data.skillId } }),
            prisma_1.prisma.character.findUnique({ where: { id: characterId } }),
        ]);
        if (!skill || !character)
            return;
        // Vérifier le mana
        if (character.mana < skill.manaCost) {
            socket.emit('skill:failed', { reason: 'Not enough mana' });
            return;
        }
        // Déduire le mana
        await prisma_1.prisma.character.update({
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
        const hitMonsters = this.getTargetsInArea(data.targetX, data.targetY, skill.areaOfEffect, skill.telegraphShape ?? 'circle', player.positionX, player.positionY, skill.range, monsters);
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
            const damageResult = combatService_1.combatService.calculateDamage(attackerStats, defenderStats, skill.baseDamage, skill.damageScaling, skill.damageType);
            const { killed, actualDamage } = this.spawnManager.damageMonster(monster.spawnId, damageResult.damage, characterId);
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
    async handleMonsterKill(socket, characterId, monster) {
        const player = this.connectedPlayers.get(characterId);
        if (!player)
            return;
        const character = await prisma_1.prisma.character.findUnique({ where: { id: characterId } });
        if (!character)
            return;
        // Calculer les récompenses
        const fullMonster = this.spawnManager.getMonster(monster.spawnId);
        if (!fullMonster)
            return;
        const rewards = await this.lootManager.calculateRewards(fullMonster, character.level, player.weaponCode);
        // Appliquer les récompenses
        await this.lootManager.applyRewards(characterId, rewards, player.weaponCode);
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
    getTargetsInArea(targetX, targetY, areaSize, shape, originX, originY, range, monsters) {
        return monsters.filter((m) => {
            const distToTarget = Math.sqrt(Math.pow(m.positionX - targetX, 2) + Math.pow(m.positionY - targetY, 2));
            switch (shape) {
                case 'circle':
                    return distToTarget <= areaSize;
                case 'line':
                    // Vérifier si le monstre est sur la ligne entre origin et target
                    const lineAngle = Math.atan2(targetY - originY, targetX - originX);
                    const monsterAngle = Math.atan2(m.positionY - originY, m.positionX - originX);
                    const angleDiff = Math.abs(lineAngle - monsterAngle);
                    const distToOrigin = Math.sqrt(Math.pow(m.positionX - originX, 2) + Math.pow(m.positionY - originY, 2));
                    return angleDiff < 0.2 && distToOrigin <= range;
                case 'cone':
                    // Vérifier si le monstre est dans le cône
                    const coneAngle = Math.atan2(targetY - originY, targetX - originX);
                    const mAngle = Math.atan2(m.positionY - originY, m.positionX - originX);
                    const aDiff = Math.abs(coneAngle - mAngle);
                    const coneWidth = (areaSize / 180) * Math.PI; // areaSize en degrés
                    const dToOrigin = Math.sqrt(Math.pow(m.positionX - originX, 2) + Math.pow(m.positionY - originY, 2));
                    return aDiff <= coneWidth / 2 && dToOrigin <= range;
                default:
                    return distToTarget <= areaSize;
            }
        });
    }
    /**
     * Gère le changement de map
     */
    async handleMapChange(socket, characterId, targetMapCode) {
        const map = await prisma_1.prisma.gameMap.findUnique({
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
        await prisma_1.prisma.character.update({
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
    async handleChatMessage(socket, characterId, data) {
        const player = this.connectedPlayers.get(characterId);
        if (!player)
            return;
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { name: true },
        });
        if (!character)
            return;
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
                    const target = await prisma_1.prisma.character.findFirst({
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
                        }
                        else {
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
    destroy() {
        this.spawnManager.destroy();
        this.monsterAI.destroy();
        this.connectedPlayers.clear();
    }
}
exports.GameServer = GameServer;
