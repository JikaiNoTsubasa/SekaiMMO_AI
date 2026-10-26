// Skill Telegraph System - Affichage des indicateurs de skills au sol
// SekaiMMO v2.0

import Phaser from 'phaser';
import type { TelegraphShape, SkillData } from '../types';
import { ELEMENT_COLORS } from '../types';

interface TelegraphConfig {
  shape: TelegraphShape;
  width: number;
  length: number;
  color: number;
  alpha: number;
}

export class SkillTelegraph {
  private graphics: Phaser.GameObjects.Graphics;
  private isVisible: boolean = false;
  private currentConfig: TelegraphConfig | null = null;
  private originX: number = 0;
  private originY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
    this.graphics.setVisible(false);
  }

  /**
   * Affiche le telegraph pour un skill
   */
  show(skill: SkillData, originX: number, originY: number): void {
    if (!skill.telegraphShape) {
      this.hide();
      return;
    }

    this.originX = originX;
    this.originY = originY;
    this.currentConfig = {
      shape: skill.telegraphShape,
      width: skill.telegraphWidth ?? skill.areaOfEffect,
      length: skill.telegraphLength ?? skill.range,
      color: ELEMENT_COLORS[skill.element] ?? 0x4f9dff,
      alpha: 0.3,
    };

    this.isVisible = true;
    this.graphics.setVisible(true);
    this.updatePosition(originX, originY);
  }

  /**
   * Cache le telegraph
   */
  hide(): void {
    this.isVisible = false;
    this.graphics.setVisible(false);
    this.graphics.clear();
    this.currentConfig = null;
  }

  /**
   * Met à jour la position du telegraph en fonction de la souris
   */
  updatePosition(targetX: number, targetY: number): void {
    if (!this.isVisible || !this.currentConfig) return;

    this.targetX = targetX;
    this.targetY = targetY;
    this.draw();
  }

  /**
   * Dessine le telegraph
   */
  private draw(): void {
    if (!this.currentConfig) return;

    this.graphics.clear();

    const { shape, width, length, color, alpha } = this.currentConfig;

    // Style de remplissage
    this.graphics.fillStyle(color, alpha);
    this.graphics.lineStyle(2, color, alpha + 0.3);

    switch (shape) {
      case 'circle':
        this.drawCircle(width);
        break;
      case 'line':
        this.drawLine(width, length);
        break;
      case 'cone':
        this.drawCone(width, length);
        break;
      case 'rectangle':
        this.drawRectangle(width, length);
        break;
    }
  }

  /**
   * Dessine un cercle (zone AoE)
   */
  private drawCircle(radius: number): void {
    // Cercle à la position de la souris
    this.graphics.fillCircle(this.targetX, this.targetY, radius);
    this.graphics.strokeCircle(this.targetX, this.targetY, radius);

    // Ligne de l'origine vers la cible
    this.graphics.lineStyle(1, this.currentConfig!.color, 0.5);
    this.graphics.lineBetween(this.originX, this.originY, this.targetX, this.targetY);

    // Indicateur de portée (cercle autour du joueur)
    this.graphics.lineStyle(1, this.currentConfig!.color, 0.2);
    this.graphics.strokeCircle(this.originX, this.originY, this.currentConfig!.length);
  }

  /**
   * Dessine une ligne (skillshot)
   */
  private drawLine(width: number, length: number): void {
    const angle = Phaser.Math.Angle.Between(
      this.originX, this.originY,
      this.targetX, this.targetY
    );

    const endX = this.originX + Math.cos(angle) * length;
    const endY = this.originY + Math.sin(angle) * length;

    // Rectangle aligné sur la direction
    const perpAngle = angle + Math.PI / 2;
    const halfWidth = width / 2;

    const points = [
      { x: this.originX + Math.cos(perpAngle) * halfWidth, y: this.originY + Math.sin(perpAngle) * halfWidth },
      { x: this.originX - Math.cos(perpAngle) * halfWidth, y: this.originY - Math.sin(perpAngle) * halfWidth },
      { x: endX - Math.cos(perpAngle) * halfWidth, y: endY - Math.sin(perpAngle) * halfWidth },
      { x: endX + Math.cos(perpAngle) * halfWidth, y: endY + Math.sin(perpAngle) * halfWidth },
    ];

    this.graphics.fillPoints(points, true);
    this.graphics.strokePoints(points, true);

    // Flèche au bout
    this.drawArrowHead(endX, endY, angle, 15);
  }

  /**
   * Dessine un cône (zone en éventail)
   */
  private drawCone(angleWidth: number, length: number): void {
    const angle = Phaser.Math.Angle.Between(
      this.originX, this.originY,
      this.targetX, this.targetY
    );

    // Convertir angleWidth de degrés en radians
    const halfAngle = Phaser.Math.DegToRad(angleWidth / 2);

    const startAngle = angle - halfAngle;
    const endAngle = angle + halfAngle;

    // Dessiner l'arc
    this.graphics.beginPath();
    this.graphics.moveTo(this.originX, this.originY);
    this.graphics.arc(
      this.originX, this.originY,
      length,
      startAngle, endAngle,
      false
    );
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();
  }

  /**
   * Dessine un rectangle
   */
  private drawRectangle(width: number, length: number): void {
    const angle = Phaser.Math.Angle.Between(
      this.originX, this.originY,
      this.targetX, this.targetY
    );

    // Centre du rectangle à mi-chemin
    const centerX = this.originX + Math.cos(angle) * (length / 2);
    const centerY = this.originY + Math.sin(angle) * (length / 2);

    // Coins du rectangle
    const perpAngle = angle + Math.PI / 2;
    const halfWidth = width / 2;
    const halfLength = length / 2;

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const cosPerpAngle = Math.cos(perpAngle);
    const sinPerpAngle = Math.sin(perpAngle);

    const points = [
      {
        x: centerX - cosAngle * halfLength + cosPerpAngle * halfWidth,
        y: centerY - sinAngle * halfLength + sinPerpAngle * halfWidth,
      },
      {
        x: centerX - cosAngle * halfLength - cosPerpAngle * halfWidth,
        y: centerY - sinAngle * halfLength - sinPerpAngle * halfWidth,
      },
      {
        x: centerX + cosAngle * halfLength - cosPerpAngle * halfWidth,
        y: centerY + sinAngle * halfLength - sinPerpAngle * halfWidth,
      },
      {
        x: centerX + cosAngle * halfLength + cosPerpAngle * halfWidth,
        y: centerY + sinAngle * halfLength + sinPerpAngle * halfWidth,
      },
    ];

    this.graphics.fillPoints(points, true);
    this.graphics.strokePoints(points, true);
  }

  /**
   * Dessine une flèche au bout d'une ligne
   */
  private drawArrowHead(x: number, y: number, angle: number, size: number): void {
    const leftAngle = angle + Math.PI * 0.8;
    const rightAngle = angle - Math.PI * 0.8;

    const points = [
      { x, y },
      { x: x + Math.cos(leftAngle) * size, y: y + Math.sin(leftAngle) * size },
      { x: x + Math.cos(rightAngle) * size, y: y + Math.sin(rightAngle) * size },
    ];

    this.graphics.fillPoints(points, true);
  }

  /**
   * Récupère la position cible actuelle
   */
  getTargetPosition(): { x: number; y: number } | null {
    if (!this.isVisible) return null;
    return { x: this.targetX, y: this.targetY };
  }

  /**
   * Vérifie si le telegraph est visible
   */
  isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Vérifie si la cible est dans la portée
   */
  isInRange(): boolean {
    if (!this.isVisible || !this.currentConfig) return false;

    const distance = Phaser.Math.Distance.Between(
      this.originX, this.originY,
      this.targetX, this.targetY
    );

    return distance <= this.currentConfig.length;
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    this.graphics.destroy();
  }
}

