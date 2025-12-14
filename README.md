```markdown
# 🪐 Space War

**Space War** is a browser-based, multiplayer, turn-based grand strategy game inspired by *Axis & Allies*, set in space.

Players expand across a connected galaxy, build factories, produce fleets, fight decisive battles, and compete for total industrial control.

> This project is early-stage but fully playable. Core rules, turn flow, combat, and victory conditions are implemented.

---

## 🎮 Gameplay Overview

- **Turn-based**
- **2–6 players**
- **Server-authoritative**
- **Phased turns**
- **Factory-based production**
- **Mandatory combat resolution**

The game emphasizes strategic planning, logistics, and decisive battles rather than real-time reflexes.

---

## 🧠 Core Concepts

### Star Systems (Territories)

Each system has:
- Owner (or neutral)
- Resource value (income)
- Connections to neighboring systems
- Optional factory (shipyard)

Control of systems determines:
- Income
- Production capability
- Victory conditions

---

### Factories (Shipyards)

- Units can **only be produced at factories**
- Factories may be:
  - Pre-placed on the map
  - Built by players (cost: **15 resources**)
- Factories are the **key strategic objective**

---

### Units

| Unit | Cost | Attack | Defense | Movement |
|----|----|----|----|----|
| Fighter | 6 | 3 | 3 | 2 |
| Destroyer | 8 | 3 | 4 | 2 |
| Cruiser | 12 | 4 | 4 | 2 |
| Battleship | 18 | 4 | 5 | 1 |
| Carrier | 14 | 2 | 4 | 1 |
| Transport | 7 | 1 | 1 | 2 |

- Units belong to fleets
- Each unit has limited movement per turn
- Partial fleet movement is supported

---

## 🔄 Turn Structure

Each player’s turn follows a strict phase order:

1. **Income (Automatic)**
   - Gain resources from all owned systems

2. **Purchase Phase**
   - Buy ships at owned factories
   - Build new factories
   - Purchased units are queued

3. **Movement Phase**
   - Move fleets between connected systems
   - Units are limited by movement points
   - Choose exactly which ships move

4. **Combat Phase**
   - All contested systems must be resolved
   - Combat cannot be skipped

5. **Deploy Phase**
   - Purchased units are placed at factories
   - Turn ends → next player begins

The server enforces all phase rules.

---

## ⚔️ Combat

- Occurs when multiple players have ships in a system
- Dice-based resolution:
  - Each unit rolls 1d6
  - Hit if roll ≤ attack value
- Combat repeats until one side remains
- Winner controls the system

All combat must be resolved before advancing the turn.

---

## 🏆 Victory Conditions

The game ends immediately when **either** condition is met:

1. **Factory Domination**
   - One player controls **all factories** on the map

2. **Last Player Standing**
   - All other players are eliminated

### Player Elimination

A player is eliminated if they have:
- No owned systems  
**OR**
- No factories and no ships

---

## 🌐 Multiplayer Architecture

- Real-time updates via **Socket.IO**
- Server-authoritative game state
- Clients are stateless views
- Designed for LAN or self-hosted play

---

## 🛠 Tech Stack

### Frontend
- React
- TypeScript
- Vite

### Backend
- Node.js
- Express
- Socket.IO

### Shared
- TypeScript shared types
- Single monorepo using `pnpm`

---

## 📁 Project Structure

```

space-war/
├── client/        # React frontend
├── server/        # Node + Socket.IO backend
├── shared/        # Shared game types/constants
├── pnpm-workspace.yaml
└── README.md

````

---

## 🚀 Running Locally

### Requirements
- Node.js 18+
- pnpm

### Install
```bash
pnpm install
````

### Start Server

```bash
pnpm --filter server dev
```

### Start Client

```bash
pnpm --filter client dev
```

Open your browser at:

```
http://localhost:3000
```

---

## 🧪 Current Status

✔ Core gameplay loop complete
✔ Turn phases enforced
✔ Combat & movement rules
✔ Factory-based production
✔ Victory & elimination logic

This is a **playable foundation**, not a finished game.

---

## 🧭 Planned Features

* Larger maps / map editor
* Capital systems
* Victory points mode
* Alliances / teams
* Save & load games
* Spectator mode
* Improved UI for unit movement

---

## 📜 License

MIT (or TBD)

---

## 🤝 Contributing

This project is in active development.
Issues, ideas, and pull requests are welcome.

If you enjoy classic turn-based strategy and want to help build a modern browser version — jump in.

````

---

### ✅ Next Steps

1. Save this as `README.md` in the repo root
2. Commit and push:
   ```bash
   git add README.md
   git commit -m "Add project README"
   git push
````

