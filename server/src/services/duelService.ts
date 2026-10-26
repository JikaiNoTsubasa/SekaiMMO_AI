// Duel Service - Gestion des duels PvP
// Demandes, acceptation, combat

import type { DuelStatus } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

const DUEL_REQUEST_TIMEOUT = 60000; // 60 secondes pour accepter un duel
const DUEL_RANGE = 500; // Distance max pour demander un duel (en pixels)

export interface DuelState {
  duelId: number;
  challengerId: number;
  challengerName: string;
  targetId: number;
  targetName: string;
  status: DuelStatus;
}

export const duelService = {
  /**
   * Envoie une demande de duel
   */
  async requestDuel(challengerId: number, targetId: number): Promise<DuelState> {
    if (challengerId === targetId) {
      throw new HttpError('Cannot duel yourself', 400);
    }

    // Vérifier que les deux personnages existent
    const [challenger, target] = await Promise.all([
      prisma.character.findUnique({
        where: { id: challengerId },
        select: { id: true, name: true, positionX: true, positionY: true, currentMapId: true },
      }),
      prisma.character.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, positionX: true, positionY: true, currentMapId: true },
      }),
    ]);

    if (!challenger || !target) {
      throw new HttpError('Player not found', 404);
    }

    // Vérifier qu'ils sont sur la même map
    if (challenger.currentMapId !== target.currentMapId) {
      throw new HttpError('Players must be on the same map', 400);
    }

    // Vérifier la distance
    const distance = Math.sqrt(
      Math.pow(challenger.positionX - target.positionX, 2) +
      Math.pow(challenger.positionY - target.positionY, 2)
    );

    if (distance > DUEL_RANGE) {
      throw new HttpError('Target is too far away', 400);
    }

    // Vérifier qu'aucun des deux n'a de duel en cours
    const existingDuel = await prisma.duelRequest.findFirst({
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
      throw new HttpError('One of the players already has a pending or active duel', 400);
    }

    // Créer la demande de duel
    const duel = await prisma.duelRequest.create({
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
  async acceptDuel(targetId: number, duelId: number): Promise<DuelState> {
    const duel = await prisma.duelRequest.findUnique({
      where: { id: duelId },
      include: {
        challenger: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
    });

    if (!duel) {
      throw new HttpError('Duel request not found', 404);
    }

    if (duel.targetId !== targetId) {
      throw new HttpError('This duel request is not for you', 403);
    }

    if (duel.status !== 'PENDING') {
      throw new HttpError('Duel request is no longer pending', 400);
    }

    // Vérifier le timeout
    const elapsed = Date.now() - duel.createdAt.getTime();
    if (elapsed > DUEL_REQUEST_TIMEOUT) {
      await prisma.duelRequest.update({
        where: { id: duelId },
        data: { status: 'DECLINED' },
      });
      throw new HttpError('Duel request has expired', 400);
    }

    // Accepter le duel
    await prisma.duelRequest.update({
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
  async declineDuel(targetId: number, duelId: number): Promise<void> {
    const duel = await prisma.duelRequest.findUnique({
      where: { id: duelId },
    });

    if (!duel) {
      throw new HttpError('Duel request not found', 404);
    }

    if (duel.targetId !== targetId) {
      throw new HttpError('This duel request is not for you', 403);
    }

    if (duel.status !== 'PENDING') {
      throw new HttpError('Duel request is no longer pending', 400);
    }

    await prisma.duelRequest.update({
      where: { id: duelId },
      data: { status: 'DECLINED' },
    });
  },

  /**
   * Annule une demande de duel (par le challenger)
   */
  async cancelDuel(challengerId: number, duelId: number): Promise<void> {
    const duel = await prisma.duelRequest.findUnique({
      where: { id: duelId },
    });

    if (!duel) {
      throw new HttpError('Duel request not found', 404);
    }

    if (duel.challengerId !== challengerId) {
      throw new HttpError('You are not the challenger of this duel', 403);
    }

    if (duel.status !== 'PENDING') {
      throw new HttpError('Duel request is no longer pending', 400);
    }

    await prisma.duelRequest.update({
      where: { id: duelId },
      data: { status: 'DECLINED' },
    });
  },

  /**
   * Termine un duel avec un gagnant
   */
  async completeDuel(duelId: number, winnerId: number): Promise<void> {
    const duel = await prisma.duelRequest.findUnique({
      where: { id: duelId },
    });

    if (!duel) {
      throw new HttpError('Duel not found', 404);
    }

    if (duel.status !== 'ACCEPTED') {
      throw new HttpError('Duel is not in progress', 400);
    }

    if (winnerId !== duel.challengerId && winnerId !== duel.targetId) {
      throw new HttpError('Winner must be one of the duelists', 400);
    }

    await prisma.duelRequest.update({
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
  async getActiveDuel(characterId: number): Promise<DuelState | null> {
    const duel = await prisma.duelRequest.findFirst({
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
  async getPendingDuelRequests(characterId: number) {
    const requests = await prisma.duelRequest.findMany({
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
  async getDuelHistory(characterId: number, limit = 20) {
    const duels = await prisma.duelRequest.findMany({
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
  async getDuelStats(characterId: number) {
    const [wins, losses] = await Promise.all([
      prisma.duelRequest.count({
        where: {
          status: 'COMPLETED',
          winnerId: characterId,
        },
      }),
      prisma.duelRequest.count({
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
  async cleanupExpiredDuels(): Promise<number> {
    const result = await prisma.duelRequest.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: new Date(Date.now() - DUEL_REQUEST_TIMEOUT) },
      },
      data: { status: 'DECLINED' },
    });

    return result.count;
  },
};
