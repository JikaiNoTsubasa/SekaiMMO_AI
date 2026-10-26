# Guide de Démarrage - SekaiMMO

## Prérequis

- **Node.js** v18+ (recommandé: v20 LTS)
- **PostgreSQL** 14+ (ou Docker avec PostgreSQL)
- **npm** v9+ (inclus avec Node.js)

---

## Installation

### 1. Cloner et installer les dépendances

```bash
# À la racine du projet
npm install
```

Cela installera automatiquement les dépendances du client ET du serveur (workspaces npm).

### 2. Configurer la base de données

#### Option A: PostgreSQL local

1. Créer une base de données PostgreSQL:
```sql
CREATE DATABASE sekai_mmo;
```

2. Créer le fichier `.env` dans le dossier `server/`:
```env
DATABASE_URL="postgresql://utilisateur:motdepasse@localhost:5432/sekai_mmo"
JWT_SECRET="votre_secret_jwt_super_long_et_securise"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
```

#### Option B: Docker (rapide)

```bash
docker run --name sekaimmo-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=sekai_mmo -p 5432:5432 -d postgres:15
```

Puis créer `.env` dans `server/`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/sekai_mmo"
JWT_SECRET="votre_secret_jwt_super_long_et_securise"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
```

### 3. Initialiser la base de données

```bash
cd server

# Générer le client Prisma
npm run prisma:generate

# Créer les tables (push pour dev, ou migrate pour prod)
npx prisma db push

# Peupler avec les données de base (armes, skills, items, maps, NPCs)
npm run prisma:seed
```

---

## Lancement

### Mode développement (recommandé)

Depuis la racine du projet:
```bash
npm run dev
```

Cela lance simultanément:
- **Serveur** sur `http://localhost:4000`
- **Client** sur `http://localhost:5173`

### Lancement séparé

```bash
# Terminal 1 - Serveur
npm run dev:server

# Terminal 2 - Client
npm run dev:client
```

---

## Accéder au jeu

1. Ouvrir le navigateur sur **http://localhost:5173**
2. Créer un compte (email + mot de passe)
3. Créer un personnage
4. Jouer!

---

## Structure du projet

```
SekaiMMO_AI/
├── client/                 # Frontend (Phaser + Vite)
│   ├── src/
│   │   ├── game/          # Moteur de jeu
│   │   │   ├── scenes/    # Scènes Phaser
│   │   │   ├── systems/   # Systèmes (input, combat, maps)
│   │   │   └── types.ts   # Types partagés
│   │   ├── ui/            # Composants UI
│   │   │   ├── components/
│   │   │   └── styles/
│   │   ├── views/         # Vues (login, jeu)
│   │   └── api/           # Client API
│   └── package.json
│
├── server/                 # Backend (Express + Socket.IO)
│   ├── src/
│   │   ├── config/        # Configuration (env, prisma)
│   │   ├── routes/        # Routes API REST
│   │   ├── services/      # Services métier
│   │   ├── game/          # Logique temps réel
│   │   └── middleware/    # Auth, validation
│   ├── prisma/
│   │   ├── schema.prisma  # Schéma de base de données
│   │   └── seed.ts        # Données initiales
│   └── package.json
│
├── package.json            # Racine (workspaces)
├── SUIVI_PROJET.md        # Suivi de développement
└── GUIDE_DEMARRAGE.md     # Ce fichier
```

---

## Commandes utiles

### Racine
| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance client + serveur |
| `npm run build` | Build production |
| `npm run test` | Tous les tests |
| `npm run lint` | Vérification TypeScript |

### Serveur (cd server)
| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur en mode watch |
| `npm run prisma:generate` | Génère le client Prisma |
| `npm run prisma:dev` | Crée une migration |
| `npm run prisma:seed` | Peuple la BDD |
| `npx prisma studio` | Interface visuelle BDD |

### Client (cd client)
| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance Vite en mode dev |
| `npm run build` | Build production |
| `npm run preview` | Preview du build |

---

## Ports utilisés

| Service | Port | URL |
|---------|------|-----|
| Client (Vite) | 5173 | http://localhost:5173 |
| Serveur (API) | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | localhost:5432 |

---

## Données de test (après seed)

### Armes disponibles
- Épée (SWORD) - équilibré
- Double Dagues (DUAL_DAGGERS) - rapide, 20% crit
- Arc (BOW) - distance
- Hache à deux mains (TWO_HANDED_AXE) - lent, gros dégâts
- Baguette (WAND) - magique rapide
- Sceptre (SCEPTER) - magique équilibré

### Maps
1. **TOWN_SQUARE** - Place du Village (spawn, NPCs, banque)
2. **FOREST_EDGE** - Orée de la Forêt (monstres niv. 1-3)
3. **DEEP_FOREST** - Forêt Profonde (monstres niv. 4-7)
4. **DARK_CAVE** - Caverne Sombre (monstres niv. 8-10)

### Éléments magiques
Feu, Eau, Terre, Air, Foudre, Glace, Ténèbres, Lumière

### Système de Ranks
E → D → C → B → A (XP requis: 0, 500, 2000, 5000, 15000)

---

## Contrôles du jeu

| Action | Contrôle |
|--------|----------|
| Se déplacer | Clic droit |
| Arrêter | Espace |
| Compétences | Q, W, E, R, T (ligne 1) |
| Compétences | A, S, D, F (ligne 2) |
| Annuler skill | Échap |
| Chat | Entrée |
| Inventaire | I |
| Skills | K |

---

## Dépannage

### Erreur "DATABASE_URL not set"
→ Vérifiez que le fichier `.env` existe dans `server/` et contient DATABASE_URL

### Erreur "Connection refused" PostgreSQL
→ Vérifiez que PostgreSQL est démarré et accessible sur le port 5432

### Le client ne trouve pas le serveur
→ Vérifiez que `VITE_API_URL` est correct (par défaut: http://localhost:4000)

### Prisma schema out of sync
```bash
cd server
npx prisma db push --force-reset  # ATTENTION: efface les données!
npm run prisma:seed
```

### Voir les logs du serveur
Les logs s'affichent dans le terminal où le serveur est lancé.

---

## API Endpoints (serveur)

### Authentification
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion
- `GET /auth/me` - Profil utilisateur

### Personnage
- `POST /characters` - Créer un personnage
- `GET /characters/me` - Mon personnage
- `GET /characters/skills` - Liste des skills

### Jeu
- `GET /game/state` - État complet du jeu

### Socket.IO Events
- `player:move` - Mouvement
- `skill:cast` - Lancer un skill
- `chat:message` - Envoyer un message

---

## Prochaines étapes de développement

Voir `SUIVI_PROJET.md` pour le détail des phases complétées et à venir.

**Phase 5 (en cours):** Gameplay & Polish
- IA des monstres
- Spawning avec timers
- Équilibrage des dégâts
