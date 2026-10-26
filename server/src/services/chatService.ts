// Chat Service - Gestion du système de chat
// Local, guilde, whisper

import type { ChatChannel } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

const MAX_MESSAGE_LENGTH = 500;
const MESSAGES_PER_PAGE = 50;

export interface ChatMessageData {
  senderId: number;
  senderName: string;
  content: string;
  channel: ChatChannel;
  mapId?: number;
  guildId?: number;
  receiverId?: number;
  receiverName?: string;
  createdAt: Date;
}

export const chatService = {
  /**
   * Envoie un message dans le chat local (même map)
   */
  async sendLocalMessage(characterId: number, content: string): Promise<ChatMessageData> {
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, name: true, currentMapId: true },
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    if (!character.currentMapId) {
      throw new HttpError('Character is not on a map', 400);
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId: characterId,
        content,
        channel: 'LOCAL',
        mapId: character.currentMapId,
      },
    });

    return {
      senderId: character.id,
      senderName: character.name,
      content,
      channel: 'LOCAL',
      mapId: character.currentMapId,
      createdAt: message.createdAt,
    };
  },

  /**
   * Envoie un message dans le chat de guilde
   */
  async sendGuildMessage(characterId: number, content: string): Promise<ChatMessageData> {
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, name: true },
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    const membership = await prisma.guildMember.findUnique({
      where: { characterId },
    });

    if (!membership) {
      throw new HttpError('You are not in a guild', 400);
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId: characterId,
        content,
        channel: 'GUILD',
        guildId: membership.guildId,
      },
    });

    return {
      senderId: character.id,
      senderName: character.name,
      content,
      channel: 'GUILD',
      guildId: membership.guildId,
      createdAt: message.createdAt,
    };
  },

  /**
   * Envoie un message privé (whisper)
   */
  async sendWhisper(senderId: number, receiverName: string, content: string): Promise<ChatMessageData> {
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    }

    const sender = await prisma.character.findUnique({
      where: { id: senderId },
      select: { id: true, name: true },
    });

    if (!sender) {
      throw new HttpError('Character not found', 404);
    }

    const receiver = await prisma.character.findUnique({
      where: { name: receiverName },
      select: { id: true, name: true },
    });

    if (!receiver) {
      throw new HttpError('Recipient not found', 404);
    }

    if (sender.id === receiver.id) {
      throw new HttpError('Cannot whisper to yourself', 400);
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId,
        receiverId: receiver.id,
        content,
        channel: 'WHISPER',
      },
    });

    return {
      senderId: sender.id,
      senderName: sender.name,
      content,
      channel: 'WHISPER',
      receiverId: receiver.id,
      receiverName: receiver.name,
      createdAt: message.createdAt,
    };
  },

  /**
   * Récupère les messages du chat local
   */
  async getLocalMessages(mapId: number, limit = MESSAGES_PER_PAGE, before?: Date) {
    const messages = await prisma.chatMessage.findMany({
      where: {
        channel: 'LOCAL',
        mapId,
        ...(before && { createdAt: { lt: before } }),
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      senderId: m.sender.id,
      senderName: m.sender.name,
      content: m.content,
      channel: m.channel,
      mapId: m.mapId,
      createdAt: m.createdAt,
    }));
  },

  /**
   * Récupère les messages du chat de guilde
   */
  async getGuildMessages(characterId: number, limit = MESSAGES_PER_PAGE, before?: Date) {
    const membership = await prisma.guildMember.findUnique({
      where: { characterId },
    });

    if (!membership) {
      throw new HttpError('You are not in a guild', 400);
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        channel: 'GUILD',
        guildId: membership.guildId,
        ...(before && { createdAt: { lt: before } }),
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      senderId: m.sender.id,
      senderName: m.sender.name,
      content: m.content,
      channel: m.channel,
      guildId: m.guildId,
      createdAt: m.createdAt,
    }));
  },

  /**
   * Récupère les whispers d'un personnage
   */
  async getWhispers(characterId: number, limit = MESSAGES_PER_PAGE, before?: Date) {
    const messages = await prisma.chatMessage.findMany({
      where: {
        channel: 'WHISPER',
        OR: [{ senderId: characterId }, { receiverId: characterId }],
        ...(before && { createdAt: { lt: before } }),
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      senderId: m.sender.id,
      senderName: m.sender.name,
      content: m.content,
      channel: m.channel,
      receiverId: m.receiver?.id,
      receiverName: m.receiver?.name,
      createdAt: m.createdAt,
      isIncoming: m.receiverId === characterId,
    }));
  },

  /**
   * Récupère la conversation avec un joueur spécifique
   */
  async getConversation(characterId: number, otherCharacterId: number, limit = MESSAGES_PER_PAGE) {
    const messages = await prisma.chatMessage.findMany({
      where: {
        channel: 'WHISPER',
        OR: [
          { senderId: characterId, receiverId: otherCharacterId },
          { senderId: otherCharacterId, receiverId: characterId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      senderId: m.sender.id,
      senderName: m.sender.name,
      content: m.content,
      receiverId: m.receiver?.id,
      receiverName: m.receiver?.name,
      createdAt: m.createdAt,
      isIncoming: m.receiverId === characterId,
    }));
  },

  /**
   * Crée un message système
   */
  async createSystemMessage(mapId: number, content: string): Promise<ChatMessageData> {
    // Les messages système utilisent un characterId fictif ou le premier admin
    // Pour simplifier, on crée juste le message sans sender

    const message = await prisma.chatMessage.create({
      data: {
        senderId: 0, // ID système
        content,
        channel: 'SYSTEM',
        mapId,
      },
    });

    return {
      senderId: 0,
      senderName: 'System',
      content,
      channel: 'SYSTEM',
      mapId,
      createdAt: message.createdAt,
    };
  },

  /**
   * Récupère les joueurs avec qui on a discuté récemment
   */
  async getRecentConversations(characterId: number, limit = 10) {
    // Récupérer les derniers messages whisper uniques par conversation
    const messages = await prisma.chatMessage.findMany({
      where: {
        channel: 'WHISPER',
        OR: [{ senderId: characterId }, { receiverId: characterId }],
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Prendre plus pour filtrer les uniques
    });

    // Extraire les conversations uniques
    const conversations = new Map<number, { id: number; name: string; lastMessage: Date }>();

    for (const msg of messages) {
      const otherId = msg.senderId === characterId ? msg.receiverId : msg.senderId;
      const otherName = msg.senderId === characterId ? msg.receiver?.name : msg.sender.name;

      if (otherId && otherName && !conversations.has(otherId)) {
        conversations.set(otherId, {
          id: otherId,
          name: otherName,
          lastMessage: msg.createdAt,
        });

        if (conversations.size >= limit) break;
      }
    }

    return Array.from(conversations.values());
  },
};
