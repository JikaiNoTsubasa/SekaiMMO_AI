// Input Manager - Gestion des inputs style MOBA
// Click droit pour déplacement, touches pour skills, quick cast
// SekaiMMO v2.0

import Phaser from 'phaser';
import type { SkillSlot, SkillData } from '../types';
import { DEFAULT_SKILL_KEYS } from '../types';

export interface InputConfig {
  // Touches personnalisables
  skillKeys: Record<SkillSlot, string>;
  // Mode quick cast (cast immédiat sur pression de touche)
  quickCast: boolean;
  // Afficher le telegraph même en quick cast (sur maintien)
  quickCastWithIndicator: boolean;
}

export interface InputState {
  // Position de la souris dans le monde
  mouseWorldX: number;
  mouseWorldY: number;
  // Mouvement demandé
  moveTarget: { x: number; y: number } | null;
  // Skill en cours de ciblage
  targetingSkill: SkillSlot | null;
  // Skill à lancer
  castSkill: { slot: SkillSlot; targetX: number; targetY: number } | null;
  // Interaction avec un NPC/objet
  interactTarget: { x: number; y: number } | null;
}

export type InputEventType =
  | 'move'
  | 'skill-start'
  | 'skill-cast'
  | 'skill-cancel'
  | 'interact'
  | 'stop';

export interface InputEvent {
  type: InputEventType;
  data: unknown;
}

type InputCallback = (event: InputEvent) => void;

export class InputManager {
  private scene: Phaser.Scene;
  private config: InputConfig;
  private state: InputState;
  private callbacks: InputCallback[] = [];

  // Touches Phaser
  private skillKeyObjects: Map<SkillSlot, Phaser.Input.Keyboard.Key> = new Map();
  private stopKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;

  // État des touches maintenues
  private heldSkillKey: SkillSlot | null = null;
  private keyHoldStartTime: number = 0;
  private readonly HOLD_THRESHOLD = 150; // ms avant d'afficher le telegraph

  // Skills disponibles (mis à jour par le jeu)
  private skillBar: Map<SkillSlot, SkillData | null> = new Map();

  constructor(scene: Phaser.Scene, config?: Partial<InputConfig>) {
    this.scene = scene;
    this.config = {
      skillKeys: config?.skillKeys ?? { ...DEFAULT_SKILL_KEYS },
      quickCast: config?.quickCast ?? false,
      quickCastWithIndicator: config?.quickCastWithIndicator ?? true,
    };

    this.state = {
      mouseWorldX: 0,
      mouseWorldY: 0,
      moveTarget: null,
      targetingSkill: null,
      castSkill: null,
      interactTarget: null,
    };

    this.setupInputs();
  }

