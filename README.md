# Westworld

**Westworld** is a browser-based 2D top-down action and survival game developed as a Computer Graphics Final Project for Spring 2026.

The game is built with **HTML5 Canvas**, **React**, **TypeScript**, and **Tailwind CSS**. It includes real-time animation, mouse interaction, collision detection, an upgrade system, combo mechanics, wave progression, and visual effects.

### Live Demo
[(https://huseyinfidan.github.io/westworld)]

### Repository
[https://github.com/huseyinfidan/westworld](https://github.com/huseyinfidan/westworld)

---

## Project Overview

Westworld is a fully playable arcade-style survival game where the player defends a frontier town against endless waves of bandits. The player controls a crosshair to aim, shoots enemies, throws dynamite, utilizes explosive barrels, and collects gold to buy upgrades from the store to survive as long as possible.

**The game includes:**
* Start screen
* Active gameplay
* Game over screen
* Shop and Upgrade system
* Scoring and Gold system
* Combo system
* Wave progression
* Increasing difficulty
* Multiple enemy types
* Visual effects

---

## Enemy Types

| Target | Effect |
| :--- | :--- |
| **Normal Bandit** | Approaches the player at standard speed and health. |
| **Fast Bandit** | Moves much faster and is harder to hit, but has lower health. |
| **Tough Bandit** | Moves slowly but has three times the health of a normal bandit. |
| **Shooter Bandit** | Stops at a certain distance and shoots projectiles directly at the player. |
| **Boss** | Spawns every 5 waves. Features a massive size and very high health. |
| **Explosive Barrel** | *(Environment Object)* Explodes when shot, dealing massive area-of-effect damage to nearby enemies. |

---

## Game Rules

* Killing enemies in quick succession increases the **Combo** multiplier, yielding more gold. The combo lasts for 2 seconds; if no enemy is killed in this time, the combo resets.
* The "General Store" screen appears after each wave is completed.
* Players can spend collected gold to upgrade Fire Rate, Damage, Max Health, or purchase a Shotgun.
* Players can right-click to throw a limited amount of dynamite for massive explosions.
* Enemy spawn rate, movement speed, and overall difficulty increase in later waves.
* The game ends when the player's health drops to zero (Host Terminated).

---

## Controls

| Control | Action |
| :--- | :--- |
| **Mouse Move** | Aim |
| **Left Mouse Click** | Shoot |
| **Right Mouse Click** | Throw Dynamite |
| **Space** | Activate/Deactivate Deadeye (Slow-motion) mode |

---

## Computer Graphics Concepts

This project demonstrates several computer graphics concepts:

* Procedural 2D drawing with **HTML5 Canvas rendering**
* Real-time animation loop using `requestAnimationFrame()`
* **2D transformations such as `translate()`, `rotate()`, and `scale()`** (e.g., rotating the character's arm towards the mouse, camera shake effects)
* Trigonometry-based (`Math.atan2`) **Mouse-based interaction**
* Euclidean distance-based **Collision detection**
* Custom engine for blood and explosion **Particle effects**
* Atmospheric backgrounds, damage flashes, and shadows using **Gradients, shadows, and glow effects**
* High-performance **Game state management** using React's `useRef` hook
