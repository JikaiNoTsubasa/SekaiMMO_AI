# Guide des Ressources - SekaiMMO

Ce document décrit les ressources graphiques et audio du jeu et comment les intégrer.

Chaque section indique son état :
- ✅ **Utilisé par le code** : le format décrit est exactement celui attendu par le client.
- ⏳ **Prévu** : le code ne charge pas encore ces fichiers (placeholders géométriques à la place). Le format est indicatif.

---

## Structure des Dossiers

```
client/
├── public/
│   ├── assets/
│   │   ├── sprites/
│   │   │   ├── characters/   # ✅ Spritesheet des personnages (base_character.png), ⏳ tombe (tombstone.png)
│   │   │   ├── monsters/     # Spritesheets des monstres (un fichier par monstre, lié par Monster.iconUrl)
│   │   │   └── npcs/         # ⏳ Sprites des PNJs
│   │   ├── tilesets/         # ✅ Images des tilesets des maps
│   │   ├── items/            # ⏳ Icônes des items
│   │   ├── skills/           # ⏳ Icônes et effets des skills
│   │   ├── ui/               # ⏳ Éléments d'interface
│   │   └── audio/            # ⏳ Sons et musiques
│   └── maps/                 # ✅ Maps .sm (SekaiMapEditor)
docs/
└── sprites/
    └── base_character_template.png   # Gabarit pour dessiner le spritesheet personnage
```

---

## 1. Sprites des Personnages ✅

Utilisé pour le joueur local et les autres joueurs.
Source de vérité dans le code : `client/src/game/systems/characterSprite.ts` (format) et `CharacterAnimator.ts` (lecture des animations).

### Fichier

| | |
|---|---|
| **Chemin** | `client/public/assets/sprites/characters/base_character.png` |
| **Type** | Spritesheet PNG avec transparence (pas de JSON) |
| **Taille d'une frame** | **32x32 pixels** |
| **Colonnes** | **8** (frames inutilisées en fin de ligne : laisser transparent) |
| **Lignes** | **16** (4 animations x 4 directions) |
| **Taille totale** | **256 x 512 pixels** |

Un gabarit agrandi x4 (grille, numéros de frames, ligne des pieds) est disponible dans
`docs/sprites/base_character_template.png`.

### Point d'ancrage (important)

La position du personnage dans le monde correspond à **ses pieds** :
- **Horizontal** : centre de la frame (x = 16).
- **Vertical** : ligne **y = 29**, soit 3 pixels au-dessus du bas de la frame.