/**
 * Gestionnaire de plusieurs telegraphs (pour preview de plusieurs skills)
 */
export class TelegraphManager {
  private scene: Phaser.Scene;
  private telegraphs: Map<string, SkillTelegraph> = new Map();
  private activeTelegraph: SkillTelegraph | null = null;
  private activeSkill: SkillData | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Active le telegraph pour un skill
   */
  activate(skillSlot: string, skill: SkillData, originX: number, originY: number): void {
    // Désactiver le telegraph actuel
    this.deactivate();

    // Créer ou récupérer le telegraph
    let telegraph = this.telegraphs.get(skillSlot);
    if (!telegraph) {
      telegraph = new SkillTelegraph(this.scene);
      this.telegraphs.set(skillSlot, telegraph);
    }

    telegraph.show(skill, originX, originY);
    this.activeTelegraph = telegraph;
    this.activeSkill = skill;
  }

  /**
   * Désactive le telegraph actif
   */
  deactivate(): void {
    if (this.activeTelegraph) {
      this.activeTelegraph.hide();
      this.activeTelegraph = null;
      this.activeSkill = null;
    }
  }

  /**
   * Met à jour la position du telegraph actif
   */
  update(targetX: number, targetY: number): void {
    if (this.activeTelegraph) {
      this.activeTelegraph.updatePosition(targetX, targetY);
    }
  }

  /**
   * Récupère la position cible du telegraph actif
   */
  getTargetPosition(): { x: number; y: number } | null {
    return this.activeTelegraph?.getTargetPosition() ?? null;
  }

  /**
   * Récupère le skill actif
   */
  getActiveSkill(): SkillData | null {
    return this.activeSkill;
  }

  /**
   * Vérifie si un telegraph est actif
   */
  isActive(): boolean {
    return this.activeTelegraph?.isActive() ?? false;
  }

  /**
   * Vérifie si la cible est dans la portée
   */
  isInRange(): boolean {
    return this.activeTelegraph?.isInRange() ?? false;
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    this.telegraphs.forEach((t) => t.destroy());
    this.telegraphs.clear();
    this.activeTelegraph = null;
    this.activeSkill = null;
  }
}
