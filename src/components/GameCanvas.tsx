/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { Vector2D, Entity, Projectile, Particle, GameState, LevelConfig, Upgrades, Environmental } from '../types';
import { Crosshair, Heart, Trophy, Zap, ShoppingCart, Bomb, Shield, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_LEVEL: LevelConfig = {
  banditSpawnRate: 0.015,
  banditSpeed: 0.9,
  banditHealth: 1,
  maxBandits: 5,
};

const INITIAL_UPGRADES: Upgrades = {
  fireRate: 1,
  damage: 1,
  maxHealth: 100,
  deadeyeDuration: 5,
  dynamiteCount: 3,
  weaponType: 'revolver',
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [level, setLevel] = useState(1);
  const [gold, setGold] = useState(0);
  
  // Game state refs (to avoid re-renders and stale closures)
  const stateRef = useRef({
    gameState: 'menu' as GameState,
    playerPos: { x: 0, y: 0 },
    bandits: [] as Entity[],
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    environmentals: [] as Environmental[],
    lastSpawn: 0,
    level: 1,
    score: 0,
    gold: 0,
    health: 100,
    levelConfig: INITIAL_LEVEL,
    upgrades: INITIAL_UPGRADES,
    mousePos: { x: 0, y: 0 },
    shake: 0,
    flash: 0,
    combo: 0,
    lastKillTime: 0,
    startTime: 0,
    lastFireTime: 0,
    deadeye: 100, // percentage
    isDeadeyeActive: false,
    waveProgress: 0,
    waveTarget: 10,
    purchasesThisWave: 0,
    maxHealthBought: false,
    purchasedTypesThisWave: [] as string[],
  });

  const requestRef = useRef<number>(0);

  const spawnBandit = (width: number, height: number) => {
    const side = Math.floor(Math.random() * 3); // Top, Left, Right
    let x, y;
    if (side === 0) { // Top
      x = Math.random() * width;
      y = -50;
    } else if (side === 1) { // Left
      x = -50;
      y = Math.random() * (height * 0.6);
    } else { // Right
      x = width + 50;
      y = Math.random() * (height * 0.6);
    }

    const id = Math.random().toString(36).substr(2, 9);
    
    let banditHealth = stateRef.current.levelConfig.banditHealth;
    let size = { x: 40, y: 60 };
    
    // Choose type based on level
    let type: Entity['type'] = 'bandit';
    const rand = Math.random();
    
    if (stateRef.current.level % 5 === 0 && stateRef.current.waveProgress === stateRef.current.waveTarget - 1) {
        type = 'boss';
        banditHealth *= 10;
        size = { x: 70, y: 100 };
    } else if (stateRef.current.level >= 5 && rand < 0.15) {
      type = 'bandit_tough';
    } else if (stateRef.current.level >= 3 && rand < 0.3) {
      type = 'bandit_fast';
    } else if (stateRef.current.level >= 2) {
      // Scale shooter probability: starts low at level 2, increases as waves progress
      const shooterProb = stateRef.current.level === 2 ? 0.1 : (stateRef.current.level === 3 ? 0.15 : 0.25);
      if (rand < shooterProb) {
        type = 'bandit_shooter';
      }
    }

    if (type === 'bandit_fast') {
      size = { x: 30, y: 50 };
    } else if (type === 'bandit_tough') {
      banditHealth *= 3;
      size = { x: 50, y: 70 };
    }

    stateRef.current.bandits.push({
      id,
      pos: { x, y },
      size,
      health: banditHealth,
      maxHealth: banditHealth,
      velocity: { x: 0, y: 0 },
      type,
      lastShot: 0,
    });
  };

  const createParticles = (pos: Vector2D, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
        id: Math.random().toString(36).substr(2, 9),
        pos: { ...pos },
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
        },
        life: 1,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  };

  const update = (time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    const { width, height } = canvasRef.current;
    let timeStep = 1;

    if (stateRef.current.gameState === 'playing') {
      timeStep = stateRef.current.isDeadeyeActive ? 0.3 : 1;

      // Handle Deadeye
      if (stateRef.current.isDeadeyeActive) {
        stateRef.current.deadeye -= 0.5;
        if (stateRef.current.deadeye <= 0) stateRef.current.isDeadeyeActive = false;
      } else {
        stateRef.current.deadeye = Math.min(100, stateRef.current.deadeye + 0.1);
      }

      // Progression / Wave Check
      if (stateRef.current.waveProgress >= stateRef.current.waveTarget && stateRef.current.bandits.length === 0) {
        stateRef.current.gameState = 'shop';
        stateRef.current.waveProgress = 0;
        stateRef.current.waveTarget += 5;
        stateRef.current.level += 1;
        stateRef.current.purchasesThisWave = 0;
        stateRef.current.purchasedTypesThisWave = [];
        
        // Sync React state for UI
        setGameState('shop');
        setLevel(stateRef.current.level);
        
        stateRef.current.levelConfig = {
          banditSpawnRate: INITIAL_LEVEL.banditSpawnRate + (stateRef.current.level * 0.005),
          banditSpeed: INITIAL_LEVEL.banditSpeed + (stateRef.current.level * 0.05),
          banditHealth: INITIAL_LEVEL.banditHealth,
          maxBandits: INITIAL_LEVEL.maxBandits + stateRef.current.level,
        };
      }

      // Only run further logic if still playing (wasn't just changed to shop)
      if (stateRef.current.gameState === 'playing') {
        // Spawn bandits
        if (stateRef.current.waveProgress < stateRef.current.waveTarget && stateRef.current.bandits.length < stateRef.current.levelConfig.maxBandits) {
          if (Math.random() < stateRef.current.levelConfig.banditSpawnRate) {
            spawnBandit(width, height);
            stateRef.current.waveProgress++;
          }
        }

      // Update bandits
      stateRef.current.bandits.forEach((bandit, index) => {
        const targetX = width / 2;
        const targetY = height - 50;
        const dx = targetX - bandit.pos.x;
        const dy = targetY - bandit.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let moveSpeed = stateRef.current.levelConfig.banditSpeed * timeStep;
        if (bandit.type === 'bandit_fast') moveSpeed *= 1.8;
        if (bandit.type === 'bandit_tough') moveSpeed *= 0.6;

        const isShooter = bandit.type === 'bandit_shooter';
        const stopDist = 300;

        if (isShooter && dist < stopDist) {
          const now = Date.now();
          if (!bandit.lastShot || now - bandit.lastShot > 2000 / timeStep) {
            bandit.lastShot = now;
            const shootDx = targetX - bandit.pos.x;
            const shootDy = targetY - bandit.pos.y;
            const shootDist = Math.sqrt(shootDx * shootDx + shootDy * shootDy);
            
            stateRef.current.projectiles.push({
              id: Math.random().toString(36).substr(2, 9),
              pos: { ...bandit.pos },
              velocity: {
                x: (shootDx / shootDist) * 8 * timeStep,
                y: (shootDy / shootDist) * 8 * timeStep,
              },
              damage: 10,
              ownerId: bandit.id,
            });
          }
        } else {
          bandit.pos.x += (dx / dist) * moveSpeed;
          bandit.pos.y += (dy / dist) * moveSpeed;
        }

        if (dist < 80) {
          stateRef.current.health -= 5;
          setHealth(stateRef.current.health); // Sync UI
          
          if (stateRef.current.health <= 0) {
            setGameState('gameover');
            stateRef.current.gameState = 'gameover';
          }
          stateRef.current.bandits.splice(index, 1);
          stateRef.current.shake = 10;
          createParticles(bandit.pos, '#facc15', 10);
        }
      });

      // Update projectiles
        stateRef.current.projectiles.forEach((p, pIndex) => {
          p.pos.x += p.velocity.x;
          p.pos.y += p.velocity.y;

          if (p.pos.x < 0 || p.pos.x > width || p.pos.y < 0 || p.pos.y > height) {
            stateRef.current.projectiles.splice(pIndex, 1);
            return;
          }

          if (p.ownerId !== 'player') {
            const dx = p.pos.x - (width / 2);
            const dy = p.pos.y - (height - 50);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 40) {
              stateRef.current.health -= p.damage;
              setHealth(stateRef.current.health); // Sync UI
              
              if (stateRef.current.health <= 0) {
                setGameState('gameover');
                stateRef.current.gameState = 'gameover';
              }
              stateRef.current.projectiles.splice(pIndex, 1);
              stateRef.current.shake = 10;
              stateRef.current.flash = 1;
              createParticles(p.pos, '#ef4444', 10);
              return;
            }
          }

          if (p.ownerId === 'player') {
            // Hit check environmentals (Only barrels block shots/explode)
            stateRef.current.environmentals.forEach((env, eIndex) => {
              if (env.type !== "barrel") return;
              
              const dx = p.pos.x - env.pos.x;
              const dy = p.pos.y - env.pos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 30) {
                  // Explosion
                  createParticles(env.pos, "#f59e0b", 30);
                  stateRef.current.shake = 15;
                  // Damage bandits nearby
                  stateRef.current.bandits.forEach((bandit, bIndex) => {
                    const bDx = bandit.pos.x - env.pos.x;
                    const bDy = bandit.pos.y - env.pos.y;
                    const bDist = Math.sqrt(bDx * bDx + bDy * bDy);
                    if (bDist < 150) {
                        bandit.health -= 5;
                        if (bandit.health <= 0) {
                             stateRef.current.bandits.splice(bIndex, 1);
                             stateRef.current.score += 1;
                             setScore(stateRef.current.score);
                             stateRef.current.gold += 20;
                             setGold(stateRef.current.gold);
                        }
                    }
                  });
                  stateRef.current.environmentals.splice(eIndex, 1);
                stateRef.current.projectiles.splice(pIndex, 1);
              }
            });

            stateRef.current.bandits.forEach((bandit, bIndex) => {
              const dx = p.pos.x - bandit.pos.x;
              const dy = p.pos.y - bandit.pos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 30) {
                bandit.health -= stateRef.current.upgrades.damage;
                stateRef.current.projectiles.splice(pIndex, 1);
                createParticles(p.pos, '#7c4a32', 5);
                
                if (bandit.health <= 0) {
                  const now = Date.now();
                  stateRef.current.combo++;
                  stateRef.current.lastKillTime = now;
                  
                  stateRef.current.bandits.splice(bIndex, 1);
                  stateRef.current.score += 1;
                  setScore(stateRef.current.score);
                  stateRef.current.gold += 10 + (stateRef.current.combo * 2);
                  setGold(stateRef.current.gold);
                  createParticles(bandit.pos, '#4d2d1d', 15);
                  createParticles(bandit.pos, '#facc15', 5); // Glow for combo
                }
              }
            });
          }
        });

      // Update particles
      stateRef.current.particles.forEach((p, index) => {
        p.pos.x += p.velocity.x;
        p.pos.y += p.velocity.y;
        p.life -= 0.02;
        if (p.life <= 0) stateRef.current.particles.splice(index, 1);
      });

      if (stateRef.current.shake > 0) stateRef.current.shake *= 0.9;
    }
    }

    // Draw
    draw(ctx, width, height);

    // Draw Flash
    if (stateRef.current.flash > 0) {
      ctx.globalAlpha = stateRef.current.flash * 0.4;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      stateRef.current.flash *= 0.85;
    }

    // Combo logic
    if (Date.now() - stateRef.current.lastKillTime > 2000) {
      stateRef.current.combo = 0;
    }

    requestRef.current = requestAnimationFrame(update);
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    if (stateRef.current.shake > 1) {
      ctx.translate((Math.random() - 0.5) * stateRef.current.shake, (Math.random() - 0.5) * stateRef.current.shake);
    }

    // Draw background (Sky Gradient)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    skyGradient.addColorStop(0, '#7c2d12'); // Darker sunset
    skyGradient.addColorStop(0.5, '#f97316'); // Mid orange
    skyGradient.addColorStop(1, '#ffedd5'); // Light horizon
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.7);

    // Draw distant mountains
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.lineTo(width * 0.1, height * 0.55);
    ctx.lineTo(width * 0.25, height * 0.65);
    ctx.lineTo(width * 0.4, height * 0.45);
    ctx.lineTo(width * 0.6, height * 0.6);
    ctx.lineTo(width * 0.8, height * 0.5);
    ctx.lineTo(width, height * 0.7);
    ctx.fill();

    // Draw secondary mountains (closer)
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.lineTo(width * 0.2, height * 0.6);
    ctx.lineTo(width * 0.4, height * 0.68);
    ctx.lineTo(width * 0.7, height * 0.58);
    ctx.lineTo(width, height * 0.7);
    ctx.fill();

    // Red Sun
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.4, 60, 0, Math.PI * 2);
    ctx.fill();

    // Draw Town Buildings (Horizon line)
    const drawBuilding = (x: number, y: number, w: number, h: number, name?: string, color = '#451a03') => {
        ctx.save();
        ctx.translate(x, y);
        
        // Main structure
        ctx.fillStyle = color;
        ctx.fillRect(0, -h, w, h);
        
        // Roof
        ctx.fillStyle = '#2d1102';
        ctx.beginPath();
        ctx.moveTo(-5, -h);
        ctx.lineTo(w + 5, -h);
        ctx.lineTo(w + 2, -h - 10);
        ctx.lineTo(-2, -h - 10);
        ctx.fill();

        // Signboard backdrop
        if (name) {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(5, -h + 10, w - 10, 20);
            ctx.fillStyle = '#fef3c7';
            ctx.font = '10px "Courier New", Courier, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(name, w/2, -h + 23);
        }

        // Windows
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
        const winW = 10;
        const winH = 15;
        ctx.fillRect(w * 0.2 - winW/2, -h + 40, winW, winH);
        ctx.fillRect(w * 0.8 - winW/2, -h + 40, winW, winH);

        // Porch/Awning
        ctx.fillStyle = '#3f1a04';
        ctx.fillRect(-2, -35, w + 4, 5);
        ctx.fillRect(w * 0.1, -35, 3, 35);
        ctx.fillRect(w * 0.9, -35, 3, 35);

        ctx.restore();
    };

    // Draw the town street
    drawBuilding(width * 0.05, height * 0.7, 80, 110, 'BANK');
    drawBuilding(width * 0.2, height * 0.7, 100, 140, 'SALOON', '#5a2205');
    drawBuilding(width * 0.35, height * 0.7, 70, 90, 'STORE');
    drawBuilding(width * 0.55, height * 0.7, 90, 120, 'SHERIFF', '#3b1604');
    drawBuilding(width * 0.75, height * 0.7, 110, 150, 'HOTEL', '#632606');
    drawBuilding(width * 0.9, height * 0.7, 60, 80);

    // Draw Sand Floor
    ctx.fillStyle = '#92400e'; // Ground
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Sand pattern / Pebbles
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for(let i=0; i<60; i++) {
        const x = (i * 211) % width;
        const y = height * 0.7 + ((i * 137) % (height * 0.3));
        ctx.fillRect(x, y, 3, 3);
    }

    // Ground shadows for atmosphere
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    ctx.ellipse(width/2, height, width, 100, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Main Street Boardwalk (just below horizon)
    ctx.fillStyle = '#5a3d2b';
    ctx.fillRect(0, height * 0.7, width, 30);
    ctx.fillStyle = '#4a3223';
    for(let i=0; i<width; i+=20) {
        ctx.fillRect(i, height * 0.7, 2, 30);
    }

    // Hitching posts along the boardwalk
    ctx.fillStyle = '#3f2a1d';
    for(let i=100; i<width; i+=300) {
        ctx.fillRect(i, height * 0.7 + 30, 4, 15); // Post
        ctx.fillRect(i - 10, height * 0.7 + 30, 20, 3); // Rail
    }

    // Wind particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
        const x = (now * 0.15 + i * 250) % (width + 300) - 150;
        const y = (i * 80) % height;
        ctx.fillRect(x, y, 60, 1);
    }

    // Draw Environmentals
    stateRef.current.environmentals.forEach(env => {
      ctx.save();
      ctx.translate(env.pos.x, env.pos.y);
      if (env.type === 'barrel') {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-20, -25, 40, 50);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-20, -15, 40, 5);
        ctx.fillRect(-20, 10, 40, 5);
      } else if (env.type === 'cactus') {
        ctx.fillStyle = '#166534';
        ctx.fillRect(-8, -40, 16, 50);
        ctx.fillRect(-20, -25, 12, 8);
        ctx.fillRect(8, -35, 12, 8);
      } else if (env.type === 'rock') {
        ctx.fillStyle = '#71717a';
        ctx.beginPath();
        ctx.moveTo(-15, 10);
        ctx.lineTo(-20, -5);
        ctx.lineTo(0, -20);
        ctx.lineTo(20, -5);
        ctx.lineTo(15, 10);
        ctx.fill();
      } else if (env.type === 'skull') {
        ctx.fillStyle = '#fdfcfb';
        ctx.beginPath();
        ctx.arc(0, -5, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-5, -5, 3, 0, Math.PI * 2);
        ctx.arc(5, -5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw Bandits
    stateRef.current.bandits.forEach(b => {
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      
      let bodyColor = '#1c1917';
      let hatColor = '#0c0a09';
      let bandanaColor = '#ef4444';
      let scale = 1;

      if (b.type === 'bandit_fast') {
        bodyColor = '#44403c';
        bandanaColor = '#fbbf24';
        scale = 0.8;
      } else if (b.type === 'bandit_tough') {
        bodyColor = '#0c0a09';
        bandanaColor = '#7f1d1d';
        scale = 1.3;
      } else if (b.type === 'bandit_shooter') {
        bodyColor = '#292524';
        hatColor = '#451a03';
        bandanaColor = '#3b82f6';
      }

      ctx.scale(scale, scale);

      // Bandit Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-15, -25, 30, 50);
      
      // Hat
      ctx.fillStyle = hatColor;
      ctx.fillRect(-22, -35, 44, 8);
      ctx.fillRect(-12, -45, 24, 15);
      
      // Face / Bandana
      ctx.fillStyle = bandanaColor;
      ctx.fillRect(-10, -20, 20, 10);

      // Boss details
      if (b.type === 'boss') {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(-18, -28, 36, 56);
      }

      // Weapon (shooter only)
      if (b.type === 'bandit_shooter') {
        ctx.fillStyle = '#44403c';
        ctx.fillRect(10, -5, 15, 5); // Simple pistol
      }

      // Health bar for tough bandits
      if (b.health < b.maxHealth || b.type === 'bandit_tough') {
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -60, 40, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-20, -60, (b.health / b.maxHealth) * 40, 4);
      }

      ctx.restore();
    });

    // Draw Projectiles
    stateRef.current.projectiles.forEach(p => {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#facc15';
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Particles
    stateRef.current.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Draw Player Cowboy Silhouette
    if (stateRef.current.gameState === 'playing' || stateRef.current.gameState === 'shop') {
      const px = width / 2;
      const py = height - 50;
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(px, py + 40, 40, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      
      // Silhouette color
      ctx.fillStyle = '#1c1917';
      
      // Long Duster Coat
      ctx.beginPath();
      ctx.moveTo(-18, 40);
      ctx.lineTo(-25, 10);
      ctx.quadraticCurveTo(-20, -20, -10, -35); // Left shoulder
      ctx.lineTo(10, -35);
      ctx.quadraticCurveTo(20, -20, 25, 10); // Right shoulder
      ctx.lineTo(18, 40);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(0, -45, 12, 0, Math.PI * 2);
      ctx.fill();

      // Cowboy Hat (Better shape)
      ctx.beginPath();
      ctx.ellipse(0, -55, 30, 8, 0, 0, Math.PI * 2); // Brim
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-12, -70, 24, 18, [8, 8, 2, 2]); // Top part
      ctx.fill();

      // Arms (Aiming)
      const angle = Math.atan2(stateRef.current.mousePos.y - py, stateRef.current.mousePos.x - px);
      ctx.save();
      ctx.rotate(angle);
      // Gun Arm
      ctx.fillRect(8, -5, 25, 8); 
      ctx.fillStyle = '#292524'; // Pistol
      ctx.fillRect(28, -10, 15, 7); 
      
      // Muzzle Flash
      if (Date.now() - stateRef.current.lastFireTime < 50) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(48, -7, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(48, -7, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();
    }

    // Draw Crosshair
    const mx = stateRef.current.mousePos.x;
    const my = stateRef.current.mousePos.y;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - 25, my); ctx.lineTo(mx + 25, my);
    ctx.moveTo(mx, my - 25); ctx.lineTo(mx, my + 25);
    ctx.stroke();

    ctx.restore();
  };

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stateRef.current.mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleClick = (e: MouseEvent) => {
    if (stateRef.current.gameState !== 'playing') return;
    
    // Check for Right Click for Dynamite
    if (e.button === 2) {
      handleDynamite();
      return;
    }

    const now = Date.now();
    const fireInterval = 300 / stateRef.current.upgrades.fireRate;
    if (now - stateRef.current.lastFireTime < fireInterval) return;
    
    stateRef.current.lastFireTime = now;
    
    const width = canvasRef.current?.width || 0;
    const height = canvasRef.current?.height || 0;
    const startPos = { x: width / 2, y: height - 50 };
    const targetPos = stateRef.current.mousePos;
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (stateRef.current.upgrades.weaponType === 'shotgun') {
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dy, dx) + (i * 0.15);
        stateRef.current.projectiles.push({
          id: Math.random().toString(36).substr(2, 9),
          pos: { ...startPos },
          velocity: {
            x: Math.cos(angle) * 16,
            y: Math.sin(angle) * 16,
          },
          damage: stateRef.current.upgrades.damage * 0.6,
          ownerId: 'player',
        });
      }
    } else {
      stateRef.current.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        pos: startPos,
        velocity: {
          x: (dx / dist) * 18,
          y: (dy / dist) * 18,
        },
        damage: stateRef.current.upgrades.damage,
        ownerId: 'player',
      });
    }

    stateRef.current.shake = 5;
  };

  const handleDynamite = () => {
    if (stateRef.current.upgrades.dynamiteCount <= 0) return;
    stateRef.current.upgrades.dynamiteCount--;
    
    const targetPos = stateRef.current.mousePos;
    
    // Flash at target
    createParticles(targetPos, '#fbbf24', 50);
    createParticles(targetPos, '#f97316', 30);
    stateRef.current.shake = 15;
    
    stateRef.current.bandits.forEach((bandit, bIndex) => {
      const dx = bandit.pos.x - targetPos.x;
      const dy = bandit.pos.y - targetPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        bandit.health -= 10;
        if (bandit.health <= 0) {
          stateRef.current.bandits.splice(bIndex, 1);
          stateRef.current.score += 1;
          setScore(stateRef.current.score);
          stateRef.current.gold += 25;
          setGold(stateRef.current.gold);
        }
      }
    });

    // Also explode environmentals
    stateRef.current.environmentals.forEach((env, eIndex) => {
        const dx = env.pos.x - targetPos.x;
        const dy = env.pos.y - targetPos.y;
        if (Math.sqrt(dx*dx + dy*dy) < 150) {
            if (env.type === 'barrel') {
                 createParticles(env.pos, '#f59e0b', 30);
                 stateRef.current.environmentals.splice(eIndex, 1);
            }
        }
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && stateRef.current.deadeye > 20) {
      stateRef.current.isDeadeyeActive = !stateRef.current.isDeadeyeActive;
    }
  };

  const startGame = () => {
    stateRef.current.gameState = 'playing';
    stateRef.current.level = 1;
    stateRef.current.score = 0;
    stateRef.current.gold = 0;
    stateRef.current.health = 100;
    stateRef.current.bandits = [];
    stateRef.current.projectiles = [];
    stateRef.current.particles = [];
    stateRef.current.environmentals = generateEnvironment();
    stateRef.current.levelConfig = INITIAL_LEVEL;
    stateRef.current.upgrades = INITIAL_UPGRADES;
    stateRef.current.startTime = Date.now();
    stateRef.current.deadeye = 100;
    stateRef.current.waveProgress = 0;
    stateRef.current.waveTarget = 10;
    stateRef.current.purchasesThisWave = 0;
    stateRef.current.maxHealthBought = false;
    stateRef.current.purchasedTypesThisWave = [];

    // Sync React state
    setGameState('playing');
    setScore(0);
    setGold(0);
    setHealth(100);
    setLevel(1);
  };

  const generateEnvironment = () => {
    const env: Environmental[] = [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Add some random decorations
    for (let i = 0; i < 15; i++) {
        const typeRoll = Math.random();
        let type: Environmental['type'] = 'cactus';
        if (typeRoll < 0.3) type = 'barrel';
        else if (typeRoll < 0.5) type = 'rock';
        else if (typeRoll < 0.7) type = 'skull';
        else type = 'cactus';

        env.push({
            id: Math.random().toString(36).substr(2, 9),
            pos: { 
                x: Math.random() * width, 
                y: height * 0.65 + Math.random() * (height * 0.3) 
            },
            type
        });
    }
    return env;
  };

  const buyUpgrade = (type: string, cost: number) => {
    if (stateRef.current.gold < cost || stateRef.current.purchasesThisWave >= 2 || stateRef.current.purchasedTypesThisWave.includes(type)) return;
    
    if (type === 'maxHealth') {
        if (stateRef.current.maxHealthBought) return;
        stateRef.current.maxHealthBought = true;
        stateRef.current.gold -= cost;
        setGold(stateRef.current.gold);
        stateRef.current.upgrades.maxHealth += 25;
        stateRef.current.health = Math.min(stateRef.current.upgrades.maxHealth, stateRef.current.health + 25);
        setHealth(stateRef.current.health);
        stateRef.current.purchasesThisWave++;
        stateRef.current.purchasedTypesThisWave.push(type);
        return;
    }

    stateRef.current.gold -= cost;
    setGold(stateRef.current.gold);
    stateRef.current.upgrades = {
      ...stateRef.current.upgrades,
      [type]: stateRef.current.upgrades[type as keyof Upgrades] * (type === 'fireRate' ? 1.1 : 1.2)
    };
    stateRef.current.purchasesThisWave++;
    stateRef.current.purchasedTypesThisWave.push(type);
  };

  const startNextWave = () => {
    setGameState('playing');
    stateRef.current.gameState = 'playing';
    // Repopulate barrels if needed
    if (stateRef.current.environmentals.length < 3) {
        stateRef.current.environmentals = [...stateRef.current.environmentals, ...generateEnvironment().slice(0, 3)];
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    handleResize();

    // Start loop
    requestRef.current = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-dust-950 flex flex-col items-center justify-center overflow-hidden font-serif">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full cursor-none"
      />

      {/* HUD */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-dust-900/80 p-4 western-border rounded-lg flex gap-8 items-center">
              <div className="flex items-center gap-2">
                <Heart className="text-red-500 w-6 h-6 fill-red-500" />
                <div className="w-48 h-4 bg-dust-800 rounded-full overflow-hidden border border-dust-700">
                  <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: `${(health / stateRef.current.upgrades.maxHealth) * 100}%` }}
                    className="h-full bg-red-600"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="text-sheriff w-6 h-6" />
                <span className="text-2xl font-western text-sheriff">{score}</span>
              </div>
              <div className="flex items-center gap-2 bg-yellow-900/50 px-3 py-1 rounded-full border border-yellow-700">
                <span className="text-sheriff font-western text-xl">${gold}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="bg-dust-900/80 p-4 western-border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-blue-400 w-6 h-6" />
                    <span className="text-xl font-western uppercase tracking-wider">WAVE {level}</span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-dust-700 pl-4">
                    <Bomb className="text-orange-600 w-6 h-6" />
                    <span className="text-xl font-western text-orange-200">{stateRef.current.upgrades.dynamiteCount}</span>
                  </div>
                  {stateRef.current.combo > 1 && (
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={stateRef.current.combo}
                      className="flex items-center gap-1 border-l border-dust-700 pl-4"
                    >
                      <span className="text-sm font-serif text-dust-400 uppercase italic">Combo</span>
                      <span className="text-2xl font-western text-sheriff">x{stateRef.current.combo}</span>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="bg-dust-900/80 p-4 western-border rounded-lg">
                 <div className="flex items-center gap-2">
                  <Timer className="text-orange-400 w-6 h-6" />
                   <div className="w-32 h-2 bg-dust-800 rounded-full overflow-hidden border border-dust-700">
                      <div 
                        style={{ width: `${stateRef.current.deadeye}%` }}
                        className="h-full bg-orange-500"
                      />
                    </div>
                </div>
                <div className="text-[10px] text-center text-orange-200 mt-1 uppercase tracking-tighter">[SPACE] FOR DEADEYE</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-dust-400 text-sm italic">
            <span>"The sun sets low on the frontier..."</span>
            <div className="flex gap-4">
               <div className="flex items-center gap-1"><Bomb size={14}/> Shoot barrels for AOE</div>
               <div className="flex items-center gap-1"><Timer size={14}/> Space for slow motion</div>
            </div>
          </div>
        </div>
      )}

      {/* Menus */}
      <AnimatePresence>
        {gameState === 'shop' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-dust-950/90 backdrop-blur-md"
          >
            <div className="paper-texture p-12 western-border rounded-2xl text-center max-w-2xl shadow-2xl">
              <div className="flex items-center justify-center gap-4 mb-6">
                <ShoppingCart className="text-wood-raw w-10 h-10" />
                <h2 className="text-6xl font-western text-dust-950">GENERAL STORE</h2>
              </div>
              
              <p className="mb-2 text-dust-600 font-serif italic pb-2">"Supplies for the weary traveler. Max 2 items per visit."</p>
              {stateRef.current.purchasesThisWave >= 2 && (
                <p className="text-sheriff font-western mb-4 text-lg">Limit reached for this wave!</p>
              )}
              <div className="border-b border-dust-400 mb-6" />

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-12 max-h-[50vh] overflow-y-auto pr-4">
                {[
                  { name: 'Double Tap', desc: 'Increase Fire Rate', type: 'fireRate', cost: 100, icon: <Zap size={24}/> },
                  { name: 'Hollow Points', desc: 'Increase Damage', type: 'damage', cost: 150, icon: <Crosshair size={24}/> },
                  { name: 'Shotgun', desc: 'Powerful 3-shot spread', type: 'weapon_shotgun', cost: 500, icon: <div className="font-western text-xl text-center">SG</div>, hideIfOwned: true },
                  { name: 'Dynamite Refill', desc: '+3 Dynamite Sticks', type: 'dynamite', cost: 80, icon: <Bomb size={24}/> },
                  { name: 'Reinforced Vest', desc: 'One-time Health Boost', type: 'maxHealth', cost: 200, icon: <Shield size={24}/>, hideIfOwned: stateRef.current.maxHealthBought },
                  { name: 'Cool Head', desc: 'Deadeye Duration', type: 'deadeyeDuration', cost: 120, icon: <Timer size={24}/> },
                ].filter(item => !(item.hideIfOwned && (stateRef.current.upgrades.weaponType === 'shotgun' || item.type === 'maxHealth'))).map((item) => {
                  const isLimitReached = stateRef.current.purchasesThisWave >= 2;
                  const isAlreadyBought = stateRef.current.purchasedTypesThisWave.includes(item.type);
                  const canAfford = gold >= item.cost;
                  const isDisabled = isLimitReached || !canAfford || isAlreadyBought;

                  return (
                  <button
                    key={item.name}
                    disabled={isDisabled}
                    onClick={() => {
                        if (stateRef.current.gold < item.cost || stateRef.current.purchasesThisWave >= 2 || stateRef.current.purchasedTypesThisWave.includes(item.type)) return;
                        
                        if (item.type === 'weapon_shotgun') {
                            stateRef.current.gold -= item.cost;
                            setGold(stateRef.current.gold);
                            stateRef.current.upgrades.weaponType = 'shotgun';
                            stateRef.current.purchasesThisWave++;
                            stateRef.current.purchasedTypesThisWave.push(item.type);
                        } else if (item.type === 'dynamite') {
                            stateRef.current.gold -= item.cost;
                            setGold(stateRef.current.gold);
                            stateRef.current.upgrades.dynamiteCount += 3;
                            stateRef.current.purchasesThisWave++;
                            stateRef.current.purchasedTypesThisWave.push(item.type);
                        } else {
                            buyUpgrade(item.type, item.cost);
                        }
                    }}
                    className={`flex flex-col items-center p-6 border-2 rounded-xl transition-all ${!isDisabled ? 'border-wood-raw hover:bg-wood-raw/10 cursor-pointer' : 'border-dust-300 opacity-50 grayscale'}`}
                  >
                    <div className="mb-2 text-wood-raw">{item.icon}</div>
                    <span className="font-western text-xl text-dust-900">{item.name}</span>
                    <span className="text-sm font-serif text-dust-600">{item.desc}</span>
                    <span className="mt-4 font-western text-sheriff text-lg">${item.cost}</span>
                  </button>
                )})}
              </div>

              <div className="flex items-center justify-between border-t border-dust-400 pt-8">
                 <div className="flex items-center gap-2">
                    <span className="text-dust-600 font-serif">Current Funds:</span>
                    <span className="text-3xl font-western text-sheriff">${gold}</span>
                 </div>
                 <button
                    onClick={startNextWave}
                    className="bg-wood-raw hover:bg-wood-dark text-dust-100 px-12 py-4 rounded-lg font-western text-2xl transition-all hover:scale-105 shadow-lg flex items-center gap-3"
                  >
                    NEXT WAVE <Crosshair />
                  </button>
              </div>
            </div>
          </motion.div>
        )}
        {gameState === 'menu' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black"
          >
            <div className="delos-circle animate-[pulse_10s_infinite]" />
            <div className="delos-circle w-[800px] h-[800px] opacity-20" />
            
            <div className="relative p-12 text-center max-w-3xl bg-black/40 backdrop-blur-sm border border-white/5 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center">
              {/* Man in Black Silhouette */}
              <div className="absolute -bottom-10 -right-32 opacity-20 pointer-events-none hidden xl:block">
                <svg width="400" height="600" viewBox="0 0 100 150" fill="currentColor" className="text-white">
                  {/* More detailed Man in Black silhouette */}
                  <path d="M50 15 C42 15 38 18 38 22 L38 26 L25 26 C20 26 15 30 15 35 C15 38 20 41 25 41 L75 41 C80 41 85 38 85 35 C85 30 80 26 75 26 L62 26 L62 22 C62 18 58 15 50 15 Z" /> {/* Hat */}
                  <path d="M40 42 L60 42 C65 42 68 45 68 50 L75 95 L25 95 L32 50 C32 45 35 42 40 42 Z" /> {/* Duster Coat Body */}
                  <path d="M30 95 L20 145 L45 145 L45 95 Z M55 95 L55 145 L80 145 L70 95 Z" /> {/* Legs */}
                  <path d="M28 48 L10 85 L18 92 L32 55 Z M72 48 L90 85 L82 92 L68 55 Z" /> {/* Arms */}
                </svg>
              </div>

              <div className="mb-2 text-white/40 tracking-[0.5em] text-xs font-clean uppercase w-full">Delos Incorporated Presents</div>
              <h1 className="text-9xl font-clean font-extralight mb-8 tracking-[0.2em] text-white brightness-125 -mr-[0.2em] text-center">
                WESTWORLD
              </h1>
              
              <div className="w-24 h-px bg-white/20 mx-auto mb-8" />
              
              <p className="mb-10 text-white/60 font-clean text-lg tracking-widest uppercase leading-relaxed max-w-md mx-auto">
                These violent delights have violent ends.
              </p>
              
              <div className="grid grid-cols-3 gap-6 mb-12 text-center text-[10px] tracking-widest uppercase font-clean text-white/40">
                <div className="flex flex-col items-center gap-2 border border-white/5 p-4 rounded-xl hover:bg-white/5 transition-colors">
                  <Crosshair size={18} className="mb-1 opacity-50" />
                  <span>Aim / Move</span>
                </div>
                <div className="flex flex-col items-center gap-2 border border-white/5 p-4 rounded-xl hover:bg-white/5 transition-colors">
                  <Zap size={18} className="mb-1 opacity-50" />
                  <span>Left Click: Fire</span>
                </div>
                <div className="flex flex-col items-center gap-2 border border-white/5 p-4 rounded-xl hover:bg-white/5 transition-colors">
                  <Bomb size={18} className="mb-1 opacity-50" />
                  <span>Right Click: Dynamite</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full relative group py-6 transition-all"
              >
                <div className="absolute inset-0 border border-white/20 group-hover:border-white/50 transition-colors rounded-full" />
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 group-active:bg-white/10 transition-all rounded-full" />
                <span className="relative z-10 flex items-center gap-4 justify-center text-white tracking-[0.4em] font-clean font-light text-xl">
                  INITIALIZE SESSION
                </span>
              </button>
              
              <div className="mt-8 text-[10px] text-white/20 tracking-widest uppercase">
                System Status: Alpha Branch 2.4.0 // All Hosts Active
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'gameover' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <div className="relative p-16 text-center shadow-[0_0_100px_rgba(255,0,0,0.1)] border border-red-900/30 rounded-3xl max-w-xl bg-black/60">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600/10 border border-red-500/50 text-red-500 px-6 py-1 rounded-full text-[10px] tracking-[0.3em] font-clean uppercase">
                Critical System Failure
              </div>
              
              <h2 className="text-7xl font-clean font-extralight text-white mb-4 tracking-tighter">HOST TERMINATED</h2>
              <p className="text-white/40 font-clean italic mb-8 tracking-widest text-sm uppercase">Recalibration required for next loop.</p>
              
              <div className="flex justify-center gap-16 my-10 border-y border-white/5 py-10">
                <div className="text-center">
                  <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-2 font-clean">Engagement Metrics</p>
                  <p className="text-5xl font-clean font-light text-white">{score}</p>
                  <p className="text-white/20 text-[10px] mt-1 uppercase tracking-widest">Kills Confirmed</p>
                </div>
                <div className="text-center">
                  <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-2 font-clean">Narrative Depth</p>
                  <p className="text-5xl font-clean font-light text-white">{level}</p>
                  <p className="text-white/20 text-[10px] mt-1 uppercase tracking-widest">Wave Reached</p>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={startGame}
                  className="w-full relative group py-4 transition-all"
                >
                  <div className="absolute inset-0 border border-white/10 group-hover:border-white/30 rounded-lg transition-colors" />
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 rounded-lg transition-all" />
                  <span className="relative z-10 font-clean font-light text-white tracking-[0.3em] text-lg uppercase">
                    RESET LOOP
                  </span>
                </button>
                
                <button
                  onClick={() => setGameState('menu')}
                  className="w-full font-clean text-[10px] text-white/30 hover:text-white/60 tracking-[0.4em] uppercase transition-colors"
                >
                  Terminate Interface
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
