# 🎵 AURA — Master Build Plan
> **Read this entire document before writing a single line of code.**
> This document is the single source of truth for building Aura — a private music streaming app for personal use and a small friend group. Every decision, screen, model, API call, and component is defined here.

---

## Table of Contents
1. [Project Identity](#1-project-identity)
2. [Design System](#2-design-system)
3. [Tech Stack](#3-tech-stack)
4. [Version Control Strategy](#4-version-control-strategy)
5. [Project File Structure](#5-project-file-structure)
6. [Environment Variables](#6-environment-variables)
7. [Database Schema (Supabase)](#7-database-schema-supabase)
8. [API Integrations](#8-api-integrations)
9. [State Management](#9-state-management)
10. [Screen-by-Screen Breakdown](#10-screen-by-screen-breakdown)
11. [Audio Player Architecture](#11-audio-player-architecture)
12. [Social & Realtime Features](#12-social--realtime-features)
13. [Navigation Structure](#13-navigation-structure)
14. [Component Library](#14-component-library)
15. [Build Order (Phases)](#15-build-order-phases)
16. [Error Handling Patterns](#16-error-handling-patterns)
17. [Testing Checklist]

---

## 1. Project Identity

| Field        | Value                                                  |
|--------------|--------------------------------------------------------|
| App Name     | **Aura**                                               |
| Platform     | React Native (iOS + Android via Expo)                  |
| Purpose      | Private music streaming for personal use + friends     |
| Users        | Small group (~5–15 people max), invite only            |
| Primary Color| Purple (`#7C3AED` — Violet 600)                        |
| Mood         | Premium, dark, immersive — Apple Music × glassmorphism |

---

## 2. Design System

### 2.1 Color Palette

```
Background Primary:     #0A0A0F   (near-black, slightly purple-tinted)
Background Secondary:   #13111C   (card surfaces)
Background Elevated:    #1C1830   (modals, sheets)
Purple Primary:         #7C3AED   (Violet-600, main CTA color)
Purple Light:           #A78BFA   (Violet-400, accents, icons)
Purple Dark:            #5B21B6   (Violet-800, pressed states)
Purple Glow:            #7C3AED33 (20% opacity, glow effects)
Text Primary:           #FFFFFF
Text Secondary:         #A1A1AA   (Zinc-400)
Text Tertiary:          #52525B   (Zinc-600)
Border Subtle:          #27272A1A (Zinc-800, 10% opacity)
Danger:                 #EF4444
Success:                #22C55E
```

... (copied from root AURA_MASTER_PLAN.md)
