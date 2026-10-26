"use strict";
// Map Service - Gestion des maps et téléportations
// Changement de zone, portails, spawns de monstres
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapService = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
exports.mapService = {
    /**
     * Récupère les informations d'une map par son code
     */
    async getMapByCode(code) {
        const map = await prisma_1.prisma.gameMap.findUnique({
            where: { code },
        });
        if (!map) {
            return null;
        }
        return {
            id: map.id,
            code: map.code,
            name: map.name,
            description: map.description,
            width: map.width,
            height: map.height,
            pvpEnabled: map.pvpEnabled,
            portals: this.parsePortals(map.portals),
        };
    },
    /**
     * Récupère les informations d'une map par son ID
     */
    async getMapById(id) {
        const map = await prisma_1.prisma.gameMap.findUnique({
            where: { id },
        });
        if (!map) {
            return null;
        }
        return {
            id: map.id,
            code: map.code,
            name: map.name,
            description: map.description,
            width: map.width,
            height: map.height,
            pvpEnabled: map.pvpEnabled,
            portals: this.parsePortals(map.portals),
        };
    },
    /**
     * Liste toutes les maps
     */
    async getAllMaps() {
        const maps = await prisma_1.prisma.gameMap.findMany({
            orderBy: { name: 'asc' },
        });
        return maps.map((map) => ({
            id: map.id,
            code: map.code,
            name: map.name,
            description: map.description,
            width: map.width,
            height: map.height,
            pvpEnabled: map.pvpEnabled,
            portals: this.parsePortals(map.portals),
        }));
    },
    /**
     * Récupère les points de spawn d'une map
     */
    async getMapSpawns(mapId) {
        const spawns = await prisma_1.prisma.monsterSpawn.findMany({
            where: { mapId },
            include: {
                monster: { select: { id: true, name: true } },
            },
        });
        return spawns.map((s) => ({
            id: s.id,
            monsterId: s.monster.id,
            monsterName: s.monster.name,
            positionX: s.positionX,
            positionY: s.positionY,
            patrolRadius: s.patrolRadius,
            maxCount: s.maxCount,
        }));
    },
    /**
     * Récupère les NPCs d'une map
     */
    async getMapNPCs(mapId) {
        const npcs = await prisma_1.prisma.nPC.findMany({
            where: { mapId },
        });
        return npcs.map((npc) => ({
            id: npc.id,
            name: npc.name,
            title: npc.title,
            positionX: npc.positionX,
            positionY: npc.positionY,
            isWeaponMaster: npc.isWeaponMaster,
            weaponMasterFor: npc.weaponMasterFor,
            isElementMaster: npc.isElementMaster,
            elementMasterFor: npc.elementMasterFor,
            isMerchant: npc.isMerchant,
            isBanker: npc.isBanker,
            dialogue: npc.dialogue,
            shopItems: npc.shopItems,
        }));
    },
    /**
     * Téléporte un personnage vers une map
     */
    async teleportCharacter(characterId, targetMapCode, positionX, positionY) {
        const targetMap = await prisma_1.prisma.gameMap.findUnique({
            where: { code: targetMapCode },
        });
        if (!targetMap) {
            throw new errorHandler_1.HttpError('Target map not found', 404);
        }
        // Position par défaut au centre de la map
        const x = positionX ?? targetMap.width / 2;
        const y = positionY ?? targetMap.height / 2;
        // Vérifier que la position est dans les limites
        const finalX = Math.max(0, Math.min(x, targetMap.width));
        const finalY = Math.max(0, Math.min(y, targetMap.height));
        await prisma_1.prisma.character.update({
            where: { id: characterId },
            data: {
                currentMapId: targetMap.id,
                positionX: finalX,
                positionY: finalY,
            },
        });
        return {
            mapId: targetMap.id,
            mapCode: targetMap.code,
            mapName: targetMap.name,
            positionX: finalX,
            positionY: finalY,
            pvpEnabled: targetMap.pvpEnabled,
        };
    },
    /**
     * Vérifie si un personnage est dans un portail et le téléporte si nécessaire
     */
    async checkPortalCollision(characterId, currentMapId, positionX, positionY) {
        const currentMap = await prisma_1.prisma.gameMap.findUnique({
            where: { id: currentMapId },
        });
        if (!currentMap) {
            return { teleported: false };
        }
        const portals = this.parsePortals(currentMap.portals);
        for (const portal of portals) {
            // Vérifier la collision avec le portail
            if (positionX >= portal.x &&
                positionX <= portal.x + portal.width &&
                positionY >= portal.y &&
                positionY <= portal.y + portal.height) {
                // Trouver la map cible
                const targetMap = await this.getMapByCode(portal.targetMapCode);
                if (targetMap) {
                    // Téléporter le personnage
                    const result = await this.teleportCharacter(characterId, portal.targetMapCode);
                    return {
                        teleported: true,
                        newMap: targetMap,
                        newPosition: { x: result.positionX, y: result.positionY },
                    };
                }
            }
        }
        return { teleported: false };
    },
    /**
     * Récupère les personnages présents sur une map
     */
    async getCharactersOnMap(mapId) {
        const characters = await prisma_1.prisma.character.findMany({
            where: { currentMapId: mapId },
            select: {
                id: true,
                name: true,
                positionX: true,
                positionY: true,
                level: true,
                guildMembership: {
                    include: {
                        guild: { select: { tag: true } },
                    },
                },
            },
        });
        return characters.map((c) => ({
            id: c.id,
            name: c.name,
            positionX: c.positionX,
            positionY: c.positionY,
            level: c.level,
            guildTag: c.guildMembership?.guild.tag ?? null,
        }));
    },
    /**
     * Met à jour la position d'un personnage
     */
    async updateCharacterPosition(characterId, positionX, positionY) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { currentMapId: true },
        });
        if (!character || !character.currentMapId) {
            throw new errorHandler_1.HttpError('Character not on a map', 400);
        }
        const map = await prisma_1.prisma.gameMap.findUnique({
            where: { id: character.currentMapId },
        });
        if (!map) {
            throw new errorHandler_1.HttpError('Map not found', 404);
        }
        // Limiter la position aux bords de la map
        const finalX = Math.max(0, Math.min(positionX, map.width));
        const finalY = Math.max(0, Math.min(positionY, map.height));
        await prisma_1.prisma.character.update({
            where: { id: characterId },
            data: { positionX: finalX, positionY: finalY },
        });
        // Vérifier les portails
        const portalCheck = await this.checkPortalCollision(characterId, character.currentMapId, finalX, finalY);
        return {
            positionX: portalCheck.teleported ? portalCheck.newPosition.x : finalX,
            positionY: portalCheck.teleported ? portalCheck.newPosition.y : finalY,
            teleported: portalCheck.teleported,
            newMap: portalCheck.newMap,
        };
    },
    /**
     * Vérifie si le PvP est activé pour la position d'un personnage
     */
    async isPvPEnabled(characterId) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { currentMapId: true },
        });
        if (!character?.currentMapId) {
            return false;
        }
        const map = await prisma_1.prisma.gameMap.findUnique({
            where: { id: character.currentMapId },
            select: { pvpEnabled: true },
        });
        return map?.pvpEnabled ?? false;
    },
    // Helpers
    parsePortals(portalsJson) {
        if (!portalsJson || typeof portalsJson !== 'string') {
            try {
                return Array.isArray(portalsJson) ? portalsJson : [];
            }
            catch {
                return [];
            }
        }
        try {
            const parsed = JSON.parse(portalsJson);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    },
};
