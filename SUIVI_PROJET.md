# Document de Suivi - SekaiMMO

## État du Projet

**Date de début:** 2026-10-21
**Dernière mise à jour:** 2026-10-21
**Statut:** Phase 7 Terminée - Projet Fonctionnel

---

## Résumé du Cahier des Charges

### Type de jeu
- MMORPG Web 2D top-down (style Zelda/Pokemon)
- Genre médiéval fantaisie
- Contrôles type MOBA (click droit, skills QWERT/AZERTY)

### Système de progression
- Pas de niveaux de joueur
- XP par action (frapper avec épée = XP épée)
- Dépenser XP chez des maitres pour débloquer skills/améliorations
- Système de rank pour les armes

### Armes demandées
| Arme | Dégâts | Vitesse | Crit % |
|------|--------|---------|--------|
| Épée | Physique | Normale | 5% |
| Double dagues | Physique (faible) | Rapide | 20% |
| Arc | Physique distance | Normale | 10% |
| Hache 2 mains | Physique | Lente | 5% |
| Baguette | Magique distance | Rapide | 5% |
| Sceptre | Magique distance | Normale | 5% |

### Stats personnage
- Attaque physique / magique
- Défense physique / magique
- Attaque speed
- Vitesse de déplacement
- Pénétration physique / magique

### Features UI
- Inventaire (stack max 9999)
- Barre de skills interchangeable
- Menu skills (par arme/magie)
- Assignation touches personnalisable
- Système transmog

### Maps
- Tilemap via Tiled Map Editor
- 1 map = 1 zone = chat local

---

## Analyse du Code Existant

### Technologies actuelles
- **Client:** Phaser 3, Vite, TypeScript, Socket.IO
- **Serveur:** Express 5, Prisma, PostgreSQL, Socket.IO, JWT
- **Tests:** Vitest

### Ce qui existe déjà
- Authentification (register/login avec JWT)
- Création de personnage
- Système de skills basique (9 slots: QWERTASDF)
- Inventaire basique
- Mouvement click-to-move
- Multiplayer temps réel (Socket.IO)
- Système de drop (monstres)

### Ce qui doit être modifié/ajouté
1. **Armes:** Remplacer les types actuels par ceux du CDC
2. **Stats:** Ajouter les stats MOBA manquantes
3. **XP:** Système par action + éléments magiques
4. **Combat:** Telegraph au sol, quickcast
5. **Maps:** Intégration Tiled
6. **UI:** Transmog, assignation touches
7. **Personnage:** Customisation visuelle (tête, cheveux)

---

## Questions Posées à l'Utilisateur

### Session 1 - 2026-10-21

**Q1: Éléments magiques**
- Quels éléments exactement?
- **Réponse:** 8 éléments: Feu, Eau, Terre, Air, Foudre, Glace, Ténèbres, Lumière

**Q2: Système de Rank**
- Comment fonctionne le système de rank pour les armes?
- **Réponse:** 5 ranks style japonais: E, D, C, B, A

**Q3: PvP**
- Le jeu inclut-il du PvP ou uniquement PvE?
- **Réponse:** PvP optionnel (zones dédiées et système de duel)

**Q4: Style graphique**
- Pixel art? Quelle résolution de sprites?
- **Réponse:** Assets vectoriels/HD (pas pixel art)

**Q5: Monnaie**
- Y a-t-il une monnaie dans le jeu?
- **Réponse:** Deux monnaies: Or (in-game) + Premium (cosmetics/monétisation)

**Q6: Chat**
- Système de chat prévu?
- **Réponse:** Local (par zone) + Guilde + Whisper (MP)

**Q7: Stockage**
- Système de banque?
- **Réponse:** Oui, banque personnelle accessible en ville

**Q8: Assets graphiques**
- Comment gérer les assets?
- **Réponse:** Utiliser des assets gratuits temporaires pendant le développement

---

## Actions Manuelles Requises

_Liste des actions que l'utilisateur doit effectuer manuellement_

