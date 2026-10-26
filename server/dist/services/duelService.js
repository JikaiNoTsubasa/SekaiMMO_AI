"use strict";
// Duel Service - Gestion des duels PvP
// Demandes, acceptation, combat
Object.defineProperty(exports, "__esModule", { value: true });
exports.duelService = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const DUEL_REQUEST_TIMEOUT = 60000; // 60 secondes pour accepter un duel
const DUEL_RANGE = 500; // Distance max pour demander un duel (en pixels)
exports.duelService = {
    /**
     * Envoie une demande de duel
     */
    async requestDuel(challengerId, targetId) {
        if (challengerId === targetId) {
            throw new errorHandler_1.HttpError('Cannot duel yourself', 400);
        }
        // Vérifier que les deux personnages existent
        const [challenger, target] = await Promise.all([
            prisma_1.prisma.character.findUnique({
                where: { id: challengerId },
                select: { id: true, name: true, positionX: true, positionY: true, currentMapId: true },
            }),
            prisma_1.prisma.character.findUnique({
                where: { id: targetId },
                select: { id: true, name: true, positionX: true, positionY: true, currentMapId: true },
            }),
        ]);
        if (!challenger || !target) {
            throw new errorHandler_1.HttpError('Player not found', 404);
        }
        // Vérifier qu'ils sont sur la même map
        if (challenger.currentMapId !== target.currentMapId) {
            throw new errorHandler_1.HttpError('Players must be on the same map', 400);
        }
        // Vérifier la distance
        const distance = Math.sqrt(Math.pow(challenger.positionX - target.positionX, 2) +
            Math.pow(challenger.positionY - target.positionY, 2));
        if (distance > DUEL_RANGE) {
            throw new errorHandler_1.HttpError('Target is too far away', 400);
        }
        // Vérifier qu'aucun des deux n'a de duel en cours
        const existingDuel = await prisma_1.prisma.duelRequest.findFirst({
            where: {
                OR: [
                    { challengerId, status: { in: ['PENDING', 'ACCEPTED'] } },
                    { targetId: challengerId, status: { in: ['PENDING', 'ACCEPTED'] } },
                    { challengerId: targetId, status: { in: ['PENDING', 'ACCEPTED'] } },
                    { targetId, status: { in: ['PENDING', 'ACCEPTED'] } },
                ],
            },
        });
        if (existingDuel) {
            throw new errorHandler_1.HttpError('One of the players already has a pending or active duel', 400);
        }
        // Créer la demande de duel
        const duel = await prisma_1.prisma.duelRequest.create({
            data: {
                challengerId,
                targetId,
                status: 'PENDING',
            },
        });
        return {
            duelId: duel.id,
            challengerId: challenger.id,
            challengerName: challenger.name,
            targetId: target.id,
            targetName: target.name,
            status: 'PENDING',
        };
    },
    /**
     * Accepte une demande de duel
     */
    async acceptDuel(targetId, duelId) {
        const duel = await prisma_1.prisma.duelRequest.findUnique({
            where: { id: duelId },
            include: {
                challenger: { select: { id: true, name: true } },
                target: { select: { id: true, name: true } },
            },
        });
        if (!duel) {
            throw new errorHandler_1.HttpError('Duel request not found', 404);
        }
        if (duel.targetId !== targetId) {
            throw new errorHandler_1.HttpError('This duel request is not for you', 403);
        }
        if (duel.status !== 'PENDING') {
            throw new errorHandler_1.HttpError('Duel request is no longer pending', 400);
        }
        // Vérifier le timeout
        const elapsed = Date.now() - duel.createdAt.getTime();
        if (elapsed > DUEL_REQUEST_TIMEOUT) {
            await prisma_1.prisma.duelRequest.update({
                where: { id: duelId },
                data: { status: 'DECLINED' },
            });
            throw new errorHandler_1.HttpError('Duel request has expired', 400);
        }
        // Accepter le duel
        await prisma_1.prisma.duelRequest.update({
            where: { id: duelId },
            data: { status: 'ACCEPTED' },
        });
        return {
            duelId: duel.id,
            challengerId: duel.challenger.id,
            challengerName: duel.challenger.name,
            targetId: duel.target.id,
            targetName: duel.target.name,
            status: 'ACCEPTED',
        };
    },
    /**
     * Refuse une demande de duel
     */
    async declineDuel(targetId, duelId) {
        const duel = await prisma_1.prisma.duelRequest.findUnique({
            where: { id: duelId },
        });
        if (!duel) {
            throw new errorHandler_1.HttpError('Duel request not found', 404);
        }
        if (duel.targetId !== targetId) {
            throw new errorHandler_1.HttpError('This duel request is not for you', 403);
        }
        if (duel.status !== 'PENDING') {
            throw new errorHandler_1.HttpError('Duel request is no longer pending', 400);
        }
        await prisma_1.prisma.duelRequest.update({
            where: { id: duelId },
            data: { status: 'DECLINED' },
        });
    },
    /**
     * Annule une demande de duel (par le challenger)
     */
    async cancelDuel(challengerId, duelId) {
        const duel = await prisma_1.prisma.duelRequest.findUnique({
            where: { id: duelId },
        });
        if (!duel) {
            throw new errorHandler_1.HttpError('Duel request not found', 404);
        }
        if (duel.challengerId !== challengerId) {
            throw new errorHandler_1.HttpError('You are not the challenger of this duel', 403);
        }
        if (duel.status !== 'PENDING') {
            throw new errorHandler_1.HttpError('Duel request is no longer pending', 400);
        }
        await prisma_1.prisma.duelRequest.update({
            where: { id: duelId },
            data: { status: 'DECLINED' },
        });
    },
    /**
     * Termine un duel avec un gagnant
     */
    async completeDuel(duelId, winnerId) {
        const duel = await prisma_1.prisma.duelRequest.findUnique({
            where: { id: duelId },
        });
        if (!duel) {
            throw new errorHandler_1.HttpError('Duel not found', 404);
        }
        if (duel.status !== 'ACCEPTED') {
            throw new errorHandler_1.HttpError('Duel is not in progress', 400);
        }
        if (winnerId !== duel.challengerId && winnerId !== duel.targetId) {
            throw new errorHandler_1.HttpError('Winner must be one of the duelists', 400);
        }
        await prisma_1.prisma.duelRequest.update({
            where: { id: duelId },
            data: {
                status: 'COMPLETED',
                winnerId,
                completedAt: new Date(),
            },
        });
    },
    /**
     * Récupère le duel actif d'un personnage
     */
    async getActiveDuel(characterId) {
        const duel = await prisma_1.prisma.duelRequest.findFirst({
            where: {
                OR: [{ challengerId: characterId }, { targetId: characterId }],
                status: 'ACCEPTED',
            },
            include: {
                challenger: { select: { id: true, name: true } },
                target: { select: { id: true, name: true } },
            },
        });
        if (!duel) {
            return null;
        }
        return {
            duelId: duel.id,
            challengerId: duel.challenger.id,
            challengerName: duel.challenger.name,
            targetId: duel.target.id,
            targetName: duel.target.name,
            status: duel.status,
        };
    },
    /**
     * Récupère les demandes de duel en attente pour un personnage
     */
    async getPendingDuelRequests(characterId) {
        const requests = await prisma_1.prisma.duelRequest.findMany({
            where: {
                targetId: characterId,
                status: 'PENDING',
                createdAt: { gte: new Date(Date.now() - DUEL_REQUEST_TIMEOUT) },
            },
            include: {
                challenger: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return requests.map((r) => ({
            duelId: r.id,
            challengerId: r.challenger.id,
            challengerName: r.challenger.name,
            createdAt: r.createdAt,
            expiresAt: new Date(r.createdAt.getTime() + DUEL_REQUEST_TIMEOUT),
        }));
    },
    /**
     * Récupère l'historique des duels d'un personnage
     */
    async getDuelHistory(characterId, limit = 20) {
        const duels = await prisma_1.prisma.duelRequest.findMany({
            where: {
                OR: [{ challengerId: characterId }, { targetId: characterId }],
                status: 'COMPLETED',
            },
            include: {
                challenger: { select: { id: true, name: true } },
                target: { select: { id: true, name: true } },
            },
            orderBy: { completedAt: 'desc' },
            take: limit,
        });
        return duels.map((d) => ({
            duelId: d.id,
            opponent: d.challengerId === characterId ? d.target : d.challenger,
            won: d.winnerId === characterId,
            completedAt: d.completedAt,
        }));
    },
    /**
     * Récupère les statistiques de duel d'un personnage
     */
    async getDuelStats(characterId) {
        const [wins, losses] = await Promise.all([
            prisma_1.prisma.duelRequest.count({
                where: {
                    status: 'COMPLETED',
                    winnerId: characterId,
                },
            }),
            prisma_1.prisma.duelRequest.count({
                where: {
                    status: 'COMPLETED',
                    winnerId: { not: characterId },
                    OR: [{ challengerId: characterId }, { targetId: characterId }],
                },
            }),
        ]);
        const total = wins + losses;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        return {
            wins,
            losses,
            total,
            winRate: Math.round(winRate * 100) / 100,
        };
    },
    /**
     * Nettoie les demandes de duel expirées
     */
    async cleanupExpiredDuels() {
        const result = await prisma_1.prisma.duelRequest.updateMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: new Date(Date.now() - DUEL_REQUEST_TIMEOUT) },
            },
            data: { status: 'DECLINED' },
        });
        return result.count;
    },
};
