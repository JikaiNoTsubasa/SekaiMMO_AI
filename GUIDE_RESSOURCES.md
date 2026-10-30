# Guide des Ressources - SekaiMMO

Ce document décrit les ressources graphiques et audio nécessaires au jeu et comment les intégrer.

---

## Structure des Dossiers

```
client/
├── public/
│   ├── assets/
│   │   ├── sprites/          # Sprites des personnages et monstres
│   │   │   ├── characters/   # Sprites de personnages jouables
│   │   │   ├── monsters/     # Sprites des monstres
│   │   │   └── npcs/         # Sprites des PNJs
│   │   ├── tilesets/         # Tilesets pour les maps
│   │   ├── items/            # Icônes des items
│   │   ├── skills/           # Icônes et effets des skills
│   │   ├── ui/               # Éléments d'interface
│   │   └── audio/            # Sons et musiques
│   │       ├── sfx/          # Effets sonores
│   │       └── music/        # Musiques d'ambiance
│   └── maps/                 # Fichiers Tiled (.tmj)
```

---

## 1. Sprites des Personnages

### Format Requis
- **Type**: Spritesheet PNG avec canal alpha
- **Taille de frame**: 64x64 pixels (recommandé)
- **Animations requises**:
  - `idle` (4 frames) - repos
  - `walk` (8 frames) - marche dans 4 directions (bas, gauche, droite, haut)
  - `attack` (6 frames) - attaque par type d'arme

### Structure du Spritesheet
```
┌────┬────┬────┬────┐
│idle│idle│idle│idle│  Ligne 0: Idle (4 frames)
├────┼────┼────┼────┤
│walk│walk│walk│walk│  Lignes 1-4: Walk down/left/right/up (8 frames chacune)
│walk│walk│walk│walk│
├────┼────┼────┼────┤
│atk │atk │atk │atk │  Lignes 5+: Attack par arme (6 frames)
│atk │atk │    │    │
└────┴────┴────┴────┘
```

### Fichiers à Créer
```
public/assets/sprites/characters/
├── base_character.png       # Spritesheet du personnage de base
├── base_character.json      # Définition des animations (Phaser)
├── hair_style_1.png         # Cheveux variante 1
├── hair_style_2.png         # ...etc
└── weapons/
    ├── sword.png            # Sprite de l'épée
    ├── dual_daggers.png     # Sprite des dagues
    ├── bow.png              # Sprite de l'arc
    ├── two_handed_axe.png   # Sprite de la hache
    ├── wand.png             # Sprite de la baguette
    └── scepter.png          # Sprite du sceptre
```

### Exemple de fichier JSON (Phaser Atlas)
```json
{
  "textures": [{
    "image": "base_character.png",
    "format": "RGBA8888",
    "size": { "w": 256, "h": 384 },
    "scale": 1,
    "frames": [
      { "filename": "idle_0", "frame": { "x": 0, "y": 0, "w": 64, "h": 64 } },
      { "filename": "idle_1", "frame": { "x": 64, "y": 0, "w": 64, "h": 64 } },
      { "filename": "walk_down_0", "frame": { "x": 0, "y": 64, "w": 64, "h": 64 } }
    ]
  }]
}
```

---

## 2. Sprites des Monstres

### Monstres Requis (selon seed.ts)
| Nom | Description | Niveau | Taille suggérée |
|-----|-------------|--------|-----------------|
| `peaceful_jelly` | Gelée Paisible | 1 | 48x48 |
| `prairie_wolf` | Loup des Prairies | 3 | 64x64 |
| `forest_goblin` | Gobelin des Bois | 5 | 64x64 |

### Animations Requises par Monstre
- `idle` (4 frames)
- `walk` (4 frames, 4 directions)
- `attack` (4 frames)
- `death` (4 frames)
- `hurt` (2 frames)

### Fichiers à Créer
```
public/assets/sprites/monsters/
├── peaceful_jelly.png
├── peaceful_jelly.json
├── prairie_wolf.png
├── prairie_wolf.json
├── forest_goblin.png
└── forest_goblin.json
```

---

## 3. Sprites des PNJs

### PNJs Requis (selon seed.ts)
| Code | Nom | Rôle |
|------|-----|------|
| `aldric` | Aldric | Maître d'Épée |
| `sylara` | Sylara | Maître des Dagues |
| `thorin` | Thorin | Maître Archer |
| `grumok` | Grumok | Maître de la Hache |
| `elara` | Elara | Maître de la Baguette |
| `meldric` | Meldric | Maître du Sceptre |
| `pyrus` | Pyrus | Maître du Feu |
| `aquara` | Aquara | Maître de l'Eau |
| `terros` | Terros | Maître de la Terre |
| `ventus` | Ventus | Maître de l'Air |
| `fulgor` | Fulgor | Maître de la Foudre |
| `glacius` | Glacius | Maître de la Glace |
| `umbra` | Umbra | Maître des Ténèbres |
| `lumen` | Lumen | Maître de la Lumière |
| `marcus` | Marcus | Marchand d'Armes |
| `helena` | Helena | Apothicaire |
| `rothgar` | Rothgar | Banquier |