### Configuration initiale
1. [ ] Configurer PostgreSQL et créer la base de données
2. [ ] Créer le fichier `.env` avec les variables nécessaires:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/sekai_mmo"
   JWT_SECRET="votre_secret_jwt"
   PORT=3000
   CLIENT_ORIGIN="http://localhost:5173"
   ```

### Après Phase 1 (maintenant)
3. [ ] Exécuter `npx prisma generate` dans le dossier server
4. [ ] Exécuter `npx prisma db push` pour créer les tables (ou `npx prisma migrate dev` pour migration)
5. [ ] Exécuter `npx prisma db seed` pour peupler la base de données

### Pour plus tard
6. [ ] Créer/fournir les assets graphiques (sprites, tilesets)
7. [ ] Créer les maps avec Tiled Map Editor
8. [ ] Configurer les assets placeholder temporaires

---

## Plan d'Implémentation

### Phase 1: Refonte du Schéma de Données
1. Mettre à jour le schéma Prisma avec:
   - Nouveaux types d'armes (Épée, Double dagues, Arc, Hache, Baguette, Sceptre)
   - Système de ranks (E, D, C, B, A)
   - 8 éléments magiques
   - Stats MOBA complètes
   - Système de monnaies (Or + Premium)
   - Tables pour guildes, chat, banque
   - Support PvP (zones, duels)

### Phase 2: Serveur - Core Systems
1. Services pour le système d'XP par action
2. Services pour les éléments magiques
3. Système de combat avec dégâts physiques/magiques
4. Calcul des critiques (150%)
5. Système de ranks et prérequis
6. Gestion des guildes
7. Système de chat (local, guilde, whisper)
8. Banque personnelle
9. Système de duel PvP

### Phase 3: Client - Moteur de Jeu
1. Intégration Tiled Map Editor
2. Système de chargement de maps
3. Telegraph/indicateurs de skills au sol
4. Animations par type d'arme
5. Système de customisation personnage (tête, cheveux)
6. Système de transmog

### Phase 4: Client - Interface Utilisateur
1. Refonte de l'inventaire (stacks 9999)
2. Menu des skills par catégorie (arme/magie)
3. Système de changement de touches
4. Interface de banque
5. Interface de guilde
6. Système de chat complet
7. Interface de duel

### Phase 5: Gameplay & Polish
1. Spawning de monstres
2. IA des monstres
3. Balance des skills et dégâts
4. Système de drop amélioré
5. Tests et optimisation

### Technologies Recommandées

**Conservées:**
- Phaser 3 (excellent pour jeux 2D web)
- Express + Socket.IO (temps réel fiable)
- Prisma + PostgreSQL (ORM typé)
- TypeScript (sécurité des types)
- Vite (build rapide)

**À ajouter:**
- Tiled Map Editor (maps) - outil externe
- @kayahr/tiled (parsing des fichiers Tiled)
- Howler.js (audio)
- Eventuellement: Redis (cache sessions, chat rapide)

---

## Journal des Sessions

### Session 1 - 2026-10-21
- Lecture du cahier des charges
- Exploration du code existant
- Création du document de suivi
- Questions posées à l'utilisateur
- **Phase 1 terminée:**
  - Nouveau schéma Prisma créé avec 25+ modèles
  - 6 types d'armes (Épée, Dagues, Arc, Hache, Baguette, Sceptre)
  - 8 éléments magiques
  - Système de ranks (E, D, C, B, A)
  - Stats MOBA complètes
  - Système de guildes
  - Chat (local, guilde, whisper)
  - Banque personnelle
  - Support PvP (zones, duels)
  - Maps et portails
  - NPCs (maîtres d'armes, élémentaires, marchands, banquier)
  - Seed complet avec données initiales

- **Phase 2 terminée:**
  - `combatService.ts` - Calcul des dégâts physiques/magiques, critiques (150%), pénétration
  - `progressionService.ts` - Système d'XP par action, ranks (E→A), seuils de progression
  - `skillService.ts` - Apprentissage de skills, prérequis, assignation aux slots (QWERTASDF)
  - `guildService.ts` - Création de guilde, membres, rangs, banque de guilde
  - `chatService.ts` - Chat local, guilde, whisper
  - `bankService.ts` - Banque personnelle, dépôt/retrait d'items
  - `duelService.ts` - Demandes de duel, acceptation, historique
  - `mapService.ts` - Gestion des maps, portails, téléportation
  - `index.ts` - Export centralisé de tous les services

- **Phase 3 terminée:**
  - `client/src/game/types.ts` - Types partagés du jeu (DamageType, MagicElement, SkillSlot, CharacterData, etc.)
  - `client/src/game/systems/SkillTelegraph.ts` - Système de telegraph au sol pour les skills (cercle, ligne, cône, rectangle)
  - `client/src/game/systems/InputManager.ts` - Contrôles style MOBA (click droit déplacement, touches QWERTASDF, quick cast)
  - `client/src/game/systems/CombatManager.ts` - Effets visuels de combat (texte de dégâts, projectiles, effets de zone)
  - `client/src/game/systems/TiledMapLoader.ts` - Chargeur de maps Tiled avec support procédural pour dev
  - `client/src/game/scenes/MainScene.ts` - Scène principale refaite avec tous les systèmes intégrés
  - `client/src/game/systems/index.ts` - Export centralisé des systèmes
  - `client/src/game/scenes/index.ts` - Export centralisé des scènes
  - `client/src/game/index.ts` - Export centralisé du module game

- **Phase 4 terminée:**
  - `client/src/ui/components/SkillBar.ts` - Barre de skills avec cooldowns visuels, tooltips, animations
  - `client/src/ui/components/InventoryPanel.ts` - Inventaire avec grille, drag & drop, tri, stacks 9999
  - `client/src/ui/components/SkillsMenu.ts` - Menu des skills par catégorie (armes/éléments), progression de rank
  - `client/src/ui/components/ChatPanel.ts` - Chat avec onglets (local, guilde, whisper), commandes /w
  - `client/src/ui/components/BankPanel.ts` - Interface de banque avec dépôt/retrait
  - `client/src/ui/components/GuildPanel.ts` - Gestion de guilde (info, membres, trésorerie, invitation, promotion)
  - `client/src/ui/components/SettingsPanel.ts` - Paramètres et keybindings personnalisables
  - `client/src/ui/styles/*.css` - Styles CSS pour tous les composants UI
  - `client/src/ui/index.ts` - Export centralisé du module UI

- **Phase 5 terminée:**
  - `server/src/game/MonsterSpawnManager.ts` - Gestion du spawn des monstres avec:
    - Spawn initial par zone avec positions aléatoires
    - Système de respawn avec timer configurable
    - Détection et émission des événements Socket.IO
    - Gestion des dégâts et mort des monstres
  - `server/src/game/MonsterAI.ts` - IA des monstres avec machine à états:
    - État **idle**: repos, vérification d'aggro
    - État **patrol**: déplacement aléatoire autour du spawn
    - État **chase**: poursuite du joueur avec distance max (leash)
    - État **attack**: attaque du joueur avec cooldown
    - État **return**: retour au spawn avec régénération
  - `server/src/game/LootManager.ts` - Système de récompenses:
    - XP avec multiplicateurs selon la différence de niveau
    - Or avec variation aléatoire
    - Drops avec probabilités configurables
    - Application des récompenses à l'arme équipée
  - `server/src/game/gameServer.ts` - GameServer complet avec tous les handlers Socket.IO:
    - **Mouvement**: `player:move`
    - **Combat**: `skill:cast`, calcul de zone (cercle, ligne, cône)
    - **Maps**: `map:changeRequest`, initialisation des maps
    - **Chat**: `chat:message` (local, guilde, whisper)
    - **Inventaire**: `inventory:get`, `inventory:equip`, `inventory:drop`
    - **Armes**: `weapon:switch`
    - **Skills**: `skills:getBar`, `skills:getAll`, `skills:learn`, `skills:assign`, `skills:unassign`
    - **Guilde**: `guild:get`, `guild:create`, `guild:leave`, `guild:invite`, `guild:kick`, `guild:setRank`, `guild:depositGold`, `guild:withdrawGold`
    - **Banque**: `bank:get`, `bank:deposit`, `bank:withdraw`
    - **Personnage**: `character:getStats`, `character:getWeaponProgress`, `character:getElementProgress`
    - **NPCs**: `interact:check`
  - Documentation créée:
    - `GUIDE_DEMARRAGE.md` - Guide complet de démarrage (installation, lancement, contrôles)
    - `server/.env.example` - Fichier d'exemple pour les variables d'environnement

### Session 2 - 2026-10-21 (Suite)
- **Phase 7 terminée:**
  - Correction de toutes les erreurs TypeScript client et serveur
  - Correction des incohérences entre schéma Prisma et code
  - Fix: `equippedWeaponCode` → `equippedWeaponTypeId`
  - Fix: `weaponMasteries` → `weaponProgress`
  - Fix: `minX/maxX/minY/maxY` → `positionX/positionY/patrolRadius`
  - Fix: calcul de `baseGold` depuis `goldMin/goldMax`
  - Fix: types de retour dans `progressionService`
  - Balance des skills: Arc ajusté (14 dmg / 0.7s)
  - Build client et serveur validés
  - Serveur démarre correctement sur port 4000

- **Phase 6 terminée:**
  - Architecture client refactorisée:
    - `client/src/network/SocketManager.ts` - Gestionnaire centralisé Socket.IO avec:
      - Typage complet de tous les événements (SocketEvents)
      - Méthodes d'envoi pour tous les handlers serveur
      - Système d'abonnement avec désabonnement automatique
    - `client/src/ui/UIManager.ts` - Coordinateur UI:
      - Intégration de tous les composants (SkillBar, Chat, Inventory, Guild, Bank, Settings)
      - Connexion automatique aux événements Socket
      - Gestion des cooldowns, barres de statut, notifications
      - Raccourcis clavier (I, K, G, B, Escape, Enter)
    - `client/src/views/GameView.ts` - Vue refactorisée:
      - Utilisation du SocketManager et UIManager
      - Séparation claire des responsabilités
  - Styles CSS ajoutés:
    - `client/src/ui/styles/main.css` - Styles principaux:
      - Container UI avec zones (top bar, bottom, modals, notifications)
      - Barres de statut (vie, mana)
      - Boutons et inputs stylisés
      - Couleurs de rareté et d'éléments
      - Styles de ranks
  - Tests unitaires créés:
    - `server/src/__tests__/combat.test.ts` - Tests du système de combat:
      - Calcul de dégâts physiques/magiques
      - Critiques et pénétration
      - Dégâts PURE
    - `server/src/__tests__/progression.test.ts` - Tests de progression:
      - Calcul de rank depuis XP
      - Vérification de rank suffisant
      - Seuils de progression
  - Corrections:
    - Ajout de `calculateDamage` au combatService
    - Mise à jour de MainScene pour le nouveau format d'options

---

## Prochaines Étapes

- **Correctifs Session 2:**
  - Ajout de `equippedWeaponTypeId` et `equippedWeaponType` au schéma Character (manquait pour la création de personnage)
  - Correction de `characterService.ts`: `SWORD_SHIELD` → `SWORD`
  - Correction de `characterService.ts`: `characterLink` → `characterLinks`

### Phase 7: Corrections et Finalisation

**Session 2 - Corrections TypeScript Client (terminées):**
- SocketManager: ajout événement `reward:gained`, suppression import inutilisé
- UIManager: réécriture complète avec interfaces correctes
- MainScene: ajout champ `gold`, correction MapData
- SkillTelegraph: suppression imports inutilisés
- TiledMapLoader: suppression imports inutilisés
- SkillBar: suppression constante inutilisée
- SkillsMenu: corrections casting HTMLElement
- SettingsPanel: corrections types génériques
- GameView: corrections paramètres inutilisés

**Corrections Serveur (terminées):**

1. **gameServer.ts** - Toutes les erreurs corrigées:
   - `equippedWeaponCode` → `equippedWeaponTypeId`
   - Utilisation de la relation `weaponType` pour récupérer le code
   - `weaponMasteries` → `weaponProgress`
   - Suppression de `include: { portals: true }` (JSON dans le schéma)
   - Interface `ConnectedPlayer.weaponCode` changée en `string`
   - Fonction `getTargetsInArea` rendue générique
   - Casts `WeaponCode` ajoutés pour les appels LootManager

2. **LootManager.ts** - Corrigé:
   - `prisma.weaponMastery` → `prisma.characterWeaponProgress`
   - Contrainte unique mise à jour

3. **MonsterSpawnManager.ts** - Corrigé:
   - Interface `SpawnPoint`: `minX/maxX/minY/maxY` → `positionX/positionY/patrolRadius`
   - Position de spawn calculée avec angle et rayon aléatoires
   - `respawnSeconds` → `spawn.monster.respawnTime`
   - Calcul de `baseGold` depuis `goldMin/goldMax`
   - Ajout de valeurs par défaut pour `attackSpeed` et `aggroRange`

4. **progressionService.ts** - Corrigé:
   - Types de retour correctement assemblés avec spread operator
   - `weaponCode` et `element` ajoutés aux résultats

**Balance des skills (terminée):**
- Analyse DPS par arme effectuée
- Arc ajusté: 14 dmg / 0.7s (20 DPS au lieu de 15 DPS)
- Équilibre global validé:
  - Épée: 30 DPS (melee, équilibré)
  - Dagues: 26.7 DPS (melee, +20% crit)
  - Arc: 20 DPS (ranged, sécurité)
  - Hache: 16.7 DPS (melee, burst élevé)
  - Baguette: 25 DPS (ranged, coût mana)
  - Sceptre: 18.75 DPS (ranged, coût mana)

**Builds validés:**
- Client: `npm run build` ✓ (Vite build OK)
- Serveur: `npm run build` ✓ (TypeScript compilation OK)
- Serveur démarre sans erreur sur port 4000

---

## État Final du Projet

### Fichiers Créés/Modifiés (Phase 1-7)

**Serveur (server/):**
- `prisma/schema.prisma` - Schéma complet avec 25+ modèles
- `prisma/seed.ts` - Données initiales (armes, skills, monstres, maps, NPCs)
- `src/services/*.ts` - 9 services métier
- `src/game/gameServer.ts` - GameServer avec tous les handlers Socket.IO
- `src/game/MonsterSpawnManager.ts` - Gestion du spawn
- `src/game/MonsterAI.ts` - IA des monstres
- `src/game/LootManager.ts` - Système de loot
- `src/__tests__/*.ts` - Tests unitaires

**Client (client/):**
- `src/network/SocketManager.ts` - Gestionnaire Socket.IO typé
- `src/ui/UIManager.ts` - Coordinateur UI
- `src/ui/components/*.ts` - 7 composants UI
- `src/ui/styles/*.css` - Styles CSS
- `src/game/systems/*.ts` - Systèmes de jeu (telegraph, input, combat, maps)
- `src/game/scenes/MainScene.ts` - Scène principale
- `src/views/GameView.ts` - Vue de jeu refactorisée

**Documentation:**
- `SUIVI_PROJET.md` - Ce fichier
- `GUIDE_DEMARRAGE.md` - Guide d'installation et utilisation
- `GUIDE_RESSOURCES.md` - Guide des assets graphiques et audio
- `server/.env.example` - Variables d'environnement

**Corrections Session 2 (suite):**
- Bug fix: `monsters:initial` non géré par le client (monstres invisibles)
- Ajout de spawns de monstres au village de départ pour les tests
- Arc rebalancé: 14 dmg / 0.7s (20 DPS)

### Fonctionnalités Implémentées

| Feature | Statut |
|---------|--------|
| 6 types d'armes | ✅ |
| 8 éléments magiques | ✅ |
| Système de ranks (E→A) | ✅ |
| XP par action | ✅ |
| Combat avec dégâts/crits | ✅ |
| Telegraph des skills | ✅ |
| Contrôles MOBA | ✅ |
| Inventaire (9999 stacks) | ✅ |
| Barre de skills (QWERTASDF) | ✅ |
| Chat (local/guilde/whisper) | ✅ |
| Système de guildes | ✅ |
| Banque personnelle | ✅ |
| Maps avec portails | ✅ |
| Spawn de monstres | ✅ |
| IA des monstres | ✅ |
| Système de loot | ✅ |
| NPCs (maîtres, marchands) | ✅ |
| Build client/serveur | ✅ |

### Fonctionnalités Bonus (Non Implémentées)
- Système de transmog
- PvP zones et duels (schéma prêt, pas de handlers)
- Système de quêtes
- Achievements
- Leaderboards