  /**
   * Configure les inputs
   */
  private setupInputs(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    // Configurer les touches de skills
    const slots: SkillSlot[] = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
    for (const slot of slots) {
      const keyCode = this.config.skillKeys[slot];
      const key = keyboard.addKey(keyCode);
      this.skillKeyObjects.set(slot, key);

      // Événements de touche
      key.on('down', () => this.onSkillKeyDown(slot));
      key.on('up', () => this.onSkillKeyUp(slot));
    }

    // Touche Stop (S par défaut, mais on utilise Espace aussi)
    this.stopKey = keyboard.addKey('SPACE');
    this.stopKey.on('down', () => this.onStopKey());

    // Touche Escape pour annuler
    this.escapeKey = keyboard.addKey('ESC');
    this.escapeKey.on('down', () => this.onEscapeKey());

    // Click droit pour déplacement
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.onRightClick(pointer);
      } else if (pointer.leftButtonDown()) {
        this.onLeftClick(pointer);
      }
    });

    // Suivi de la souris
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.state.mouseWorldX = pointer.worldX;
      this.state.mouseWorldY = pointer.worldY;
    });

    // Désactiver le menu contextuel
    this.scene.game.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  /**
   * Appelé quand une touche de skill est pressée
   */
  private onSkillKeyDown(slot: SkillSlot): void {
    const skill = this.skillBar.get(slot);
    if (!skill) return;

    if (this.config.quickCast && !this.config.quickCastWithIndicator) {
      // Quick cast immédiat
      this.castSkillAtMouse(slot);
    } else {
      // Commencer le ciblage ou préparer le quick cast avec indicator
      this.heldSkillKey = slot;
      this.keyHoldStartTime = this.scene.time.now;

      if (!this.config.quickCast) {
        // Mode normal: afficher le telegraph immédiatement
        this.startTargeting(slot);
      }
    }
  }

  /**
   * Appelé quand une touche de skill est relâchée
   */
  private onSkillKeyUp(slot: SkillSlot): void {
    if (this.heldSkillKey !== slot) return;

    const holdDuration = this.scene.time.now - this.keyHoldStartTime;

    if (this.config.quickCast) {
      if (this.config.quickCastWithIndicator && holdDuration >= this.HOLD_THRESHOLD) {
        // Quick cast avec indicator: lancer le skill
        this.castSkillAtMouse(slot);
      } else if (!this.config.quickCastWithIndicator || holdDuration < this.HOLD_THRESHOLD) {
        // Quick cast immédiat
        this.castSkillAtMouse(slot);
      }
    } else if (this.state.targetingSkill === slot) {
      // Mode normal avec ciblage actif: lancer le skill
      this.castSkillAtMouse(slot);
    }

    this.heldSkillKey = null;
    this.cancelTargeting();
  }

  /**
   * Click droit - Déplacement
   */
  private onRightClick(pointer: Phaser.Input.Pointer): void {
    // Annuler le ciblage en cours
    this.cancelTargeting();

    // Définir la cible de mouvement
    this.state.moveTarget = {
      x: pointer.worldX,
      y: pointer.worldY,
    };

    this.emit({
      type: 'move',
      data: this.state.moveTarget,
    });
  }

  /**
   * Click gauche - Confirmer le ciblage ou interagir
   */
  private onLeftClick(pointer: Phaser.Input.Pointer): void {
    if (this.state.targetingSkill) {
      // Confirmer le lancer du skill
      this.castSkillAtMouse(this.state.targetingSkill);
      this.cancelTargeting();
    } else {
      // Interaction avec un objet/NPC
      this.state.interactTarget = {
        x: pointer.worldX,
        y: pointer.worldY,
      };

      this.emit({
        type: 'interact',
        data: this.state.interactTarget,
      });
    }
  }

  /**
   * Touche Stop
   */
  private onStopKey(): void {
    this.state.moveTarget = null;
    this.cancelTargeting();

    this.emit({
      type: 'stop',
      data: null,
    });
  }

  /**
   * Touche Escape
   */
  private onEscapeKey(): void {
    if (this.state.targetingSkill) {
      this.cancelTargeting();
    }
  }

  /**
   * Commence le ciblage d'un skill
   */
  private startTargeting(slot: SkillSlot): void {
    const skill = this.skillBar.get(slot);
    if (!skill) return;

    this.state.targetingSkill = slot;

    this.emit({
      type: 'skill-start',
      data: { slot, skill },
    });
  }

  /**
   * Annule le ciblage
   */
  private cancelTargeting(): void {
    if (this.state.targetingSkill) {
      this.emit({
        type: 'skill-cancel',
        data: { slot: this.state.targetingSkill },
      });
    }
    this.state.targetingSkill = null;
  }

  /**
   * Lance un skill à la position de la souris
   */
  private castSkillAtMouse(slot: SkillSlot): void {
    const skill = this.skillBar.get(slot);
    if (!skill) return;

    this.state.castSkill = {
      slot,
      targetX: this.state.mouseWorldX,
      targetY: this.state.mouseWorldY,
    };

    this.emit({
      type: 'skill-cast',
      data: {
        slot,
        skill,
        targetX: this.state.mouseWorldX,
        targetY: this.state.mouseWorldY,
      },
    });

    this.state.castSkill = null;
  }

  /**
   * Mise à jour appelée chaque frame
   */
  update(): void {
    // Afficher le telegraph en mode quick cast avec indicator si maintenu assez longtemps
    if (
      this.config.quickCast &&
      this.config.quickCastWithIndicator &&
      this.heldSkillKey &&
      !this.state.targetingSkill
    ) {
      const holdDuration = this.scene.time.now - this.keyHoldStartTime;
      if (holdDuration >= this.HOLD_THRESHOLD) {
        this.startTargeting(this.heldSkillKey);
      }
    }
  }

  /**
   * Met à jour la barre de skills
   */
  setSkillBar(skills: Map<SkillSlot, SkillData | null>): void {
    this.skillBar = skills;
  }

  /**
   * Met à jour un skill dans la barre
   */
  setSkill(slot: SkillSlot, skill: SkillData | null): void {
    this.skillBar.set(slot, skill);
  }

  /**
   * Configure le mode quick cast
   */
  setQuickCast(enabled: boolean, withIndicator: boolean = true): void {
    this.config.quickCast = enabled;
    this.config.quickCastWithIndicator = withIndicator;
  }

  /**
   * Récupère l'état actuel
   */
  getState(): Readonly<InputState> {
    return this.state;
  }

  /**
   * Récupère la position de la souris
   */
  getMousePosition(): { x: number; y: number } {
    return {
      x: this.state.mouseWorldX,
      y: this.state.mouseWorldY,
    };
  }

  /**
   * Vérifie si un skill est en cours de ciblage
   */
  isTargeting(): boolean {
    return this.state.targetingSkill !== null;
  }

  /**
   * Récupère le slot du skill en cours de ciblage
   */
  getTargetingSlot(): SkillSlot | null {
    return this.state.targetingSkill;
  }

  /**
   * S'abonne aux événements d'input
   */
  onInput(callback: InputCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Émet un événement
   */
  private emit(event: InputEvent): void {
    for (const callback of this.callbacks) {
      callback(event);
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    this.skillKeyObjects.forEach((key) => key.destroy());
    this.skillKeyObjects.clear();
    this.stopKey.destroy();
    this.escapeKey.destroy();
    this.callbacks = [];
  }
}