### Format
- Taille: 64x64 pixels
- Animations: `idle` uniquement (4 frames)

---

## 4. Tilesets pour Maps

### Format Tiled
- **Taille des tuiles**: 32x32 pixels
- **Format**: PNG
- **Compatibilité**: Tiled Map Editor

### Tilesets Requis
```
public/assets/tilesets/
├── terrain.png          # Herbe, terre, eau, routes
├── buildings.png        # Maisons, boutiques, murs
├── vegetation.png       # Arbres, buissons, fleurs
├── dungeon.png          # Donjons, grottes
└── decorations.png      # Objets décoratifs
```

### Configuration Tiled
1. Créer un nouveau tileset dans Tiled
2. Taille de tuile: 32x32
3. Exporter en JSON (format Tiled JSON)
4. Placer dans `public/maps/`

---

## 5. Icônes des Items

### Format
- Taille: 32x32 ou 64x64 pixels
- Format: PNG avec transparence
- Nommage: `item_{id}.png` ou `item_{nom}.png`

### Items Requis (selon seed.ts)
```
public/assets/items/
├── weapons/
│   ├── starter_sword.png        # Épée de Recrue
│   ├── novice_daggers.png       # Dagues de Novice
│   ├── short_bow.png            # Arc Court
│   ├── woodcutter_axe.png       # Hache de Bûcheron
│   ├── apprentice_wand.png      # Baguette d'Apprenti
│   └── beginner_scepter.png     # Sceptre de Débutant
├── consumables/
│   ├── minor_health_potion.png  # Potion de Vie Mineure
│   └── minor_mana_potion.png    # Potion de Mana Mineure
└── materials/
    ├── jelly_core.png           # Noyau de Gelée
    ├── wolf_fang.png            # Croc de Loup
    └── goblin_ear.png           # Oreille de Gobelin
```

---

## 6. Icônes des Skills

### Format
- Taille: 48x48 ou 64x64 pixels
- Format: PNG avec transparence
- Style: Icônes stylisées (type MMO)

### Skills Requis (18 skills selon seed.ts)
```
public/assets/skills/
├── sword/
│   ├── basic_strike.png         # Frappe Basique
│   ├── shield_bash.png          # Coup de Bouclier
│   └── fire_thrust.png          # Estoc Enflammé
├── dual_daggers/
│   ├── double_slash.png         # Double Entaille
│   ├── poison_blades.png        # Lames Empoisonnées
│   └── shadow_dance.png         # Danse des Ombres
├── bow/
│   ├── simple_shot.png          # Tir Simple
│   ├── arrow_rain.png           # Pluie de Flèches
│   └── ice_arrow.png            # Flèche de Glace
├── axe/
│   ├── axe_strike.png           # Coup de Hache
│   ├── whirlwind.png            # Tourbillon
│   └── earthquake.png           # Séisme
├── wand/
│   ├── arcane_orb.png           # Orbe Arcanique
│   ├── fireball.png             # Boule de Feu
│   └── lightning.png            # Éclair
└── scepter/
    ├── mystic_ray.png           # Rayon Mystique
    ├── light_wave.png           # Vague de Lumière
    └── ice_nova.png             # Nova de Glace
```

---

## 7. Effets Visuels des Skills

### Format
- Spritesheets animés
- Taille variable selon l'effet
- Canal alpha obligatoire

### Effets Requis
```
public/assets/skills/effects/
├── elements/
│   ├── fire_effect.png          # Effet feu (particules)
│   ├── ice_effect.png           # Effet glace
│   ├── lightning_effect.png     # Effet foudre
│   ├── earth_effect.png         # Effet terre
│   ├── water_effect.png         # Effet eau
│   ├── air_effect.png           # Effet air
│   ├── light_effect.png         # Effet lumière
│   └── darkness_effect.png      # Effet ténèbres
├── shapes/
│   ├── circle_telegraph.png     # Zone circulaire
│   ├── line_telegraph.png       # Zone ligne
│   └── cone_telegraph.png       # Zone cône
└── hits/
    ├── physical_hit.png         # Impact physique
    └── magical_hit.png          # Impact magique
```

---

## 8. Éléments UI

```
public/assets/ui/
├── frames/
│   ├── panel_bg.png             # Fond de panneau
│   ├── button_normal.png        # Bouton normal
│   ├── button_hover.png         # Bouton survol
│   ├── button_pressed.png       # Bouton pressé
│   └── slot_bg.png              # Fond de slot (inventaire)
├── icons/
│   ├── gold.png                 # Icône or
│   ├── premium.png              # Icône monnaie premium
│   ├── health.png               # Icône vie
│   ├── mana.png                 # Icône mana
│   └── rank_*.png               # Icônes de rank (E, D, C, B, A)
└── cursors/
    ├── normal.png               # Curseur normal
    ├── attack.png               # Curseur attaque
    └── interact.png             # Curseur interaction
```

