import {
  DamageType,
  ItemRarity,
  ItemType,
  PrismaClient,
  SkillCategory,
  WeaponCode
} from '../src/generated/prisma';

const prisma = new PrismaClient();

const weaponTypesSeed = [
  {
    code: WeaponCode.SWORD_SHIELD,
    name: 'Épée et bouclier',
    description: 'Arme équilibrée, idéale pour débuter.'
  },
  {
    code: WeaponCode.SPEAR,
    name: 'Lance',
    description: 'Grande portée et attaques perforantes.'
  },
  {
    code: WeaponCode.BOW,
    name: 'Arc et flèches',
    description: 'Attaques à distance rapides.'
  },
  {
    code: WeaponCode.SCEPTER,
    name: 'Sceptre',
    description: 'Canalise la magie élémentaire.'
  },
  {
    code: WeaponCode.DAGGER,
    name: 'Dagues',
    description: 'Attaques rapides à courte portée.'
  },
  {
    code: WeaponCode.GAUNTLET,
    name: 'Gants de combat',
    description: 'Style de combat rapproché basé sur les combos.'
  }
];

const skillsSeed = [
  {
    name: 'Frappe du bouclier',
    description: 'Assène un coup étourdissant avec le bouclier.',
    category: SkillCategory.ACTIVE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 24,
    cooldown: 8,
    resourceCost: 30,
    weapon: WeaponCode.SWORD_SHIELD
  },
  {
    name: 'Posture défensive',
    description: 'Augmente la défense physique pendant un court instant.',
    category: SkillCategory.PASSIVE,
    damageType: DamageType.PURE,
    baseDamage: 0,
    cooldown: 0,
    resourceCost: 0,
    weapon: WeaponCode.SWORD_SHIELD
  },
  {
    name: 'Percée fulgurante',
    description: 'Charge en ligne droite et inflige des dégâts perforants.',
    category: SkillCategory.ACTIVE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 32,
    cooldown: 10,
    resourceCost: 25,
    weapon: WeaponCode.SPEAR
  },
  {
    name: 'Pluie de flèches',
    description: 'Tire une salve de flèches dans une zone ciblée.',
    category: SkillCategory.ACTIVE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 28,
    cooldown: 12,
    resourceCost: 40,
    weapon: WeaponCode.BOW
  },
  {
    name: 'Orbe arcanique',
    description: 'Projette une sphère magique qui explose à l’impact.',
    category: SkillCategory.ACTIVE,
    damageType: DamageType.MAGICAL,
    baseDamage: 35,
    cooldown: 9,
    resourceCost: 45,
    weapon: WeaponCode.SCEPTER
  }
];

const itemsSeed = [
  {
    name: 'Épée de recrue',
    description: 'Une épée simple fournie aux aventuriers débutants.',
    type: ItemType.WEAPON,
    rarity: ItemRarity.COMMON,
    weapon: WeaponCode.SWORD_SHIELD
  },
  {
    name: 'Potion de soin mineure',
    description: 'Restaure une petite quantité de santé.',
    type: ItemType.CONSUMABLE,
    rarity: ItemRarity.COMMON
  },
  {
    name: 'Essence magique',
    description: 'Matériau utilisé pour améliorer les sorts.',
    type: ItemType.MATERIAL,
    rarity: ItemRarity.UNCOMMON
  }
];

const monstersSeed = [
  {
    name: 'Gelée paisible',
    baseExperience: 12,
    dropTableName: 'Butin de gelée'
  },
  {
    name: 'Loup de prairie',
    baseExperience: 18,
    dropTableName: 'Butin de loup'
  }
];

const dropTablesSeed = [
  {
    name: 'Butin de gelée',
    items: [
      {
        itemName: 'Potion de soin mineure',
        probability: 0.65,
        minQuantity: 1,
        maxQuantity: 2
      },
      {
        itemName: 'Essence magique',
        probability: 0.2,
        minQuantity: 1,
        maxQuantity: 1
      }
    ]
  },
  {
    name: 'Butin de loup',
    items: [
      {
        itemName: 'Potion de soin mineure',
        probability: 0.5,
        minQuantity: 1,
        maxQuantity: 1
      }
    ]
  }
];

const seed = async () => {
  console.log('Seeding weapon types...');
  for (const weapon of weaponTypesSeed) {
    await prisma.weaponType.upsert({
      where: { code: weapon.code },
      update: {
        name: weapon.name,
        description: weapon.description
      },
      create: {
        code: weapon.code,
        name: weapon.name,
        description: weapon.description
      }
    });
  }

  const weaponLookup = await prisma.weaponType.findMany();
  const weaponMap = new Map(weaponLookup.map((weapon) => [weapon.code, weapon.id]));

  console.log('Seeding items...');
  for (const item of itemsSeed) {
    await prisma.item.upsert({
      where: { name: item.name },
      update: {
        description: item.description,
        type: item.type,
        rarity: item.rarity,
        weaponTypeId: item.weapon ? weaponMap.get(item.weapon) ?? null : null
      },
      create: {
        name: item.name,
        description: item.description,
        type: item.type,
        rarity: item.rarity,
        weaponTypeId: item.weapon ? weaponMap.get(item.weapon) ?? null : null
      }
    });
  }

  console.log('Seeding skills...');
  for (const skill of skillsSeed) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: {
        description: skill.description,
        category: skill.category,
        damageType: skill.damageType,
        baseDamage: skill.baseDamage,
        cooldown: skill.cooldown,
        resourceCost: skill.resourceCost,
        weaponTypeId: weaponMap.get(skill.weapon) ?? null
      },
      create: {
        name: skill.name,
        description: skill.description,
        category: skill.category,
        damageType: skill.damageType,
        baseDamage: skill.baseDamage,
        cooldown: skill.cooldown,
        resourceCost: skill.resourceCost,
        weaponTypeId: weaponMap.get(skill.weapon) ?? null
      }
    });
  }

  const itemLookup = await prisma.item.findMany();
  const itemMap = new Map(itemLookup.map((item) => [item.name, item.id]));

  console.log('Seeding drop tables...');
  for (const table of dropTablesSeed) {
    const createItems = table.items.map((item) => {
      const itemId = itemMap.get(item.itemName);

      if (!itemId) {
        throw new Error(`Item ${item.itemName} missing for drop table ${table.name}`);
      }

      return {
        itemId,
        probability: item.probability,
        minQuantity: item.minQuantity,
        maxQuantity: item.maxQuantity
      };
    });

    await prisma.dropTable.upsert({
      where: { name: table.name },
      update: {
        items: {
          deleteMany: {},
          create: createItems
        }
      },
      create: {
        name: table.name,
        items: {
          create: createItems
        }
      }
    });
  }

  const dropTables = await prisma.dropTable.findMany();
  const dropTableMap = new Map(dropTables.map((table) => [table.name, table.id]));

  console.log('Seeding monsters...');
  for (const monster of monstersSeed) {
    await prisma.monster.upsert({
      where: { name: monster.name },
      update: {
        baseExperience: monster.baseExperience,
        dropTableId: dropTableMap.get(monster.dropTableName) ?? null
      },
      create: {
        name: monster.name,
        baseExperience: monster.baseExperience,
        dropTableId: dropTableMap.get(monster.dropTableName) ?? null
      }
    });
  }

  console.log('Seed completed.');
};

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
