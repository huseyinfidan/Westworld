/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector2D {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2D;
  size: Vector2D;
  health: number;
  maxHealth: number;
  velocity: Vector2D;
  type: 'player' | 'bandit' | 'bandit_fast' | 'bandit_tough' | 'bandit_shooter' | 'boss' | 'civilian';
  lastShot?: number;
}

export interface Projectile {
  id: string;
  pos: Vector2D;
  velocity: Vector2D;
  damage: number;
  ownerId: string;
}

export interface Particle {
  id: string;
  pos: Vector2D;
  velocity: Vector2D;
  life: number; // 0 to 1
  color: string;
  size: number;
}

export type GameState = 'menu' | 'playing' | 'gameover' | 'paused' | 'shop';

export type WeaponType = 'revolver' | 'shotgun' | 'rifle';

export interface Upgrades {
  fireRate: number;
  damage: number;
  maxHealth: number;
  deadeyeDuration: number;
  dynamiteCount: number;
  weaponType: WeaponType;
}

export interface Environmental {
  id: string;
  pos: Vector2D;
  type: 'barrel' | 'cactus' | 'rock' | 'skull';
  health?: number;
}

export interface LevelConfig {
  banditSpawnRate: number;
  banditSpeed: number;
  banditHealth: number;
  maxBandits: number;
}
