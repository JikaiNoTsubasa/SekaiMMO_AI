// Guild Service - Gestion des guildes
// Création, membres, rangs

import type { GuildRank } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

const GUILD_CREATION_COST = 1000; // Or requis pour créer une guilde
const MAX_GUILD_NAME_LENGTH = 30;
const MAX_GUILD_TAG_LENGTH = 5;
const MIN_GUILD_TAG_LENGTH = 2;

export const guildService = {
  /**
   * Crée une nouvelle guilde
   */
  async createGuild(
    characterId: number,
    name: string,
    tag: string,
    description?: string
  ) {
    // Validations
    if (name.length > MAX_GUILD_NAME_LENGTH) {
      throw new HttpError(`Guild name must be ${MAX_GUILD_NAME_LENGTH} characters or less`, 400);
    }

    if (tag.length < MIN_GUILD_TAG_LENGTH || tag.length > MAX_GUILD_TAG_LENGTH) {
      throw new HttpError(`Guild tag must be ${MIN_GUILD_TAG_LENGTH}-${MAX_GUILD_TAG_LENGTH} characters`, 400);
    }

    // Vérifier que le personnage n'est pas déjà dans une guilde
    const existingMembership = await prisma.guildMember.findUnique({
      where: { characterId },
    });

    if (existingMembership) {
      throw new HttpError('You are already in a guild', 400);
    }

    // Vérifier que le nom et le tag sont disponibles
    const existingGuild = await prisma.guild.findFirst({
      where: {
        OR: [{ name }, { tag }],
      },
    });

    if (existingGuild) {
      throw new HttpError('Guild name or tag already taken', 409);
    }

    // Vérifier que le personnage a assez d'or
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { gold: true, name: true },
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    if (character.gold < GUILD_CREATION_COST) {
      throw new HttpError(`Not enough gold. ${GUILD_CREATION_COST} gold required`, 400);
    }

    // Transaction: créer la guilde et ajouter le fondateur comme leader
    const guild = await prisma.$transaction(async (tx) => {
      // Débiter l'or
      await tx.character.update({
        where: { id: characterId },
        data: { gold: { decrement: GUILD_CREATION_COST } },
      });

      // Créer la guilde
      const newGuild = await tx.guild.create({
        data: {
          name,
          tag: tag.toUpperCase(),
          description,
        },
      });

      // Ajouter le fondateur comme leader
      await tx.guildMember.create({
        data: {
          guildId: newGuild.id,
          characterId,
          rank: 'LEADER',
        },
      });

      return newGuild;
    });

    return guild;
  },

  /**
   * Récupère les informations d'une guilde
   */
  async getGuild(guildId: number) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: {
          include: {
            character: {
              select: { id: true, name: true, level: true },
            },
          },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!guild) {
      throw new HttpError('Guild not found', 404);
    }

    return guild;
  },

  /**
   * Récupère la guilde d'un personnage
   */
  async getCharacterGuild(characterId: number) {
    const membership = await prisma.guildMember.findUnique({
      where: { characterId },
      include: {
        guild: {
          include: {
            members: {
              include: {
                character: {
                  select: { id: true, name: true, level: true },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      guild: membership.guild,
      myRank: membership.rank,
    };
  },

  /**
   * Invite un joueur dans la guilde
   */
  async invitePlayer(inviterId: number, targetCharacterId: number) {
    // Vérifier que l'invitant est officier ou leader
    const inviterMembership = await prisma.guildMember.findUnique({
      where: { characterId: inviterId },
    });

    if (!inviterMembership) {
      throw new HttpError('You are not in a guild', 400);
    }

    if (inviterMembership.rank !== 'LEADER' && inviterMembership.rank !== 'OFFICER') {
      throw new HttpError('Only officers and leaders can invite players', 403);
    }

    // Vérifier que la cible n'est pas déjà dans une guilde
    const targetMembership = await prisma.guildMember.findUnique({
      where: { characterId: targetCharacterId },
    });

    if (targetMembership) {
      throw new HttpError('Player is already in a guild', 400);
    }

    // Ajouter le joueur
    await prisma.guildMember.create({
      data: {
        guildId: inviterMembership.guildId,
        characterId: targetCharacterId,
        rank: 'MEMBER',
      },
    });

    return { success: true };
  },

  /**
   * Quitte la guilde
   */
  async leaveGuild(characterId: number) {
    const membership = await prisma.guildMember.findUnique({
      where: { characterId },
      include: { guild: { include: { members: true } } },
    });

    if (!membership) {
      throw new HttpError('You are not in a guild', 400);
    }

    // Si c'est le leader et qu'il y a d'autres membres, il doit transférer le leadership
    if (membership.rank === 'LEADER' && membership.guild.members.length > 1) {
      throw new HttpError('Transfer leadership before leaving', 400);
    }

    // Si c'est le seul membre, supprimer la guilde
    if (membership.guild.members.length === 1) {
      await prisma.$transaction([
        prisma.guildMember.delete({ where: { id: membership.id } }),
        prisma.guild.delete({ where: { id: membership.guildId } }),
      ]);
    } else {
      await prisma.guildMember.delete({ where: { id: membership.id } });
    }

    return { success: true };
  },

  /**
   * Exclut un membre de la guilde
   */
  async kickMember(kickerId: number, targetCharacterId: number) {
    const kickerMembership = await prisma.guildMember.findUnique({
      where: { characterId: kickerId },
    });

    if (!kickerMembership) {
      throw new HttpError('You are not in a guild', 400);
    }

    if (kickerMembership.rank !== 'LEADER' && kickerMembership.rank !== 'OFFICER') {
      throw new HttpError('Only officers and leaders can kick members', 403);
    }

    const targetMembership = await prisma.guildMember.findUnique({
      where: { characterId: targetCharacterId },
    });

    if (!targetMembership || targetMembership.guildId !== kickerMembership.guildId) {
      throw new HttpError('Player is not in your guild', 400);
    }

    // Les officiers ne peuvent pas kick d'autres officiers ou le leader
    if (kickerMembership.rank === 'OFFICER' &&
        (targetMembership.rank === 'OFFICER' || targetMembership.rank === 'LEADER')) {
      throw new HttpError('Cannot kick officers or leader', 403);
    }

    // Le leader ne peut pas se kick lui-même
    if (targetMembership.rank === 'LEADER') {
      throw new HttpError('Cannot kick the guild leader', 403);
    }

    await prisma.guildMember.delete({ where: { id: targetMembership.id } });

    return { success: true };
  },

  /**
   * Change le rang d'un membre
   */
  async setMemberRank(leaderId: number, targetCharacterId: number, newRank: GuildRank) {
    const leaderMembership = await prisma.guildMember.findUnique({
      where: { characterId: leaderId },
    });

    if (!leaderMembership || leaderMembership.rank !== 'LEADER') {
      throw new HttpError('Only the guild leader can change ranks', 403);
    }

    if (newRank === 'LEADER') {
      throw new HttpError('Use transferLeadership to change leader', 400);
    }

    const targetMembership = await prisma.guildMember.findUnique({
      where: { characterId: targetCharacterId },
    });

    if (!targetMembership || targetMembership.guildId !== leaderMembership.guildId) {
      throw new HttpError('Player is not in your guild', 400);
    }

    if (targetMembership.rank === 'LEADER') {
      throw new HttpError('Cannot change the rank of the leader', 400);
    }

    await prisma.guildMember.update({
      where: { id: targetMembership.id },
      data: { rank: newRank },
    });

    return { success: true };
  },

  /**
   * Transfère le leadership
   */
  async transferLeadership(currentLeaderId: number, newLeaderId: number) {
    const currentLeaderMembership = await prisma.guildMember.findUnique({
      where: { characterId: currentLeaderId },
    });

    if (!currentLeaderMembership || currentLeaderMembership.rank !== 'LEADER') {
      throw new HttpError('You are not the guild leader', 403);
    }

    const newLeaderMembership = await prisma.guildMember.findUnique({
      where: { characterId: newLeaderId },
    });

    if (!newLeaderMembership || newLeaderMembership.guildId !== currentLeaderMembership.guildId) {
      throw new HttpError('Player is not in your guild', 400);
    }

    await prisma.$transaction([
      prisma.guildMember.update({
        where: { id: currentLeaderMembership.id },
        data: { rank: 'OFFICER' },
      }),
      prisma.guildMember.update({
        where: { id: newLeaderMembership.id },
        data: { rank: 'LEADER' },
      }),
    ]);

    return { success: true };
  },

  /**
   * Dépose de l'or dans la banque de guilde
   */
  async depositGold(characterId: number, amount: number) {
    if (amount <= 0) {
      throw new HttpError('Amount must be positive', 400);
    }

    const membership = await prisma.guildMember.findUnique({
      where: { characterId },
    });

    if (!membership) {
      throw new HttpError('You are not in a guild', 400);
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { gold: true },
    });

    if (!character || character.gold < amount) {
      throw new HttpError('Not enough gold', 400);
    }

    await prisma.$transaction([
      prisma.character.update({
        where: { id: characterId },
        data: { gold: { decrement: amount } },
      }),
      prisma.guild.update({
        where: { id: membership.guildId },
        data: { gold: { increment: amount } },
      }),
    ]);

    return { success: true };
  },

  /**
   * Retire de l'or de la banque de guilde (leader/officier seulement)
   */
  async withdrawGold(characterId: number, amount: number) {
    if (amount <= 0) {
      throw new HttpError('Amount must be positive', 400);
    }

    const membership = await prisma.guildMember.findUnique({
      where: { characterId },
      include: { guild: true },
    });

    if (!membership) {
      throw new HttpError('You are not in a guild', 400);
    }

    if (membership.rank !== 'LEADER' && membership.rank !== 'OFFICER') {
      throw new HttpError('Only officers and leaders can withdraw gold', 403);
    }

    if (membership.guild.gold < amount) {
      throw new HttpError('Guild does not have enough gold', 400);
    }

    await prisma.$transaction([
      prisma.guild.update({
        where: { id: membership.guildId },
        data: { gold: { decrement: amount } },
      }),
      prisma.character.update({
        where: { id: characterId },
        data: { gold: { increment: amount } },
      }),
    ]);

    return { success: true };
  },

  /**
   * Recherche de guildes
   */
  async searchGuilds(query: string, limit = 20) {
    const guilds = await prisma.guild.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { tag: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        _count: { select: { members: true } },
      },
      take: limit,
    });

    return guilds.map((g) => ({
      id: g.id,
      name: g.name,
      tag: g.tag,
      description: g.description,
      level: g.level,
      memberCount: g._count.members,
    }));
  },
};
