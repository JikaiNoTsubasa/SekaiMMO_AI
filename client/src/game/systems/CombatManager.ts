// Combat Manager - Gestion des effets visuels de combat
// Affichage des dégâts, projectiles, effets de skills
// SekaiMMO v2.0

import Phaser from 'phaser';
import type { DamageType, MagicElement, SkillData } from '../types';
import { ELEMENT_COLORS, DAMAGE_TYPE_COLORS } from '../types';

interface DamageTextConfig {
  x: number;
  y: number;
  damage: number;
  isCritical: boolean;
  damageType: DamageType;
  element: MagicElement;
}

interface ProjectileConfig {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: number;
  size: number;
  onHit?: () => void;
}

interface SkillEffectConfig {
  x: number;
  y: number;
  skill: SkillData;
  direction?: number; // Angle en radians
}

export class CombatManager {
  private scene: Phaser.Scene;
  private damageTextPool: Phaser.GameObjects.Text[] = [];
  private projectiles: Phaser.GameObjects.Arc[] = [];
  private effectsContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.effectsContainer = scene.add.container(0, 0);
    this.effectsContainer.setDepth(100);
  }

  /**
   * Affiche un texte de dégâts
   */
  showDamageText(config: DamageTextConfig): void {
    const { x, y, damage, isCritical, damageType, element } = config;

    // Récupérer ou créer un texte
    let text = this.damageTextPool.pop();
    if (!text) {
      text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial Black',
        fontSize: '16px',
        stroke: '#000000',
        strokeThickness: 3,
      });
    }

    // Configurer le texte
    const displayDamage = Math.round(damage);
    text.setText(isCritical ? `${displayDamage}!` : `${displayDamage}`);

    // Couleur basée sur l'élément ou le type de dégât
    let color: number;
    if (element !== 'NONE') {
      color = ELEMENT_COLORS[element];
    } else {
      color = DAMAGE_TYPE_COLORS[damageType];
    }

    text.setColor(`#${color.toString(16).padStart(6, '0')}`);
    text.setFontSize(isCritical ? '24px' : '16px');

    // Position avec léger décalage aléatoire
    const offsetX = Phaser.Math.Between(-20, 20);
    text.setPosition(x + offsetX, y - 20);
    text.setAlpha(1);
    text.setScale(isCritical ? 1.2 : 1);
    text.setDepth(101);
    text.setVisible(true);

    // Animation
    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      scale: isCritical ? 0.8 : 0.6,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        text!.setVisible(false);
        this.damageTextPool.push(text!);
      },
    });
  }

  /**
   * Affiche un texte de soin
   */
  showHealText(x: number, y: number, amount: number): void {
    let text = this.damageTextPool.pop();
    if (!text) {
      text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial Black',
        fontSize: '16px',
        stroke: '#000000',
        strokeThickness: 3,
      });
    }

    text.setText(`+${Math.round(amount)}`);
    text.setColor('#00ff00');
    text.setPosition(x, y - 20);
    text.setAlpha(1);
    text.setDepth(101);
    text.setVisible(true);

    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        text!.setVisible(false);
        this.damageTextPool.push(text!);
      },
    });
  }

  /**
   * Crée un projectile
   */
  createProjectile(config: ProjectileConfig): void {
    const { startX, startY, targetX, targetY, speed, color, size, onHit } = config;

    const projectile = this.scene.add.circle(startX, startY, size, color);
    projectile.setDepth(50);
    this.projectiles.push(projectile);

    // Ajouter une traînée
    const trail = this.scene.add.graphics();
    trail.setDepth(49);

    // Calculer la durée basée sur la distance
    const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    const duration = (distance / speed) * 1000;

    // Stocker les positions pour la traînée
    const positions: { x: number; y: number }[] = [];

    // Animation du projectile
    this.scene.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        positions.push({ x: projectile.x, y: projectile.y });
        if (positions.length > 10) positions.shift();

        // Dessiner la traînée
        trail.clear();
        trail.lineStyle(size * 0.8, color, 0.5);
        if (positions.length >= 2) {
          trail.beginPath();
          trail.moveTo(positions[0].x, positions[0].y);
          for (let i = 1; i < positions.length; i++) {
            trail.lineTo(positions[i].x, positions[i].y);
          }
          trail.strokePath();
        }
      },
      onComplete: () => {
        // Effet d'impact
        this.createImpactEffect(targetX, targetY, color);

        // Callback
        onHit?.();

        // Nettoyer
        projectile.destroy();
        trail.destroy();
        const index = this.projectiles.indexOf(projectile);
        if (index > -1) this.projectiles.splice(index, 1);
      },
    });
  }

  /**
   * Crée un effet d'impact
   */
  createImpactEffect(x: number, y: number, color: number): void {
    const circle = this.scene.add.circle(x, y, 5, color);
    circle.setDepth(48);

    this.scene.tweens.add({
      targets: circle,
      scale: 3,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => circle.destroy(),
    });
  }

  /**
   * Crée un effet de skill de zone (cercle)
   */
  createAreaEffect(x: number, y: number, radius: number, color: number, duration: number = 500): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(47);

    // Cercle intérieur
    graphics.fillStyle(color, 0.3);
    graphics.fillCircle(x, y, radius);

    // Cercle extérieur (bord)
    graphics.lineStyle(3, color, 0.8);
    graphics.strokeCircle(x, y, radius);

    // Animation de disparition
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Crée un effet de skill en ligne
   */
  createLineEffect(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    color: number,
    duration: number = 300
  ): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(47);

    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    const perpAngle = angle + Math.PI / 2;
    const halfWidth = width / 2;

    const points = [
      { x: startX + Math.cos(perpAngle) * halfWidth, y: startY + Math.sin(perpAngle) * halfWidth },
      { x: startX - Math.cos(perpAngle) * halfWidth, y: startY - Math.sin(perpAngle) * halfWidth },
      { x: endX - Math.cos(perpAngle) * halfWidth, y: endY - Math.sin(perpAngle) * halfWidth },
      { x: endX + Math.cos(perpAngle) * halfWidth, y: endY + Math.sin(perpAngle) * halfWidth },
    ];

    graphics.fillStyle(color, 0.5);
    graphics.fillPoints(points, true);

    graphics.lineStyle(2, color, 0.8);
    graphics.strokePoints(points, true);

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Crée un effet de skill en cône
   */
  createConeEffect(
    x: number,
    y: number,
    direction: number,
    angleWidth: number,
    length: number,
    color: number,
    duration: number = 400
  ): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(47);

    const halfAngle = Phaser.Math.DegToRad(angleWidth / 2);
    const startAngle = direction - halfAngle;
    const endAngle = direction + halfAngle;

    graphics.fillStyle(color, 0.4);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.arc(x, y, length, startAngle, endAngle, false);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, color, 0.8);
    graphics.strokePath();

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Joue l'effet visuel d'un skill
   */
  playSkillEffect(config: SkillEffectConfig): void {
    const { x, y, skill, direction = 0 } = config;
    const color = ELEMENT_COLORS[skill.element] ?? ELEMENT_COLORS.NONE;

    // Selon le type de telegraph
    switch (skill.telegraphShape) {
      case 'circle':
        this.createAreaEffect(x, y, skill.areaOfEffect || skill.range, color);
        break;

      case 'line':
        const endX = x + Math.cos(direction) * skill.range;
        const endY = y + Math.sin(direction) * skill.range;
        this.createLineEffect(x, y, endX, endY, skill.telegraphWidth ?? 30, color);
        break;

      case 'cone':
        this.createConeEffect(
          x, y, direction,
          skill.telegraphWidth ?? 60,
          skill.range,
          color
        );
        break;

      default:
        // Effet par défaut (petit cercle)
        this.createImpactEffect(x, y, color);
    }
  }

  /**
   * Crée un effet de buff/debuff
   */
  createStatusEffect(x: number, y: number, color: number, isPositive: boolean): void {
    const symbols = isPositive ? '↑' : '↓';
    const text = this.scene.add.text(x, y - 30, symbols, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: `#${color.toString(16).padStart(6, '0')}`,
    });
    text.setOrigin(0.5);
    text.setDepth(102);

    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Crée un effet de mort
   */
  createDeathEffect(x: number, y: number): void {
    // Cercle qui s'étend
    const circle = this.scene.add.circle(x, y, 10, 0xff0000, 0.8);
    circle.setDepth(46);

    this.scene.tweens.add({
      targets: circle,
      scale: 4,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => circle.destroy(),
    });

    // Particules
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.scene.add.circle(x, y, 4, 0xff6666);
      particle.setDepth(46);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * Crée un effet de level up
   */
  createLevelUpEffect(x: number, y: number): void {
    // Texte
    const text = this.scene.add.text(x, y - 40, 'LEVEL UP!', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    text.setDepth(103);

    this.scene.tweens.add({
      targets: text,
      y: y - 80,
      scale: 1.2,
      duration: 500,
      ease: 'Bounce',
      yoyo: true,
      onComplete: () => text.destroy(),
    });

    // Cercles
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        const circle = this.scene.add.circle(x, y, 20, 0xffff00, 0.6);
        circle.setDepth(45);

        this.scene.tweens.add({
          targets: circle,
          scale: 3,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => circle.destroy(),
        });
      });
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    this.damageTextPool.forEach((t) => t.destroy());
    this.damageTextPool = [];
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles = [];
    this.effectsContainer.destroy();
  }
}
