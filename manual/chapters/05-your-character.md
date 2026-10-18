# Your Character {#ch-5}

![Choosing your path in the world.](images/professions.webp)

## 5-1. Who You Are & How We Play {#sec-5-1}

Welcome to The Fractured Century. Before you load your character sheet or roll your first die, it is vital to understand who you play, the world you inhabit, and how we build this story together at the table.

### Who You Are

In this universe, you are not a superhero, a chosen one, or a high-tech demigod. You play an **Operator** — a survivor living on the frayed edges of a corporate-dominated wasteland. You are somebody who fell through the cracks of the Credit Score system, carrying real debts, personal trauma, and a burning drive to keep your head above water. You move through the unmonitored Grey Zones where corporate cameras fail, trading raw scrap, copper wire, and physical favors just to buy another day of clean air and drinking water. You survive because you are sharp, adaptable, and willing to take the jobs no official channel will touch.

### What to Expect from the World

This is a grounded, atmospheric setting driven by scarcity, bureaucracy, and quiet desperation. Technology here is not a ladder to ascension; it is the cage constructed to keep populations compliant. Expect unskippable AR ad feeds, degraded bandwidth, cold industrial rain, and an ambient electromagnetic decay that rattles your teeth. Success in this world is rarely about wiping out an army — it is about securing a safe haven, paying off a soul-crushing debt anchor, and living to see tomorrow with your humanity intact.

### Your Role at the Table

- **Immerse & Roleplay:** Step into your character's boots. React to the world through their eyes, their flaws, and their desperate motivations — not just as numbers on a sheet.
- **Contribute to the Narrative:** The Game Master (GM) provides the world and the conflicts, but you drive the story. Your choices, mistakes, and tactical ingenuity shape the outcome of every mission.
- **Dialogue with the GM:** Treat the GM as your narrator and world-engine, not an opponent. Ask questions about your surroundings, describe your intent clearly, and seek creative solutions to brutal problems.
- **Embrace Failure:** In a bleak, high-stakes system, failures and unexpected twists make the story rich. A bad roll is not a dead end — it is a sudden, dramatic shift in the narrative.
- **Cooperate to Survive:** The grid is hostile enough on its own. Your squad is your only true lifeline. Trust your team, play to your strengths, and keep each other alive.

> **Unwritten rule:** the goal of the game is to immerse in a universe and have fun playing. Rules can be bent, rewards can be given, results can be awarded outside cold tables and dice rolls. Roleplaying and contribution can lead to unexpected results.

> **Second unwritten rule:** the GM is there to facilitate and guide you through the story. There are reasons behind the decisions — but the GM is also a human being. They can be wrong. If something feels unfair, say it.

## 5-2. Using the App {#sec-5-2}

The app is a smart paper sheet: it does the maths, keeps the rules one tap away and never asks you to flip through tables. It is not the game — keep your head up and talk to your squad.

- **Builder** — creates a character in about five minutes. Every step explains itself; rolls print in a terminal log; choices you need to make appear inline. An *Advanced mode* lets experienced players type values directly or pick specific events (marked `[MANUAL]` for the GM).
- **Character sheet** — your live sheet during play: HP, body, weapons, class engine, skills, gear, notes. Everything recalculates the moment something changes.
- **Manual** — this book. Any ⓘ on the sheet or in the builder opens a short explanation with a link to the full rule here.
- **Language** — the EN / IT switch at the top changes the app and this manual. Game terms stay in English, so you and the GM use the same words.

### Saving your character

- Characters are **saved automatically** in the browser you use. Use the same device and browser each session.
- **Export** downloads a backup file. Do it after each session, and whenever the GM asks for your current sheet.
- **Import** loads a backup on any device. Files from the old v0.8 pages (`char_init_*.json`, `Save_*.JSON`) are converted automatically.

### Playing at the table

The GM can run the app from a laptop on the table's Wi-Fi: every tablet opens the same address and works even without internet. Opening the files directly by double-click does not work — the app must be served from a computer (ask your GM).

## 5-3. Attributes & Checks {#sec-5-3}

Your Operator's physical, mental, and social capabilities are defined by eight Core Attributes. These drive every roll, skill check, and combat action you perform on the grid.

::table[attributes]

### Bonuses and skill checks {#sec-5-3-skills}

You rarely roll against raw attributes. Every attribute has a **bonus equal to half its value, rounded down**. Every skill combines the bonuses of two attributes, and that sum is the skill's **Target Number (TN)**.

**Roll a d20: if the result is equal to or lower than the TN, you succeed.** The GM may make it harder by applying a difficulty penalty (see *Skill Checks & Difficulty*, 6-2).

> **Example:** Thrown Objects uses DEX + INT. DEX 10 (bonus +5) and INT 12 (bonus +6) give TN 11: roll 11 or less on a d20.

Because every attribute feeds several skills, neglecting one leaves blind spots across the whole tree. The sheet calculates all skills live — tap any skill to roll it.

::table[skills]

### Derived combat values {#sec-5-3-combat}