Dessiner le personnage debout sur la ligne y = 29, centré horizontalement, et identique d'une frame à l'autre (sinon le personnage "glisse" pendant l'animation). Les 3 lignes du bas peuvent servir à une ombre.
Le personnage peut occuper toute la hauteur (29 px au-dessus des pieds). Les barres de vie et de mana s'affichent sous les pieds.

### Animations attendues

Les directions sont toujours dans l'ordre **bas, gauche, droite, haut** (une ligne chacune).
Les frames sont lues de gauche à droite à partir de la colonne 0.

| Lignes | Animation | Frames | Vitesse | Boucle | Quand elle est jouée |
|--------|-----------|--------|---------|--------|----------------------|
| 0-3 | `idle` | 4 | 6 fps | oui | Personnage immobile |
| 4-7 | `walk` | 6 | 10 fps | oui | Déplacement (clic droit, approche d'une cible) |
| 8-11 | `attack` | 4 | 12 fps | non | Chaque auto-attaque, tournée vers la cible |
| 12-15 | `cast` | 4 | 10 fps | non | Lancement d'une compétence, tourné vers la zone visée |

Détail ligne par ligne :

```
Ligne  0 : idle   bas      frames 0-3
Ligne  1 : idle   gauche   frames 8-11
Ligne  2 : idle   droite   frames 16-19
Ligne  3 : idle   haut     frames 24-27
Ligne  4 : walk   bas      frames 32-37
Ligne  5 : walk   gauche   frames 40-45
Ligne  6 : walk   droite   frames 48-53
Ligne  7 : walk   haut     frames 56-61
Ligne  8 : attack bas      frames 64-67
Ligne  9 : attack gauche   frames 72-75
Ligne 10 : attack droite   frames 80-83
Ligne 11 : attack haut     frames 88-91
Ligne 12 : cast   bas      frames 96-99
Ligne 13 : cast   gauche   frames 104-107
Ligne 14 : cast   droite   frames 112-115
Ligne 15 : cast   haut     frames 120-123
```

### Comportement en jeu

- **Direction** : la direction dominante du mouvement ou de la cible (horizontale si l'écart horizontal est le plus grand, sinon verticale).
- **attack** : sa durée est raccourcie pour suivre la vitesse d'attaque (au plus 400 ms, moins si le personnage attaque plus vite). Les 4 frames sont toujours jouées : prévoir l'impact sur la frame 2 ou 3.
- **attack / cast** puis retour automatique à `idle`. Un déplacement interrompt l'animation en cours.
- **Arme** : il n'y a pas encore de sprite d'arme séparé. Le personnage dessiné est utilisé quelle que soit l'arme équipée.

### Placeholder

Si `base_character.png` est absent, un rectangle coloré 16x29 est affiché (bleu pour le joueur, rouge pour les autres joueurs) et un avertissement apparaît dans la console.
Si le fichier est trop petit pour une animation, cette animation est ignorée (avertissement dans la console) : on peut donc livrer `idle` et `walk` d'abord, puis compléter.

### Modifier le format

Le nombre de frames, la vitesse ou l'ordre des lignes se changent dans `CHARACTER_ANIMATIONS` (`characterSprite.ts`). Mettre ce guide à jour en même temps.

### Tombe (personnage mort) ⏳

À 0 PV, le personnage est remplacé par une tombe animée jusqu'à sa réapparition. Elle est visible par tous les joueurs de la map. Les barres du personnage sont masquées pendant ce temps ; le nom des autres joueurs reste affiché.

Aucune image n'est chargée pour l'instant : la tombe est **dessinée par le code** (pierre grise, croix gravée, reflet et deux feux follets), dans `client/src/game/systems/Tombstone.ts`. Pour utiliser un sprite dessiné, il faudra aussi modifier ce fichier pour qu'il charge l'image ; le format ci-dessous est celui de la texture actuelle.

| | |
|---|---|
| **Chemin prévu** | `client/public/assets/sprites/characters/tombstone.png` |
| **Type** | Bande PNG horizontale avec transparence |
| **Taille d'une frame** | **32x32 pixels** |
| **Frames** | **6**, une seule direction |
| **Taille totale** | **192 x 32 pixels** |
| **Animation** | 6 fps, en boucle |
| **Ancrage** | Comme les personnages : centre horizontal (x = 16), base de la tombe sur la ligne **y = 29** |

---

## 2. Sprites des Monstres

Le fichier d'un monstre est lié par la colonne `Monster.iconUrl` en base, comme les icônes des items, par exemple `public/assets/sprites/monsters/peaceful_jelly.png`. Le client le charge à la première apparition du monstre (`MonsterAnimator.ts`). Si `iconUrl` est vide ou si le fichier est introuvable, un rectangle rouge de 16x32 ancré aux pieds est affiché.

### Monstres (selon seed.ts)

| Fichier | Nom en jeu | Niveau | PV | Vitesse | Portée d'attaque | Réapparition | Zones |
|---------|------------|--------|----|---------|------------------|--------------|-------|
| `peaceful_jelly.png` ✅ | Gelée Paisible | 1 | 30 | 50 | 30 | 15 s | Village de Départ, Prairie Paisible |
| `prairie_wolf.png` ⏳ | Loup des Prairies | 3 | 80 | 150 | 40 | 30 s | Prairie Paisible |
| `forest_goblin.png` ⏳ | Gobelin des Bois | 5 | 120 | 100 | 50 | 45 s | Forêt Sombre |

### Format

Même structure que les personnages.

| | |
|---|---|
| **Chemin** | `client/public/assets/sprites/monsters/<fichier>.png` |
| **Type** | Spritesheet PNG avec transparence (pas de JSON) |
| **Taille d'une frame** | **32x32 pixels** |
| **Colonnes** | **8** (frames inutilisées en fin de ligne : laisser transparent) |
| **Lignes** | **20** (5 animations x 4 directions, dans l'ordre bas, gauche, droite, haut) |
| **Taille totale** | **256 x 640 pixels** |
| **Ancrage** | Centre horizontal (x = 16), pieds sur la ligne **y = 29** |

### Animations

Les 5 animations sont jouées par le jeu, et la ligne utilisée suit la direction du monstre. **Une animation non dessinée reste transparente : le monstre disparaît le temps qu'elle dure**, ce qui permet de voir ce qu'il reste à faire. Il suffit ensuite de remplir ses frames dans le PNG.

| Lignes | Animation | Frames | Vitesse | Boucle | Événement |
|--------|-----------|--------|---------|--------|-----------|
| 0-3 | `idle` | 4 | 6 fps | oui | Monstre immobile |
| 4-7 | `walk` | 6 | 10 fps | oui | Déplacement (`monster:moved`) : patrouille, poursuite, retour au spawn |
| 8-11 | `attack` | 4 | 12 fps | non | Attaque d'un joueur (`monster:attack`), orientée vers lui |
| 12-15 | `hurt` | 2 | 8 fps | non | Coup reçu (`combat:damage`), sauf pendant une attaque |
| 16-19 | `death` | 6 | 10 fps | non | Mort du monstre (`monster:defeated`), une seule fois |

Le nombre de frames, la vitesse ou l'ordre des lignes se changent dans `ANIMATIONS` (`MonsterAnimator.ts`). Mettre ce guide à jour en même temps.

### Affichage en jeu

- **Nom et niveau** : centrés 35 px au-dessus des pieds, un monstre de 29 px de haut au maximum ne les recouvre donc pas.
- **Barre de vie** : 32x2 px, 4 px sous les pieds.
- **Zone de clic** : 24 px de large et 40 px de haut, centrée sur les pieds.
- **Mort** : l'animation `death` se joue en plus d'un effet dessiné par le code (`createDeathEffect` dans `CombatManager.ts`), le nom et la barre de vie disparaissent aussitôt. Le monstre réapparaît au bout du délai `respawnTime`.

---

## 3. Sprites des PNJs ⏳

Pas encore affichés sur la map.

### PNJs (selon seed.ts)
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

### Format suggéré
- Frames 32x32, ancrage aux pieds, animation `idle` (4 frames, direction bas).

---

## 4. Tilesets ✅

- **Dossier** : `client/public/assets/tilesets/`
- **Format** : PNG, tuiles carrées (16x16 pour le tileset actuel `SunnysideWorld.png`), sans marge ni espacement.
- **Résolution** : le client ne garde que le **nom du fichier** de l'image référencée dans la map `.sm` et le cherche dans ce dossier. L'image doit donc porter le même nom que dans SekaiMapEditor (`SekaiMapEditor/public/assets/`).
- Les tuiles animées sont définies dans l'éditeur et jouées par le client (durée par frame respectée).

---

## 5. Icônes des Items ⏳

### Format
- Taille : 32x32 pixels
- Format : PNG avec transparence

### Items (selon seed.ts)
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

## 6. Icônes des Skills ⏳

### Format
- Taille : 48x48 ou 64x64 pixels
- Format : PNG avec transparence

### Skills (18 selon seed.ts)
Les attaques automatiques ne sont pas des compétences. Chaque arme a un **passif de maîtrise** (icône à prévoir) et deux compétences actives.

```
public/assets/skills/
├── sword/
│   ├── sword_mastery.png        # Maîtrise de l'Épée (passif)
│   ├── shield_bash.png          # Coup de Bouclier
│   └── fire_thrust.png          # Estoc Enflammé
├── dual_daggers/
│   ├── daggers_mastery.png      # Maîtrise des Dagues (passif)
│   ├── poison_blades.png        # Lames Empoisonnées
│   └── shadow_dance.png         # Danse des Ombres
├── bow/
│   ├── bow_mastery.png          # Maîtrise de l'Arc (passif)
│   ├── arrow_rain.png           # Pluie de Flèches
│   └── ice_arrow.png            # Flèche de Glace
├── axe/
│   ├── axe_mastery.png          # Maîtrise de la Hache (passif)
│   ├── whirlwind.png            # Tourbillon
│   └── earthquake.png           # Séisme
├── wand/
│   ├── wand_mastery.png         # Maîtrise de la Baguette (passif)
│   ├── fireball.png             # Boule de Feu
│   └── lightning.png            # Éclair
└── scepter/
    ├── scepter_mastery.png      # Maîtrise du Sceptre (passif)
    ├── light_wave.png           # Vague de Lumière
    └── ice_nova.png             # Nova de Glace
```

---

## 7. Effets Visuels des Skills ⏳

Actuellement dessinés par code (`CombatManager.ts`) : cercles, lignes, cônes, projectiles et impacts colorés selon l'élément.

### Effets envisagés
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

## 8. Éléments UI ⏳

L'interface est actuellement en HTML/CSS.

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

## 9. Audio ⏳

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

## 10. Maps (.sm - SekaiMapEditor) ✅

Les maps sont créées avec **SekaiMapEditor** (projet `SekaiMapEditor/`) et exportées au format `.sm` (JSON). Tiled n'est plus utilisé.

### Fichiers
```
client/public/maps/
├── starting_village.sm      # Village de départ
├── peaceful_prairie.sm      # Prairie paisible
├── dark_forest.sm           # Forêt sombre
└── pvp_arena.sm             # Arène PvP
```

Le nom du fichier doit être **exactement le `code`** de la map dans la table `GameMap`. Le serveur lit aussi ces fichiers (pour valider les warps) : dossier configurable via `MAP_FILES_DIR`.

### Layers (fixes)
| Layer | Rôle en jeu |
|-------|-------------|
| `floor` | Sol, sous tout le reste |
| `behind` | Décor sous le joueur |
| `front` | Décor au-dessus du joueur (arbres, toits) |
| `collider` | Cases bloquantes (non affiché) |
| `event` | Événements (non affiché) |

### Événements
| Type | Paramètres JSON | Effet |
|------|-----------------|-------|
| `WARP` | `{ "targetMap": "code", "targetX": 1, "targetY": 2 }` | Changement de map. `targetX`/`targetY` (en tiles) optionnels : sinon premier `SPAWN` de la map cible, sinon centre |
| `SPAWN` | `{ "spawnType": "player" }` (optionnel) | Point d'arrivée par défaut |
| `DIALOG`, `TRIGGER`, `CUSTOM` | libres | Lus mais pas encore utilisés |

---

## Comment Intégrer les Ressources

### 1. Ajouter le spritesheet des personnages

1. Dessiner sur le gabarit `docs/sprites/base_character_template.png` (réduit à 256x512, une frame = 32x32).
2. Exporter en PNG transparent : `client/public/assets/sprites/characters/base_character.png`.
3. Recharger le jeu : les animations sont créées automatiquement (voir la console en cas de frames manquantes).

### 2. Ajouter un nouveau monstre

1. Ajouter dans `prisma/seed.ts` :
```typescript
const newMonster = await prisma.monster.upsert({
  where: { name: 'Nom du Monstre' },
  update: { iconUrl: 'public/assets/sprites/monsters/nom_du_monstre.png' },
  create: {
    name: 'Nom du Monstre',
    iconUrl: 'public/assets/sprites/monsters/nom_du_monstre.png',
    level: 5,
    health: 100,
    // ... autres stats
  },
});
```
2. Créer un spawn dans seed.ts
3. Déposer le spritesheet dans `client/public/assets/sprites/monsters/` (format : section 2)
4. Re-exécuter `npx prisma db seed` puis redémarrer le serveur (il garde les monstres en mémoire)

### 3. Ajouter un nouveau skill

1. Ajouter dans `prisma/seed.ts` (dégâts = base + % attaque + % magie) :
```typescript
await prisma.skill.upsert({
  where: { name: 'Nom du Skill' },
  update: {},
  create: {
    name: 'Nom du Skill',
    weaponTypeId: sword.id,
    baseDamage: 20,
    attackScaling: 0.6, // +60% de l'attaque
    magicScaling: 0,    // +0% de la magie
    cooldown: 5.0,
    // ... autres stats
  },
});
```
2. Re-exécuter `npx prisma db seed`

### 4. Ajouter une nouvelle map

1. Créer la map dans SekaiMapEditor et l'exporter en `.sm`.
2. La placer dans `client/public/maps/<code>.sm`.
3. Ajouter dans `prisma/seed.ts` :
```typescript
const newMap = await prisma.gameMap.upsert({
  where: { code: 'new_map' },
  update: {},
  create: {
    code: 'new_map',
    name: 'Nouvelle Map',
    width: 2000,  // en pixels, aligné sur la map .sm
    height: 1500,
    pvpEnabled: false,
  },
});
```
4. Relier les maps avec des événements `WARP` dans l'éditeur.
5. Ajouter les spawns de monstres si nécessaire, puis `npx prisma db seed`.

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

## Placeholders Actuels

| Élément | Placeholder | Défini dans |
|---------|-------------|-------------|
| Joueur / autres joueurs | Rectangle bleu / rouge 16x29 dans une frame 32x32 (si `base_character.png` absent) | `client/src/game/systems/CharacterAnimator.ts` |
| Tombe (personnage mort) | Texture animée dessinée par le code, 6 frames 32x32 | `client/src/game/systems/Tombstone.ts` |
| Monstres | Rectangle rouge 16x32 dans une frame 32x32 (si `iconUrl` vide ou fichier introuvable) | `client/src/game/systems/MonsterAnimator.ts` |
| Map | Grille procédurale (si le fichier `.sm` est absent) | `client/src/game/systems/SekaiMapLoader.ts` |
| Effets de combat | Formes colorées | `client/src/game/systems/CombatManager.ts` |
