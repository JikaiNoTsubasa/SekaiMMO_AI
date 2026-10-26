# Definition

Le projet est un mmo rpg WEB s'executant dans un browser web, en 2d top down avec des controles de type MOBA.

# Architecture

Le projet est organisé en trois parties principales:
 - Client
 - Server
 - Base de donnée postgresql
 
# Type de jeu & gameplay

## Type

Le jeu est un MMORPG en 2d en top down (ancien zelda, pokemon etc). Le genre est médiévale avec épées, arc, magie, goblin, elf etc, de type fantaisie.

## Gameplay

Il n'y a pas de classes, pas de niveaux de joueur à proprement parler.
La progression du joueur se fait par répétition d'actions, par exemple:
Le joueur tape un monstre avec une épée, il gagne de l'xp d'épée (à chaque coup). Il ne gagne pas de level, mais uniquement de l'xp. Il peut dépenser cet xp chez un maitre de l'épée pour acheter des nouveaux skills, augmenter ses dégats d'épée, attaque speed etc, porter des épées plus forte (system de rank).
Pareil pour la magie, au debut chaque joueur à un sort de magie, l'utiliser donne de l'xp de magie générale, il y a aussi des sorts de feu qui donnent de l'xp de feu. Certains skill d'attaque de dégats physique font aussi des degats de magie (feu, eau, void, curse etc).


## Armes & skills

Système de rank.

Les types de dégats:
 - Physique: produit par une arme en direct sauf baguette et sceptre
 - Magique: produit par les skills (meme les skills d'armes genre épée)
 
Les critique font 150% de l'attaque en dégat (physique et magique)

Voici les armes à implémenter dans le jeu dès le départ:

### Epée

Dégats: Physique
Vitesse: Normale
Critique chance: 5%
XP: Epée + magie elémentaire (feu, eau etc) si skill utilise un élément

### Double dagues

Dégats: Physique mais mois que l'épée
Vitesse: Rapide
Critique chance: 20%
XP: Dague + magie elémentaire (feu, eau etc) si skill utilise un élément

### Arc

Dégats: Physique à distance
Vitesse: Normale
Critique chance: 10%
XP: Arc + magie elémentaire (feu, eau etc) si skill utilise un élément

### Hache à deux mains

Dégats: Physique
Vitesse: Lente
Critique chance: 5%
XP: Hache + magie elémentaire (feu, eau etc) si skill utilise un élément

### Baguette

Dégats: Magique à distance (lance une boule de magie sans élément)
Vitesse: Rapide
Critique chance: 5%
XP: Magie + magie elémentaire (feu, eau etc) si skill utilise un élément

### Sceptre

Dégats: Magique à distance (lance une boule de magie sans élément)
Vitesse: Normale
Critique chance: 5%
XP: Magie + magie elémentaire (feu, eau etc) si skill utilise un élément

D'autres armes peuvent etre créés par la suite.

## Système de combat

Les combat sont géré comme dans les moba, genre league of legends. On click droit pour se déplacer ou faire des actions sur les pnj. Quick cast des skills depuis la barre des skills (QWERT) ou (AZERTY). Avec telegram sur le sol pour voir où le sort sera lancé.

## Personnage

### Design

Le système d'affichage du personnage devra pouvoir changer le skin de l'armure (en entier c'est plus simple) mais garder la tête configurée à la création du personnage (tete, yeux, cheuveux).
L'arme du personnage doit s'afficher dans sa main, meme quand il change de direction.
Une animation doit etre jouée en fonction de l'arme utilisé quand on attaque.

Un systeme de transmog doit etre présent (je porte une armure, mais je peux équiper un autre skin à la place, ce sera utilisé pour la monétisation plus tard).

### Stats

Le personnage aura les memes stats que dans les moba pour commencer:
 - Attaque physique
 - Attaque magique
 - Defense physique
 - Defense magique
 - Attaque speed
 - Vitesse de déplacement
 - Pénétration physique
 - Pénétration magique

## UI

Inventaire complet, stacks max de 9999

Barre de skill interchangeable depuis le menu des skills.

Menu des skills rangés en fonction des armes et magie.

Système pour changer l'assignation des touches.

## Map

Basé sur des Tilemap, produit par Tiled Map Editor (opensource)
1 map = 1 zone = chat local

Chaque map est une zone du jeu, comme l'interieur d'une maison, une prairie etc, on peu se tp d'une map à l'autre.

# Instruction IA

Tu peux choisir la technologie utilisée qui sera la meilleur pour remplir les besoins. Tu peux utiliser des librairies externes tant qu'elles sont gratuites.
Une première version à été faite mais n'est pas forcément optimale. Tu peux la rebuild entièrement (même conseillé).

Garde un document de suivis à jour si ton travail est intérompu.

Il faut que le jeu soit scalable: ajout de maps facilement, ajout de skills, d'armes etc. 

Si tu as des question pose les. S'il y a des actions manuelles que je doit réaliser, met les dans un document de suivis à pars.