Six tactical values come from the **raw sum of two attributes**, looked up in the table below. Some life events shift you one row up or down for a specific value (for example *Long Legs* moves your movement one row down the table, which is better).

::table[combat]

- **Initiative** = half DEX + half WIS (rounded down each) − 10. Roll d20 + Initiative at the start of combat.
- **Max HP** = 2 × CON + MST.

### Body locations {#sec-5-3-body}

Your body has seven locations. Each has its own HP, based on CON + MST, and its own armor marks from what you wear. Head, chest and abdomen are **vital**.

::table[body-points]

### Building your Operator {#sec-5-3-buy}

At creation every attribute starts at **6** and you have **20 points** to spend. No attribute may go above **14** at this stage (life events and careers can push it higher later). Credit Score starts at **20**: you can lower it to gain points, but you can never raise it above 20 during creation.

- **Avoid min-maxing.** A 6 CON operator collapses under minimal damage; a 6 WIS operator is constantly blindsided. Balanced builds survive longer.
- **Not sure?** Take the playstyle quiz in the builder. It suggests a class and a ready-made attribute spread.

## 5-4. Youth: Adolescence Events {#sec-5-4}

Before your Operator walked the streets as an adult, their early life was shaped by the grid. **Three events, each rolled on 2d20**, define what happened to you up to age 15. Middle results are common; the extremes (2 and 40) are rare.

Events can change attributes, shift a combat value one row, alter body points, give or clear a criminal record, grant an education credential or waive future career requirements. When an event asks for a choice (for example *+2 to INT or WIS*), the builder asks you directly.

> Results that ruin your concept? Ask the GM — they can authorise a re-roll.

::table[adolescence]

## 5-5. Career & Debt {#sec-5-5}

After 15 you can go straight to the streets, or serve one or more **career terms** first. Careers are optional.

- **Each term:** +2 years of age, the career's attribute and Credit Score changes, **two career events** (2d20), then an aging check.
- **Requirements:** minimum attributes, maximum age, education credentials, a clean record or a minimum Credit Score. The builder marks each one ✓ or ✗. Some life events waive requirements.
- **Push your luck:** every extra term is more experience, more risk, and more age. Some events end your career phase on the spot.

::table[careers]

### Career events {#sec-5-5-events}

::table[career-events]

### Aging {#sec-5-5-aging}

From 27 onwards, each term applies the aging modifiers of your current age bracket. Some brackets cap attributes. From 45, the GM asks for a death check.

::table[aging]

### The Debt: your motivator {#sec-5-5-debt}

No Operator goes underground for prestige — you go because you owe. Your **special debt** is the narrative anchor that drives you into dangerous work. Roll it in the builder, or pick one with the GM; all debts are balanced to be equally hard.

::table[debts]

## 5-6. Classes {#sec-5-6}

Classes represent your Operator's operational doctrine: how raw attributes become tactical action. Each class is a distinct **engine** with its own resource loop and risk/reward rhythm. Your **subclass** sets your two main attributes — their average is your **Class TN** — and which abilities you can equip.

::table[classes]

### Equipping abilities (brain fog) {#sec-5-6-equip}

You know every ability of your subclass, but combat stress limits how many you can keep at hand: you **equip up to 3** (the GM may raise the limit as you gain experience). Swap freely between combats. An equipped ability is **ready** only when your engine allows it — the sheet shows ready abilities in green and tells you what is missing for the others.

### The Soldier {#sec-5-6-soldier}

The Soldier is the team's front-line powerhouse, built on **Stance-Flow**: momentum is banked as **Tactical Points (TP)** and spent on finishers that move you between stances.

- **Defensive:** ×0.5 damage dealt and taken. Hold ground or recover.
- **Attack:** the baseline — normal damage dealt and taken.
- **Onslaught:** ×1.5 damage dealt and taken. High risk, high reward.

**TP** start at **0 every combat** and have no cap. You build them by fighting: **every normal attack that hits gives +1 TP**, *Brace & Dig In* gives +2 and *Steady Aim* +1. Finishers cost 1–3 TP and shift your stance. The sheet applies your stance to every damage roll.

- **Grunt (STR / CON):** builds in Defensive, pushes into Attack, then charges into Onslaught and stays there — *Fix Bayonets*, *Bunker Buster*, *Reckless Execution*.
- **Officer (DEX / INT):** lives between Defensive and Attack and turns TP into the team's actions and accuracy — *Commanding Directive*, *Coordinated Crossfire*, *Tactical Redeployment*.

::table[abilities:soldier]

### The Hacker {#sec-5-6-hacker}

The Hacker fights through information warfare, balancing **RAM** against **Heat**. Both limits come from the **deck** you carry — better decks and hardware mods mean more RAM and a higher heat cap.