---

## 9. Audio

### Effets Sonores (SFX)
```
public/assets/audio/sfx/
├── combat/
│   ├── sword_hit.wav
│   ├── dagger_hit.wav
│   ├── bow_shot.wav
│   ├── axe_hit.wav
│   ├── magic_cast.wav
│   └── critical_hit.wav
├── ui/
│   ├── button_click.wav
│   ├── inventory_open.wav
│   ├── item_pickup.wav
│   └── level_up.wav
└── ambient/
    ├── footstep_grass.wav
    ├── footstep_stone.wav
    └── portal.wav
```

### Musiques
```
public/assets/audio/music/
├── village.ogg              # Village de départ
├── prairie.ogg              # Prairie paisible
├── forest.ogg               # Forêt sombre
├── combat.ogg               # Musique de combat
└── boss.ogg                 # Musique de boss
```

---

## 10. Maps Tiled

### Structure des Fichiers
```
public/maps/
├── starting_village.json    # Village de départ
├── peaceful_prairie.json    # Prairie paisible
├── dark_forest.json         # Forêt sombre
├── pvp_arena.json           # Arène PvP
└── tilesets/
    └── *.tsx                # Fichiers tileset Tiled
```

### Layers Requis par Map
1. `ground` - Sol de base
2. `terrain` - Variations de terrain
3. `decorations_below` - Décorations sous le joueur
4. `collisions` - Zones de collision (invisible)
5. `decorations_above` - Décorations au-dessus du joueur
6. `objects` - Objets interactifs (portails, coffres)

### Propriétés Personnalisées
- **Portails**: Objet avec propriété `targetMap` et `spawnX`, `spawnY`
- **Spawn points**: Objet avec propriété `type: "spawn"` et `monsterId`
- **NPCs**: Objet avec propriété `type: "npc"` et `npcId`

---

## Comment Intégrer les Ressources

### 1. Ajouter un nouveau monstre

1. Créer le sprite dans `public/assets/sprites/monsters/`
2. Ajouter dans `prisma/seed.ts`:
```typescript
const newMonster = await prisma.monster.upsert({
  where: { name: 'Nom du Monstre' },
  update: {},
  create: {
    name: 'Nom du Monstre',
    level: 5,
    health: 100,
    // ... autres stats
  },
});
```
3. Créer un spawn dans seed.ts
4. Re-exécuter `npx prisma db seed`

### 2. Ajouter un nouveau skill

1. Créer l'icône dans `public/assets/skills/`
2. Ajouter l'effet visuel si nécessaire
3. Ajouter dans `prisma/seed.ts`:
```typescript
await prisma.skill.upsert({
  where: { name: 'Nom du Skill' },
  update: {},
  create: {
    name: 'Nom du Skill',
    weaponTypeId: sword.id,
    baseDamage: 20,
    cooldown: 5.0,
    // ... autres stats
  },
});
```
4. Re-exécuter `npx prisma db seed`

### 3. Ajouter une nouvelle map

1. Créer la map avec Tiled Map Editor
2. Exporter en JSON dans `public/maps/`
3. Ajouter dans `prisma/seed.ts`:
```typescript
const newMap = await prisma.gameMap.upsert({
  where: { code: 'new_map' },
  update: {},
  create: {
    code: 'new_map',
    name: 'Nouvelle Map',
    width: 2000,
    height: 1500,
    pvpEnabled: false,
    portals: JSON.stringify([...]),
  },
});
```
4. Ajouter les spawns de monstres si nécessaire
5. Re-exécuter `npx prisma db seed`

---

## Sources d'Assets Gratuits

### Sprites
- [OpenGameArt.org](https://opengameart.org/) - Assets libres
- [Kenney.nl](https://kenney.nl/) - Assets haute qualité gratuits
- [itch.io](https://itch.io/game-assets/free) - Assets gratuits et payants

### Tilesets
- [Kenney Tilesets](https://kenney.nl/assets?q=2d)
- [LPC (Liberated Pixel Cup)](https://lpc.opengameart.org/)

### Icônes
- [Game-icons.net](https://game-icons.net/) - Icônes vectorielles gratuites

### Audio
- [Freesound.org](https://freesound.org/) - Effets sonores
- [OpenGameArt.org Music](https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12) - Musiques

---

## Ressources Placeholder Actuelles

Le jeu utilise actuellement des formes géométriques générées par code:
- **Joueur**: Rectangle bleu
- **Monstres**: Rectangles rouges
- **NPCs**: Rectangles verts
- **Map**: Grille procédurale

Ces placeholders sont définis dans:
- `client/src/game/systems/TiledMapLoader.ts` (génération procédurale de map)
- `client/src/game/scenes/MainScene.ts` (sprites basiques)

Pour les remplacer, charger les assets dans la méthode `preload()` de MainScene et les utiliser dans `create()`.
