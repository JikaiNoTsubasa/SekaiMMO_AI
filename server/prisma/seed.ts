// SekaiMMO - Seed Database
// Version 2.0 - Données initiales complètes

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ============================================
  // WEAPON TYPES (6 types selon le CDC)
  // ============================================
  console.log('Creating weapon types...');

  const sword = await prisma.weaponType.upsert({
    where: { code: 'SWORD' },
    update: {},
    create: {
      code: 'SWORD',
      name: 'Épée',
      description: 'Une épée à une main. Équilibrée entre attaque et défense.',
      attackSpeed: 'NORMAL',
      damageType: 'PHYSICAL',
      baseCrit: 0.05,
      isRanged: false,
    },
  });

  const dualDaggers = await prisma.weaponType.upsert({
    where: { code: 'DUAL_DAGGERS' },
    update: {},
    create: {
      code: 'DUAL_DAGGERS',
      name: 'Double Dagues',
      description: 'Deux dagues légères pour des attaques rapides et des critiques fréquents.',
      attackSpeed: 'FAST',
      damageType: 'PHYSICAL',
      baseCrit: 0.20,
      isRanged: false,
    },
  });

  const bow = await prisma.weaponType.upsert({
    where: { code: 'BOW' },
    update: {},
    create: {
      code: 'BOW',
      name: 'Arc',
      description: 'Arc pour des attaques à distance précises.',
      attackSpeed: 'NORMAL',
      damageType: 'PHYSICAL',
      baseCrit: 0.10,
      isRanged: true,
    },
  });

  const twoHandedAxe = await prisma.weaponType.upsert({
    where: { code: 'TWO_HANDED_AXE' },
    update: {},
    create: {
      code: 'TWO_HANDED_AXE',
      name: 'Hache à deux mains',
      description: 'Une hache massive. Lente mais dévastatrice.',
      attackSpeed: 'SLOW',
      damageType: 'PHYSICAL',
      baseCrit: 0.05,
      isRanged: false,
    },
  });

  const wand = await prisma.weaponType.upsert({
    where: { code: 'WAND' },
    update: {},
    create: {
      code: 'WAND',
      name: 'Baguette',
      description: 'Baguette magique pour lancer des sorts rapidement.',
      attackSpeed: 'FAST',
      damageType: 'MAGICAL',
      baseCrit: 0.05,
      isRanged: true,
    },
  });

  const scepter = await prisma.weaponType.upsert({
    where: { code: 'SCEPTER' },
    update: {},
    create: {
      code: 'SCEPTER',
      name: 'Sceptre',
      description: 'Sceptre puissant pour des sorts dévastateurs.',
      attackSpeed: 'NORMAL',
      damageType: 'MAGICAL',
      baseCrit: 0.05,
      isRanged: true,
    },
  });

  // ============================================
  // SKILLS DE BASE (Rank E pour chaque arme)
  // ============================================
  console.log('Creating skills...');

  // -- Épée --
  await prisma.skill.upsert({
    where: { name: 'Frappe Basique' },
    update: {},
    create: {
      name: 'Frappe Basique',
      description: 'Une frappe simple avec l\'épée.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: sword.id,
      requiredRank: 'E',
      requiredWeaponXp: 0,
      goldCost: 0,
      baseDamage: 15,
      damageScaling: 1.0,
      cooldown: 0.5,
      manaCost: 0,
      range: 80,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Coup de Bouclier' },
    update: {},
    create: {
      name: 'Coup de Bouclier',
      description: 'Frappe avec le bouclier, étourdit brièvement l\'ennemi.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: sword.id,
      requiredRank: 'E',
      requiredWeaponXp: 100,
      goldCost: 50,
      baseDamage: 10,
      damageScaling: 0.8,
      cooldown: 8.0,
      manaCost: 15,
      range: 60,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Estoc Enflammé' },
    update: {},
    create: {
      name: 'Estoc Enflammé',
      description: 'Une estocade imprégnée de feu.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'FIRE',
      weaponTypeId: sword.id,
      requiredRank: 'D',
      requiredWeaponXp: 500,
      requiredElementXp: 100,
      goldCost: 200,
      baseDamage: 25,
      damageScaling: 1.2,
      cooldown: 6.0,
      manaCost: 25,
      range: 100,
      areaOfEffect: 0,
      telegraphShape: 'line',
      telegraphWidth: 30,
      telegraphLength: 100,
    },
  });

  // -- Double Dagues --
  await prisma.skill.upsert({
    where: { name: 'Double Entaille' },
    update: {},
    create: {
      name: 'Double Entaille',
      description: 'Deux coups rapides avec les dagues.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: dualDaggers.id,
      requiredRank: 'E',
      requiredWeaponXp: 0,
      goldCost: 0,
      baseDamage: 8,
      damageScaling: 0.6,
      cooldown: 0.3,
      manaCost: 0,
      range: 60,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Lames Empoisonnées' },
    update: {},
    create: {
      name: 'Lames Empoisonnées',
      description: 'Enduit les lames de poison pour des dégâts supplémentaires.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'DARKNESS',
      weaponTypeId: dualDaggers.id,
      requiredRank: 'E',
      requiredWeaponXp: 100,
      goldCost: 50,
      baseDamage: 5,
      damageScaling: 0.5,
      cooldown: 12.0,
      manaCost: 20,
      range: 0,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Danse des Ombres' },
    update: {},
    create: {
      name: 'Danse des Ombres',
      description: 'Se téléporte derrière l\'ennemi et attaque.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'DARKNESS',
      weaponTypeId: dualDaggers.id,
      requiredRank: 'D',
      requiredWeaponXp: 500,
      requiredElementXp: 100,
      goldCost: 200,
      baseDamage: 30,
      damageScaling: 1.5,
      cooldown: 15.0,
      manaCost: 35,
      range: 200,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  // -- Arc --
  await prisma.skill.upsert({
    where: { name: 'Tir Simple' },
    update: {},
    create: {
      name: 'Tir Simple',
      description: 'Un tir de flèche basique.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: bow.id,
      requiredRank: 'E',
      requiredWeaponXp: 0,
      goldCost: 0,
      baseDamage: 14,
      damageScaling: 1.0,
      cooldown: 0.7,
      manaCost: 0,
      range: 400,
      areaOfEffect: 0,
      telegraphShape: 'line',
      telegraphWidth: 10,
      telegraphLength: 400,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Pluie de Flèches' },
    update: {},
    create: {
      name: 'Pluie de Flèches',
      description: 'Tire plusieurs flèches en zone.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: bow.id,
      requiredRank: 'E',
      requiredWeaponXp: 100,
      goldCost: 50,
      baseDamage: 20,
      damageScaling: 0.8,
      cooldown: 10.0,
      manaCost: 30,
      range: 350,
      areaOfEffect: 100,
      telegraphShape: 'circle',
      telegraphWidth: 100,
      telegraphLength: 100,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Flèche de Glace' },
    update: {},
    create: {
      name: 'Flèche de Glace',
      description: 'Une flèche imprégnée de glace qui ralentit l\'ennemi.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'ICE',
      weaponTypeId: bow.id,
      requiredRank: 'D',
      requiredWeaponXp: 500,
      requiredElementXp: 100,
      goldCost: 200,
      baseDamage: 25,
      damageScaling: 1.1,
      cooldown: 8.0,
      manaCost: 25,
      range: 400,
      areaOfEffect: 0,
      telegraphShape: 'line',
      telegraphWidth: 15,
      telegraphLength: 400,
    },
  });

  // -- Hache à deux mains --
  await prisma.skill.upsert({
    where: { name: 'Coup de Hache' },
    update: {},
    create: {
      name: 'Coup de Hache',
      description: 'Un coup puissant de hache.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: twoHandedAxe.id,
      requiredRank: 'E',
      requiredWeaponXp: 0,
      goldCost: 0,
      baseDamage: 25,
      damageScaling: 1.3,
      cooldown: 1.5,
      manaCost: 0,
      range: 100,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Tourbillon' },
    update: {},
    create: {
      name: 'Tourbillon',
      description: 'Tourne sur soi-même en frappant tous les ennemis autour.',
      category: 'ACTIVE',
      damageType: 'PHYSICAL',
      element: 'NONE',
      weaponTypeId: twoHandedAxe.id,
      requiredRank: 'E',
      requiredWeaponXp: 100,
      goldCost: 50,
      baseDamage: 35,
      damageScaling: 1.0,
      cooldown: 12.0,
      manaCost: 25,
      range: 0,
      areaOfEffect: 120,
      telegraphShape: 'circle',
      telegraphWidth: 120,
      telegraphLength: 120,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Séisme' },
    update: {},
    create: {
      name: 'Séisme',
      description: 'Frappe le sol pour créer une onde de choc de terre.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'EARTH',
      weaponTypeId: twoHandedAxe.id,
      requiredRank: 'D',
      requiredWeaponXp: 500,
      requiredElementXp: 100,
      goldCost: 200,
      baseDamage: 40,
      damageScaling: 1.2,
      cooldown: 15.0,
      manaCost: 40,
      range: 0,
      areaOfEffect: 200,
      telegraphShape: 'circle',
      telegraphWidth: 200,
      telegraphLength: 200,
    },
  });

  // -- Baguette --
  await prisma.skill.upsert({
    where: { name: 'Orbe Arcanique' },
    update: {},
    create: {
      name: 'Orbe Arcanique',
      description: 'Lance une boule de magie pure.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'NONE',
      weaponTypeId: wand.id,
      requiredRank: 'E',
      requiredWeaponXp: 0,
      goldCost: 0,
      baseDamage: 10,
      damageScaling: 1.0,
      cooldown: 0.4,
      manaCost: 5,
      range: 350,
      areaOfEffect: 0,
      telegraphShape: null,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Boule de Feu' },
    update: {},
    create: {
      name: 'Boule de Feu',
      description: 'Lance une boule de feu explosive.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'FIRE',
      weaponTypeId: wand.id,
      requiredRank: 'E',
      requiredWeaponXp: 100,
      requiredElementXp: 50,
      goldCost: 50,
      baseDamage: 25,
      damageScaling: 1.2,
      cooldown: 5.0,
      manaCost: 20,
      range: 300,
      areaOfEffect: 80,
      telegraphShape: 'circle',
      telegraphWidth: 80,
      telegraphLength: 80,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Éclair' },
    update: {},
    create: {
      name: 'Éclair',
      description: 'Invoque un éclair sur l\'ennemi.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'LIGHTNING',
      weaponTypeId: wand.id,
      requiredRank: 'D',
      requiredWeaponXp: 500,
      requiredElementXp: 100,
      goldCost: 200,
      baseDamage: 35,
      damageScaling: 1.3,
      cooldown: 8.0,
      manaCost: 30,
      range: 400,
      areaOfEffect: 0,
      telegraphShape: 'circle',
      telegraphWidth: 40,
      telegraphLength: 40,
    },
  });

  // -- Sceptre --
  await prisma.skill.upsert({
    where: { name: 'Rayon Mystique' },
    update: {},
    create: {
      name: 'Rayon Mystique',
      description: 'Lance un rayon de magie concentrée.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'NONE',
      weaponTypeId: scepter.id,
      requiredRank: 'E',
      requiredWeaponXp: 0,
      goldCost: 0,
      baseDamage: 15,
      damageScaling: 1.1,
      cooldown: 0.8,
      manaCost: 8,
      range: 400,
      areaOfEffect: 0,
      telegraphShape: 'line',
      telegraphWidth: 20,
      telegraphLength: 400,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Vague de Lumière' },
    update: {},
    create: {
      name: 'Vague de Lumière',
      description: 'Envoie une vague de lumière purificatrice.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'LIGHT',
      weaponTypeId: scepter.id,
      requiredRank: 'E',
      requiredWeaponXp: 100,
      requiredElementXp: 50,
      goldCost: 50,
      baseDamage: 20,
      damageScaling: 1.0,
      cooldown: 6.0,
      manaCost: 25,
      range: 250,
      areaOfEffect: 60,
      telegraphShape: 'cone',
      telegraphWidth: 90,
      telegraphLength: 250,
    },
  });

  await prisma.skill.upsert({
    where: { name: 'Nova de Glace' },
    update: {},
    create: {
      name: 'Nova de Glace',
      description: 'Libère une explosion de glace autour du lanceur.',
      category: 'ACTIVE',
      damageType: 'MAGICAL',
      element: 'ICE',
      weaponTypeId: scepter.id,
      requiredRank: 'D',
      requiredWeaponXp: 500,
      requiredElementXp: 100,
      goldCost: 200,
      baseDamage: 30,
      damageScaling: 1.2,
      cooldown: 12.0,
      manaCost: 40,
      range: 0,
      areaOfEffect: 150,
      telegraphShape: 'circle',
      telegraphWidth: 150,
      telegraphLength: 150,
    },
  });

  // ============================================
  // ITEMS
  // ============================================
  console.log('Creating items...');

  // -- Armes de départ (Rank E) --
  const starterSword = await prisma.item.upsert({
    where: { name: 'Épée de Recrue' },
    update: {},
    create: {
      name: 'Épée de Recrue',
      description: 'Une épée simple pour les débutants.',
      type: 'WEAPON',
      rarity: 'COMMON',
      weaponTypeId: sword.id,
      requiredRank: 'E',
      stats: JSON.stringify({ physicalAttack: 5 }),
      equipmentSlot: 'MAIN_HAND',
      maxStack: 1,
      buyPrice: 100,
      sellPrice: 25,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Dagues de Novice' },
    update: {},
    create: {
      name: 'Dagues de Novice',
      description: 'Paire de dagues légères pour les débutants.',
      type: 'WEAPON',
      rarity: 'COMMON',
      weaponTypeId: dualDaggers.id,
      requiredRank: 'E',
      stats: JSON.stringify({ physicalAttack: 3, critChance: 0.05 }),
      equipmentSlot: 'MAIN_HAND',
      maxStack: 1,
      buyPrice: 100,
      sellPrice: 25,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Arc Court' },
    update: {},
    create: {
      name: 'Arc Court',
      description: 'Un arc simple mais efficace.',
      type: 'WEAPON',
      rarity: 'COMMON',
      weaponTypeId: bow.id,
      requiredRank: 'E',
      stats: JSON.stringify({ physicalAttack: 4 }),
      equipmentSlot: 'MAIN_HAND',
      maxStack: 1,
      buyPrice: 100,
      sellPrice: 25,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Hache de Bûcheron' },
    update: {},
    create: {
      name: 'Hache de Bûcheron',
      description: 'Une hache reconvertie pour le combat.',
      type: 'WEAPON',
      rarity: 'COMMON',
      weaponTypeId: twoHandedAxe.id,
      requiredRank: 'E',
      stats: JSON.stringify({ physicalAttack: 8 }),
      equipmentSlot: 'MAIN_HAND',
      maxStack: 1,
      buyPrice: 100,
      sellPrice: 25,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Baguette d\'Apprenti' },
    update: {},
    create: {
      name: 'Baguette d\'Apprenti',
      description: 'Une baguette basique pour les apprentis mages.',
      type: 'WEAPON',
      rarity: 'COMMON',
      weaponTypeId: wand.id,
      requiredRank: 'E',
      stats: JSON.stringify({ magicalAttack: 5 }),
      equipmentSlot: 'MAIN_HAND',
      maxStack: 1,
      buyPrice: 100,
      sellPrice: 25,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Sceptre de Débutant' },
    update: {},
    create: {
      name: 'Sceptre de Débutant',
      description: 'Un sceptre simple mais fiable.',
      type: 'WEAPON',
      rarity: 'COMMON',
      weaponTypeId: scepter.id,
      requiredRank: 'E',
      stats: JSON.stringify({ magicalAttack: 6 }),
      equipmentSlot: 'MAIN_HAND',
      maxStack: 1,
      buyPrice: 100,
      sellPrice: 25,
    },
  });

  // -- Consommables --
  await prisma.item.upsert({
    where: { name: 'Potion de Vie Mineure' },
    update: {},
    create: {
      name: 'Potion de Vie Mineure',
      description: 'Restaure 50 points de vie.',
      type: 'CONSUMABLE',
      rarity: 'COMMON',
      stats: JSON.stringify({ healAmount: 50 }),
      maxStack: 99,
      buyPrice: 20,
      sellPrice: 5,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Potion de Mana Mineure' },
    update: {},
    create: {
      name: 'Potion de Mana Mineure',
      description: 'Restaure 30 points de mana.',
      type: 'CONSUMABLE',
      rarity: 'COMMON',
      stats: JSON.stringify({ manaAmount: 30 }),
      maxStack: 99,
      buyPrice: 25,
      sellPrice: 6,
    },
  });

  // -- Matériaux --
  const jellyCore = await prisma.item.upsert({
    where: { name: 'Noyau de Gelée' },
    update: {},
    create: {
      name: 'Noyau de Gelée',
      description: 'Un noyau visqueux laissé par les gelées.',
      type: 'MATERIAL',
      rarity: 'COMMON',
      maxStack: 9999,
      buyPrice: 0,
      sellPrice: 2,
    },
  });

  const wolfFang = await prisma.item.upsert({
    where: { name: 'Croc de Loup' },
    update: {},
    create: {
      name: 'Croc de Loup',
      description: 'Un croc acéré de loup des prairies.',
      type: 'MATERIAL',
      rarity: 'COMMON',
      maxStack: 9999,
      buyPrice: 0,
      sellPrice: 5,
    },
  });

  const goblinEar = await prisma.item.upsert({
    where: { name: 'Oreille de Gobelin' },
    update: {},
    create: {
      name: 'Oreille de Gobelin',
      description: 'Une oreille pointue de gobelin.',
      type: 'MATERIAL',
      rarity: 'UNCOMMON',
      maxStack: 9999,
      buyPrice: 0,
      sellPrice: 10,
    },
  });

  // ============================================
  // DROP TABLES
  // ============================================
  console.log('Creating drop tables...');

  const jellyDropTable = await prisma.dropTable.upsert({
    where: { name: 'Loot Gelée' },
    update: {},
    create: {
      name: 'Loot Gelée',
      items: {
        create: [
          { itemId: jellyCore.id, probability: 0.5, minQuantity: 1, maxQuantity: 2 },
        ],
      },
    },
  });

  const wolfDropTable = await prisma.dropTable.upsert({
    where: { name: 'Loot Loup' },
    update: {},
    create: {
      name: 'Loot Loup',
      items: {
        create: [
          { itemId: wolfFang.id, probability: 0.3, minQuantity: 1, maxQuantity: 1 },
        ],
      },
    },
  });

  const goblinDropTable = await prisma.dropTable.upsert({
    where: { name: 'Loot Gobelin' },
    update: {},
    create: {
      name: 'Loot Gobelin',
      items: {
        create: [
          { itemId: goblinEar.id, probability: 0.25, minQuantity: 1, maxQuantity: 1 },
        ],
      },
    },
  });

  // ============================================
  // MONSTERS
  // ============================================
  console.log('Creating monsters...');

  const peacefulJelly = await prisma.monster.upsert({
    where: { name: 'Gelée Paisible' },
    update: {},
    create: {
      name: 'Gelée Paisible',
      description: 'Une gelée inoffensive qui rebondit tranquillement.',
      level: 1,
      health: 30,
      physicalAttack: 3,
      magicalAttack: 0,
      physicalDefense: 2,
      magicalDefense: 2,
      movementSpeed: 50,
      attackRange: 30,
      baseExperience: 5,
      goldMin: 1,
      goldMax: 3,
      element: 'NONE',
      dropTableId: jellyDropTable.id,
      respawnTime: 15,
    },
  });

  const prairieWolf = await prisma.monster.upsert({
    where: { name: 'Loup des Prairies' },
    update: {},
    create: {
      name: 'Loup des Prairies',
      description: 'Un loup sauvage qui chasse dans les prairies.',
      level: 3,
      health: 80,
      physicalAttack: 12,
      magicalAttack: 0,
      physicalDefense: 5,
      magicalDefense: 3,
      movementSpeed: 150,
      attackRange: 40,
      baseExperience: 15,
      goldMin: 5,
      goldMax: 12,
      element: 'NONE',
      dropTableId: wolfDropTable.id,
      respawnTime: 30,
    },
  });

  const forestGoblin = await prisma.monster.upsert({
    where: { name: 'Gobelin des Bois' },
    update: {},
    create: {
      name: 'Gobelin des Bois',
      description: 'Un gobelin sournois qui tend des embuscades.',
      level: 5,
      health: 120,
      physicalAttack: 18,
      magicalAttack: 5,
      physicalDefense: 8,
      magicalDefense: 6,
      movementSpeed: 100,
      attackRange: 50,
      baseExperience: 25,
      goldMin: 10,
      goldMax: 25,
      element: 'NONE',
      dropTableId: goblinDropTable.id,
      respawnTime: 45,
    },
  });

  // ============================================
  // MAPS
  // ============================================
  console.log('Creating maps...');

  const startingVillage = await prisma.gameMap.upsert({
    where: { code: 'starting_village' },
    update: {},
    create: {
      code: 'starting_village',
      name: 'Village de Départ',
      description: 'Un petit village paisible où les aventuriers commencent leur périple.',
      width: 1600,
      height: 1200,
      pvpEnabled: false,
      portals: JSON.stringify([
        { targetMapCode: 'peaceful_prairie', x: 1550, y: 600, width: 50, height: 100 },
      ]),
    },
  });

  const peacefulPrairie = await prisma.gameMap.upsert({
    where: { code: 'peaceful_prairie' },
    update: {},
    create: {
      code: 'peaceful_prairie',
      name: 'Prairie Paisible',
      description: 'Une vaste prairie verdoyante, idéale pour les débutants.',
      width: 2000,
      height: 1500,
      pvpEnabled: false,
      portals: JSON.stringify([
        { targetMapCode: 'starting_village', x: 50, y: 750, width: 50, height: 100 },
        { targetMapCode: 'dark_forest', x: 1950, y: 750, width: 50, height: 100 },
      ]),
    },
  });

  const darkForest = await prisma.gameMap.upsert({
    where: { code: 'dark_forest' },
    update: {},
    create: {
      code: 'dark_forest',
      name: 'Forêt Sombre',
      description: 'Une forêt dense où rôdent des créatures dangereuses.',
      width: 2400,
      height: 1800,
      pvpEnabled: false,
      portals: JSON.stringify([
        { targetMapCode: 'peaceful_prairie', x: 50, y: 900, width: 50, height: 100 },
      ]),
    },
  });

  const pvpArena = await prisma.gameMap.upsert({
    where: { code: 'pvp_arena' },
    update: {},
    create: {
      code: 'pvp_arena',
      name: 'Arène de Combat',
      description: 'Une arène où les combattants peuvent s\'affronter.',
      width: 800,
      height: 800,
      pvpEnabled: true,
      portals: JSON.stringify([
        { targetMapCode: 'starting_village', x: 400, y: 750, width: 100, height: 50 },
      ]),
    },
  });

  // ============================================
  // MONSTER SPAWNS
  // ============================================
  console.log('Creating monster spawns...');

  // Supprimer les spawns existants pour éviter les doublons
  await prisma.monsterSpawn.deleteMany({});

  // Quelques gelées au village pour les tests (zone d'entraînement)
  await prisma.monsterSpawn.createMany({
    data: [
      { mapId: startingVillage.id, monsterId: peacefulJelly.id, positionX: 1200, positionY: 300, patrolRadius: 80, maxCount: 2 },
      { mapId: startingVillage.id, monsterId: peacefulJelly.id, positionX: 1300, positionY: 500, patrolRadius: 80, maxCount: 2 },
    ],
  });

  // Gelées dans la prairie
  await prisma.monsterSpawn.createMany({
    data: [
      { mapId: peacefulPrairie.id, monsterId: peacefulJelly.id, positionX: 400, positionY: 400, patrolRadius: 100, maxCount: 3 },
      { mapId: peacefulPrairie.id, monsterId: peacefulJelly.id, positionX: 800, positionY: 600, patrolRadius: 100, maxCount: 3 },
      { mapId: peacefulPrairie.id, monsterId: peacefulJelly.id, positionX: 1200, positionY: 400, patrolRadius: 100, maxCount: 2 },
    ],
  });

  // Loups dans la prairie (zone plus difficile)
  await prisma.monsterSpawn.createMany({
    data: [
      { mapId: peacefulPrairie.id, monsterId: prairieWolf.id, positionX: 1500, positionY: 300, patrolRadius: 150, maxCount: 2 },
      { mapId: peacefulPrairie.id, monsterId: prairieWolf.id, positionX: 1600, positionY: 800, patrolRadius: 150, maxCount: 2 },
    ],
  });

  // Gobelins dans la forêt
  await prisma.monsterSpawn.createMany({
    data: [
      { mapId: darkForest.id, monsterId: forestGoblin.id, positionX: 500, positionY: 500, patrolRadius: 200, maxCount: 3 },
      { mapId: darkForest.id, monsterId: forestGoblin.id, positionX: 1200, positionY: 800, patrolRadius: 200, maxCount: 3 },
      { mapId: darkForest.id, monsterId: forestGoblin.id, positionX: 1800, positionY: 1200, patrolRadius: 200, maxCount: 4 },
    ],
  });

  // ============================================
  // NPCs
  // ============================================
  console.log('Creating NPCs...');

  // Supprimer les NPCs existants pour éviter les doublons
  await prisma.nPC.deleteMany({});

  // Maîtres d'armes dans le village
  await prisma.nPC.createMany({
    data: [
      {
        name: 'Aldric',
        title: 'Maître d\'Épée',
        mapId: startingVillage.id,
        positionX: 300,
        positionY: 400,
        isWeaponMaster: true,
        weaponMasterFor: 'SWORD',
        dialogue: JSON.stringify([
          'Bienvenue, jeune aventurier!',
          'Je peux t\'enseigner l\'art de l\'épée.',
          'Reviens me voir quand tu auras gagné assez d\'expérience.',
        ]),
      },
      {
        name: 'Sylara',
        title: 'Maître des Dagues',
        mapId: startingVillage.id,
        positionX: 400,
        positionY: 400,
        isWeaponMaster: true,
        weaponMasterFor: 'DUAL_DAGGERS',
        dialogue: JSON.stringify([
          'Les ombres sont mes alliées...',
          'Veux-tu apprendre à frapper vite et fort?',
        ]),
      },
      {
        name: 'Thorin',
        title: 'Maître Archer',
        mapId: startingVillage.id,
        positionX: 500,
        positionY: 400,
        isWeaponMaster: true,
        weaponMasterFor: 'BOW',
        dialogue: JSON.stringify([
          'Un bon archer ne rate jamais sa cible.',
          'Viens, je vais t\'apprendre à viser juste.',
        ]),
      },
      {
        name: 'Grumok',
        title: 'Maître de la Hache',
        mapId: startingVillage.id,
        positionX: 600,
        positionY: 400,
        isWeaponMaster: true,
        weaponMasterFor: 'TWO_HANDED_AXE',
        dialogue: JSON.stringify([
          'HAHA! Tu veux apprendre à manier la hache?',
          'Il faut de la force, de la patience... et encore de la force!',
        ]),
      },
      {
        name: 'Elara',
        title: 'Maître de la Baguette',
        mapId: startingVillage.id,
        positionX: 700,
        positionY: 400,
        isWeaponMaster: true,
        weaponMasterFor: 'WAND',
        dialogue: JSON.stringify([
          'La magie coule en toute chose...',
          'Laisse-moi t\'enseigner à la canaliser.',
        ]),
      },
      {
        name: 'Meldric',
        title: 'Maître du Sceptre',
        mapId: startingVillage.id,
        positionX: 800,
        positionY: 400,
        isWeaponMaster: true,
        weaponMasterFor: 'SCEPTER',
        dialogue: JSON.stringify([
          'Le sceptre est l\'arme des sages.',
          'Avec lui, tu pourras déchaîner des sorts puissants.',
        ]),
      },
    ],
  });

  // Maîtres élémentaires
  await prisma.nPC.createMany({
    data: [
      {
        name: 'Pyrus',
        title: 'Maître du Feu',
        mapId: startingVillage.id,
        positionX: 300,
        positionY: 600,
        isElementMaster: true,
        elementMasterFor: 'FIRE',
        dialogue: JSON.stringify(['Le feu consume tout sur son passage...', 'Es-tu prêt à maîtriser les flammes?']),
      },
      {
        name: 'Aquara',
        title: 'Maître de l\'Eau',
        mapId: startingVillage.id,
        positionX: 400,
        positionY: 600,
        isElementMaster: true,
        elementMasterFor: 'WATER',
        dialogue: JSON.stringify(['L\'eau est source de vie... et de destruction.']),
      },
      {
        name: 'Terros',
        title: 'Maître de la Terre',
        mapId: startingVillage.id,
        positionX: 500,
        positionY: 600,
        isElementMaster: true,
        elementMasterFor: 'EARTH',
        dialogue: JSON.stringify(['La terre est patiente mais implacable.']),
      },
      {
        name: 'Ventus',
        title: 'Maître de l\'Air',
        mapId: startingVillage.id,
        positionX: 600,
        positionY: 600,
        isElementMaster: true,
        elementMasterFor: 'AIR',
        dialogue: JSON.stringify(['Le vent souffle où il veut...']),
      },
      {
        name: 'Fulgor',
        title: 'Maître de la Foudre',
        mapId: startingVillage.id,
        positionX: 700,
        positionY: 600,
        isElementMaster: true,
        elementMasterFor: 'LIGHTNING',
        dialogue: JSON.stringify(['La foudre frappe sans prévenir!']),
      },
      {
        name: 'Glacius',
        title: 'Maître de la Glace',
        mapId: startingVillage.id,
        positionX: 800,
        positionY: 600,
        isElementMaster: true,
        elementMasterFor: 'ICE',
        dialogue: JSON.stringify(['Le froid engourdit l\'esprit et le corps.']),
      },
      {
        name: 'Umbra',
        title: 'Maître des Ténèbres',
        mapId: startingVillage.id,
        positionX: 300,
        positionY: 700,
        isElementMaster: true,
        elementMasterFor: 'DARKNESS',
        dialogue: JSON.stringify(['Les ténèbres révèlent la vraie nature de chacun...']),
      },
      {
        name: 'Lumen',
        title: 'Maître de la Lumière',
        mapId: startingVillage.id,
        positionX: 400,
        positionY: 700,
        isElementMaster: true,
        elementMasterFor: 'LIGHT',
        dialogue: JSON.stringify(['La lumière chasse les ténèbres et révèle la vérité.']),
      },
    ],
  });

  // Marchands
  await prisma.nPC.createMany({
    data: [
      {
        name: 'Marcus',
        title: 'Marchand d\'Armes',
        mapId: startingVillage.id,
        positionX: 500,
        positionY: 800,
        isMerchant: true,
        shopItems: JSON.stringify([
          { itemId: starterSword.id, price: 100 },
        ]),
        dialogue: JSON.stringify(['Des armes de qualité pour les aventuriers!']),
      },
      {
        name: 'Helena',
        title: 'Apothicaire',
        mapId: startingVillage.id,
        positionX: 600,
        positionY: 800,
        isMerchant: true,
        shopItems: JSON.stringify([]),
        dialogue: JSON.stringify(['Potions, remèdes... j\'ai tout ce qu\'il vous faut!']),
      },
    ],
  });

  // Banquier
  await prisma.nPC.createMany({
    data: [
      {
        name: 'Rothgar',
        title: 'Banquier',
        mapId: startingVillage.id,
        positionX: 700,
        positionY: 800,
        isBanker: true,
        dialogue: JSON.stringify(['Votre fortune est en sécurité avec moi.', 'Désirez-vous accéder à votre coffre?']),
      },
    ],
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