- **Instant hacks** need free RAM while they run and add heat.
- **Sustained hacks** keep their RAM locked until you release them: tap ✕ on one in the deck panel, or use *Release Payload* to end them all.
- **Heat** builds with every hack and drops by 1 at the end of each round. If it reaches the deck's cap, the deck **Blue Screens**: locked for the next round, then it reboots at cap − 3. *Thermal Dump* vents 3 heat; *System Hard Reboot* clears everything but keeps the deck offline for the rest of this round and the next.
- **Range:** a device in sight, or within 10 squares on a network you have pinged.
- **What you can touch:** enemies are **organic**, **cybernetic** or **synthetic**. Most hacks only work on cybernetic or synthetic targets; organic ones are reached through the gear around them (doors, turrets, comms). The GM tells you which is which.
- *Thermal Dump*, *Release Payload* and *System Hard Reboot* need no roll; they still take an action.

- **Scammer (INT / CHA):** social engineering, credential spoofing, distraction and cheap sustained debuffs.
- **Master (INT / WIS):** heavy system destruction, network control and high-heat anti-tech payloads.

::table[abilities:hacker]

### The Tech Wizard {#sec-5-6-techwiz}

The Tech Wizard is a battlefield architect and field medic who tunes a rig to the infrastructure around them — power lines, scrap, wiring. Their engine is **Field Sync**: the longer they hold one purpose, the deeper the sync.

- **Two modes.** **Mend** (support: repair armor marks, heal, raise cover, buff) or **Surge** (offense: strip armor marks, shock, traps, turrets). Every ability has a Mend face and a Surge face; your mode picks which one fires.
- **Sync 0–3:** *Cold → Warm → Tuned → Resonant*. +1 each time you use an ability, and +1 at the end of a round in which you did not switch mode.
- **Switching** mode is free at the start of your turn, but Sync drops to 0.
- **Thresholds:** stronger abilities need a minimum Sync.
- **Resonant cast:** at Sync 3 you may fire an ability with **both faces at once** — the cover shelters your friend *and* the shrapnel hits the enemy. Sync then drops to 0 (you keep your mode).
- **Brownout:** the heaviest moves (*Structural Collapse*) drop Sync to 0 and take the rig offline — no abilities — until the end of the next round.
- **Disruption:** taking damage to a body location costs 1 Sync. Keep your Tech Wizard behind cover.
- Every combat starts at Cold.

- **Mechanic (CON / WIS):** leans Mend — fortifications, armor repair, healing.
- **Engineer (DEX / WIS):** leans Surge — gadgets that keep working: the shock conduit and the sentry turret act at round end without spending Sync.

::table[abilities:techwiz]

### The Smuggler {#sec-5-6-smuggler}

The Smuggler is a high-speed opportunist riding the **Adrenaline Pendulum**, a spectrum from **Cold Calculation (−4)** through **Composure (0)** to **Adrenaline Rush (+4)**. Every ability **needs** a side of the pendulum and **shifts** it when used.

- **Cold (−4 to −1):** steady hands — **+2 TN on gun attacks**. Unlocks the planning moves: *Contraband Stash*, *Safehouse Route*, *Decoy Deployment*, *Black-Market Ammo*, *Call in Favor*.
- **Composure (0):** no bonus; only the abilities that need nothing (*Street Snap-Shot*, *Bribe / Distraction*).
- **Hot (+1 to +4):** blood up — **+1 damage on every damage roll and +1 square per move**. Unlocks the reckless moves: *Pistol Whip & Rob*, *Adrenaline Rush*, *Desperate Gamble*.
- **Elasticity:** most Cold moves heat you up, most Hot moves cool you down. *Desperate Gamble* goes all-in and crashes you to −3.
- **Pain:** a wounded Smuggler drifts +1 toward Adrenaline at the end of each round.

The sheet applies the zone bonuses for you: the Attack TN of your guns, your damage rolls and the squares on the Move button.

- **Dealer (DEX / CHA):** agile gunman and trickster — quick-draw strikes, black-market ammo, close-range robbery.
- **Trafficker (WIS / CHA):** tactical mastermind and off-grid navigator — map control, decoys, underground favors.

::table[abilities:smuggler]

## 5-7. Story & Portrait {#sec-5-7}

The builder's last steps turn your rolls into a story. It compiles two prompts from everything you rolled:

- **Backstory prompt** — paste it into any AI assistant (or use it as a writing guide) and paste the result back. It already contains the setting, your events, career and debt. With the app in Italian, it asks the AI to write the story in Italian.
- **Portrait prompt** — for an image generator. Add your own look: gender, hair, eyes, build, clothing, marks.

Upload the portrait on the sheet (Dossier tab); it is shrunk automatically so saves stay small.

## 5-8. The Character Sheet {#sec-5-8}

- **Status bar** — always visible: HP, armor, initiative, actions, Class TN, Credit Score, cash and active conditions.
- **Play** — weapons (attack TN, damage, ammo, reload), your class engine and equipped abilities, body locations and cover, combat values, conditions, and the Turn panel (*Start combat*, *End round*).
- **Skills** — attributes (adjustable for injuries, aging or GM rulings) and every skill. Tap to roll with the GM's difficulty.
- **Gear** — cash, inventory, the market, and your lifestyle.
- **Dossier** — identity, class, background, debt, portrait and backstory.
- **Notes** — your field notes and a log of rolls, purchases and ability uses.
