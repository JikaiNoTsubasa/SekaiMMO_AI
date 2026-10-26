"use strict";
// Combat Service - Gestion des calculs de combat
// Dégâts physiques/magiques, critiques, pénétration
Object.defineProperty(exports, "__esModule", { value: true });
exports.combatService = void 0;
const prisma_1 = require("../config/prisma");
// Constantes de combat
const CRIT_DAMAGE_MULTIPLIER = 1.5; // 150% de dégâts critiques
const MIN_DAMAGE = 1; // Dégâts minimum
const DEFENSE_SCALING = 0.05; // Facteur de réduction de la défense
exports.combatService = {
    /**
     * Calcule les dégâts d'une attaque basique (auto-attack)
     */
    calculateBasicAttackDamage(attackerStats, defenderStats, damageType) {
        const isPhysical = damageType === 'PHYSICAL';
        // Sélectionner les stats appropriées
        const attackPower = isPhysical ? attackerStats.physicalAttack : attackerStats.magicalAttack;
        const defenderDefense = isPhysical ? defenderStats.physicalDefense : defenderStats.magicalDefense;
        const penetration = isPhysical ? attackerStats.physicalPenetration : attackerStats.magicalPenetration;
        // Appliquer la pénétration (réduit la défense effective)
        const effectiveDefense = Math.max(0, defenderDefense - penetration);
        // Calcul de la réduction de dégâts par la défense
        // Formule: reduction = defense / (defense + 100)
        const damageReduction = effectiveDefense / (effectiveDefense + 100);
        // Dégâts bruts
        const rawDamage = attackPower;
        // Vérifier le critique
        const isCritical = Math.random() < attackerStats.critChance;
        const critMultiplier = isCritical ? attackerStats.critDamage : 1;
        // Dégâts après critique
        const damageAfterCrit = rawDamage * critMultiplier;
        // Dégâts bloqués
        const blocked = Math.floor(damageAfterCrit * damageReduction);
        // Dégâts finaux
        const finalDamage = Math.max(MIN_DAMAGE, Math.floor(damageAfterCrit - blocked));
        return {
            rawDamage,
            finalDamage,
            isCritical,
            damageType,
            element: 'NONE',
            blocked,
        };
    },
    /**
     * Calcule les dégâts d'un skill
     */
    calculateSkillDamage(attackerStats, defenderStats, skillParams) {
        const { baseDamage, damageScaling, damageType, element } = skillParams;
        const isPhysical = damageType === 'PHYSICAL';
        const isPure = damageType === 'PURE';
        // Sélectionner les stats appropriées
        const attackPower = isPhysical ? attackerStats.physicalAttack : attackerStats.magicalAttack;
        // Les dégâts purs ignorent les défenses
        let effectiveDefense = 0;
        if (!isPure) {
            const defenderDefense = isPhysical ? defenderStats.physicalDefense : defenderStats.magicalDefense;
            const penetration = isPhysical ? attackerStats.physicalPenetration : attackerStats.magicalPenetration;
            effectiveDefense = Math.max(0, defenderDefense - penetration);
        }
        // Calcul de la réduction
        const damageReduction = isPure ? 0 : effectiveDefense / (effectiveDefense + 100);
        // Dégâts bruts = baseDamage + (attackPower * scaling)
        const rawDamage = baseDamage + Math.floor(attackPower * damageScaling);
        // Vérifier le critique
        const isCritical = Math.random() < attackerStats.critChance;
        const critMultiplier = isCritical ? attackerStats.critDamage : 1;
        // Dégâts après critique
        const damageAfterCrit = rawDamage * critMultiplier;
        // Dégâts bloqués
        const blocked = Math.floor(damageAfterCrit * damageReduction);
        // Dégâts finaux
        const finalDamage = Math.max(MIN_DAMAGE, Math.floor(damageAfterCrit - blocked));
        return {
            rawDamage,
            finalDamage,
            isCritical,
            damageType,
            element,
            blocked,
        };
    },
    /**
     * Récupère les stats de combat d'un personnage
     */
    async getCharacterCombatStats(characterId) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: {
                physicalAttack: true,
                magicalAttack: true,
                physicalDefense: true,
                magicalDefense: true,
                physicalPenetration: true,
                magicalPenetration: true,
                critChance: true,
                critDamage: true,
            },
        });
        if (!character) {
            throw new Error('Character not found');
        }
        return character;
    },
    /**
     * Récupère les stats de combat d'un monstre
     */
    async getMonsterCombatStats(monsterId) {
        const monster = await prisma_1.prisma.monster.findUnique({
            where: { id: monsterId },
            select: {
                physicalAttack: true,
                magicalAttack: true,
                physicalDefense: true,
                magicalDefense: true,
            },
        });
        if (!monster) {
            throw new Error('Monster not found');
        }
        // Les monstres n'ont pas de pénétration ni de crit de base
        return {
            ...monster,
            physicalPenetration: 0,
            magicalPenetration: 0,
            critChance: 0.05,
            critDamage: CRIT_DAMAGE_MULTIPLIER,
        };
    },
    /**
     * Applique des dégâts à un personnage
     */
    async applyDamageToCharacter(characterId, damage) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { health: true },
        });
        if (!character) {
            throw new Error('Character not found');
        }
        const newHealth = Math.max(0, character.health - damage);
        await prisma_1.prisma.character.update({
            where: { id: characterId },
            data: { health: newHealth },
        });
        return {
            health: newHealth,
            isDead: newHealth <= 0,
        };
    },
    /**
     * Soigne un personnage
     */
    async healCharacter(characterId, amount) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { health: true, maxHealth: true },
        });
        if (!character) {
            throw new Error('Character not found');
        }
        const actualHeal = Math.min(amount, character.maxHealth - character.health);
        const newHealth = character.health + actualHeal;
        await prisma_1.prisma.character.update({
            where: { id: characterId },
            data: { health: newHealth },
        });
        return {
            health: newHealth,
            healed: actualHeal,
        };
    },
    /**
     * Consomme du mana
     */
    async consumeMana(characterId, amount) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { mana: true },
        });
        if (!character) {
            throw new Error('Character not found');
        }
        if (character.mana < amount) {
            return { mana: character.mana, success: false };
        }
        const newMana = character.mana - amount;
        await prisma_1.prisma.character.update({
            where: { id: characterId },
            data: { mana: newMana },
        });
        return { mana: newMana, success: true };
    },
    /**
     * Restaure du mana
     */
    async restoreMana(characterId, amount) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { mana: true, maxMana: true },
        });
        if (!character) {
            throw new Error('Character not found');
        }
        const actualRestore = Math.min(amount, character.maxMana - character.mana);
        const newMana = character.mana + actualRestore;
        await prisma_1.prisma.character.update({
            where: { id: characterId },
            data: { mana: newMana },
        });
        return {
            mana: newMana,
            restored: actualRestore,
        };
    },
    /**
     * Vérifie si un personnage peut utiliser un skill (mana suffisant)
     */
    async canUseSkill(characterId, skillId) {
        const [character, skill] = await Promise.all([
            prisma_1.prisma.character.findUnique({
                where: { id: characterId },
                select: { mana: true },
            }),
            prisma_1.prisma.skill.findUnique({
                where: { id: skillId },
                select: { manaCost: true, name: true },
            }),
        ]);
        if (!character) {
            return { canUse: false, reason: 'Character not found' };
        }
        if (!skill) {
            return { canUse: false, reason: 'Skill not found' };
        }
        if (character.mana < skill.manaCost) {
            return { canUse: false, reason: 'Not enough mana' };
        }
        return { canUse: true };
    },
    /**
     * Calcule les bonus d'élément (résistances/faiblesses futures)
     * Pour l'instant retourne 1.0 (neutre)
     */
    calculateElementalMultiplier(attackElement, defenderElement) {
        // TODO: Implémenter le système de résistances/faiblesses élémentaires
        // Par exemple: Feu > Glace, Eau > Feu, etc.
        // Pour l'instant, pas de bonus/malus élémentaire
        return 1.0;
    },
    /**
     * Calcule les dégâts d'un skill (version simplifiée pour le GameServer)
     * Retourne { damage, isCritical }
     */
    calculateDamage(attackerStats, defenderStats, baseDamage, damageScaling, damageType) {
        const result = this.calculateSkillDamage(attackerStats, defenderStats, {
            baseDamage,
            damageScaling,
            damageType,
            element: 'NONE',
        });
        return {
            damage: result.finalDamage,
            isCritical: result.isCritical,
        };
    },
};
