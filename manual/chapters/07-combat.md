# Combat {#ch-7}

## 7. The action

Combat phase

## 7-1. Initiative & Turn Structure {#sec-7-1}

At the onset of a combat engagement, all participating Operators and hostile units roll a standard d20 + Initiative Bonus to establish the battle's static action sequence. This calculated turn order remains fixed for the entirety of the fight, ensuring a predictable tactical flow without the friction of re-rolling each round. To account for sudden tactical adjustments, a player may elect to Delay their turn during a round. Declaring a Delay voluntarily shifts the Operator's action slot to the very end of the current round—after all other friendly and enemy units have acted—allowing them to react to changing battlefield conditions, wait for team setups, or coordinate late-turn pushes.

**At the live table**, your sheet shows the order with every enemy as *Hostile*, so it never tells which enemy acts when. Below it, the **Hostiles** list shows the enemies the GM has revealed, each with a letter (A, B, C…) the GM also uses out loud and on the miniatures: the name the GM gives it, organic or synthetic, a wound band (Unhurt, Hurt, Bloodied at half HP or less, Down) and visible conditions. Enemies the GM keeps hidden — an ambusher, a sniper — appear only once revealed.

## 7-2. Line of Sight, Cover & Grid Geometry {#sec-7-2}

Combat in *The Fractured Century* is tactical, spatial, and unforgiving. Position, line-of-sight, and physical cover mean the difference between surviving a skirmish and suffering a fatal structural injury. Grid movement and spatial geometry are kept intentionally intuitive so squad combat remains fast-paced.

### 1. Tactical Movement & Grid Geometry

Tactical maps use a standard square grid where **1 Square = 1.5 Meters (5 Feet)**.

- **Movement Allowance (SQR):** An Operator’s `SQR` metric (derived from Constitution + Dexterity) indicates how many grid squares they can traverse per single movement action.

- **Diagonals:** Movement across diagonal squares follows standard 1-for-1 geometry—no complex math or alternating costs required.

- **Obstacles & Terrain:** Moving through difficult terrain (knee-deep debris, flooded subway tracks, narrow crawlspaces) doubles the movement cost (2 Squares per 1 Square moved).

### 2. Line of Sight (LoS)

To declare a ranged attack, deploy a class payload, or interact with a target across the grid, an attacker must have a clear **Line of Sight (LoS)**.

- **The Center-to-Center Trace:** Draw an imaginary straight line from the center of the attacker’s grid square to the center of the target’s grid square.

- **Clear LoS:** If the line passes through completely open squares, the shot is unobstructed.

- **Blocked LoS:** If the line intersects a solid structural wall, closed heavy blast door, or opaque environmental hazard (e.g., concrete pillars, zero-visibility smoke), LoS is broken and no direct attack can be made.

- **Obstructed LoS (Cover):** If the line passes through low obstacles, furniture, structural edges, or another character's square, the target gains the benefits of **Cover**.

### 3. The Cover System (Armor Hardening)

Cover in this system does not make an Operator harder to hit by altering defense rolls; instead, it acts as physical structural shielding that absorbs kinetic and energy damage before it reaches the body. Cover adds flat protection directly to your **armor** — every hit, wherever it lands.

::table[cover]

- **Cover never cracks:** when a location attack is stopped completely, only the armor you wear cracks (see 7-5). Cover is terrain: it stays until you leave it or are flanked.

- **Flanking (Negating Cover):** If an attacker maneuvers to an angle where their center-to-center line no longer intersects the target's cover feature, the target is **Flanked** and loses all cover armor bonuses against that attack.

> Destructible Cover (Scrap Generation):

> When a piece of Partial or Full Cover absorbs a high-damage kinetic attack, it can degrade. A Tech Wizard can immediately target degraded or destroyed cover using their Scavenge & Survey or Deploy Improvised Cover abilities to gather immediate scrap materials or rebuild field barricades!

## 7-3. Action Types {#sec-7-3}

Combat in *The Fractured Century* operates on a flat, fluid action economy. The system intentionally eliminates complex action tiers—there are no "minor," "major," or "bonus" actions. Every action carries equal weight, allowing Operators to adapt their tactical response dynamically as threats escalate.

### 1. The Action Economy

- **Flat Action Currency:** Every combat declaration consumes exactly **1 Action** unless explicitly stated otherwise.

- **Max Actions per Round:** Your maximum available actions per round are strictly dictated by your Operator's `ACTIONS / RD` metric (derived from Wisdom + Dexterity, ranging from 2 to 7).

- **Action Repetition:** You may repeat the same action multiple times in a single round (e.g., using 3 actions to *Move → Move → Move*, or *Attack → Attack → Attack*) as long as you have the available action allowance.

### 2. Standard Combat Actions

During a combat round, an Operator can spend their available action allowance on any combination of the following maneuvers:

- **Move (Positioning & Cover):** Advance up to your maximum Movement Allowance (`SQR`) per action. This includes diving behind, crouching under, or entering **Partial** (+2 Armor) or **Full Cover** (+4 Armor) within your movement path.

**Standard Attack (Ranged & Melee):** Execute a direct attack without using class abilities.

- **Ranged Firearms:** Fires a single controlled shot per action using the weapon's auto-calculated **Target Number (TN)** shown on the weapon card. Multi-shot or burst fire is permitted *only* if explicitly stated on the weapon card.

- **Close Quarters & Thrown:** Melee strikes, unarmed brawling, or throwing weapons roll directly against their respective combat skills (*Melee / CQC*, *Brawling*, or *Thrown Objects*).

- **Class Abilities:** Activate a readied class ability or tactical module from your active HUD loadout (e.g., *Ping Sweep*, *Brace & Dig In*, *Contraband Stash*). Activating a class ability consumes **1 Action**, unless explicitly stated otherwise on the ability card.

- **Reload or Swap Equipment:** Spend **1 Action** to load a spare magazine into the weapon in your hand (the old one is discarded), or to swap to your other weapon slot. **Only the weapon in hand can attack**, so firing the other one means swapping first. Out of combat you pick the weapon in hand freely on the weapon card. The sheet's *Reload / swap* button shows both choices.
- **Second chances:** if a player wants to take back a move, the GM decides. From the console the GM can undo a player's last action, their round or their whole combat; their sheet goes back and every undo is logged where the GM sees it, so the table stays fair. When the GM takes back one of their own moves on the combat tracker, the table is told.

**Interact with Environment & Inventory:** Operate physical consoles, open blast doors, grab dropped gear, or exchange items with an adjacent squadmate (e.g., passing a med-kit or ammo clip).

- **Extended Interactions:** Complex items or heavy hardware may require multiple actions or rounds to operate, as explicitly detailed on their equipment card.

- **Field Healing & Stabilization:** Applying trauma patches or performing emergency first aid on a downed ally consumes 1 or more actions as dictated by the medical item.

- **Escape / Disengage:** Spend **1 Action** to safely step away from an opponent in melee range, breaking engagement without triggering an Opportunity Attack.

- **Overwatch:** Declare a designated Line of Sight (LoS) corridor and hold your aim. You automatically execute a free standard ranged shot against the first opponent who steps into or crosses that designated line during their turn.

> **GM Ad-Hoc Actions in the Heat of Battle:**

> Not every desperate firefight maneuver is written on an equipment card. Complex, high-stakes environmental tasks attempted during active combat—such as hotwiring a getaway vehicle under heavy suppressive fire, overriding a security terminal mid-breach, or rigging a crane to drop cargo on an elite unit—do not have fixed rules. The **Skill Check required** and the **number of actions or full rounds needed** to complete the task are decided on the fly by the Game Master based on the situation's severity.

### 3. Reactive & Off-Turn Actions

Combat is fluid, and Operators are not completely helpless when it is not their active turn. Certain maneuvers allow characters to spend actions outside their standard turn order:

- **Proactive Defense (Evasion):** When targeted by an incoming attack outside your turn, you may spend **1 or more actions directly from your next round's action pool** to dodge or dive for cover. Roll against your *Avoid / Reflexes (DB)* skill to mitigate or avoid the incoming damage.

- **Opportunity Attacks:** If an enemy engaged in close-quarters melee attempts to move away or disengage *without* spending an action on **Escape / Disengage**, you may immediately execute a free reaction attack against them. This attack uses your *Melee / CQC* skill value and deals standard unarmed/improvised damage equal to `1d4 + Offensive Bonus (OFF)`.

## 7-4. Classes {#sec-7-4}

In *The Fractured Century*, your choice of Class and Subclass determines your Operator’s tactical doctrine on the grid. Rather than static role archetypes, classes serve as distinct mechanical engines—each driven by a unique resource loop, stance mechanic, and risk/reward dynamic.

Your **Subclass** acts as your operational specialization. While certain foundational abilities are shared across the entire class, high-tier finishers and specialized tactical modules are strictly exclusive to specific subclasses.

### 7-4-1. The Soldier: Stance-Flow & Tactical Points (TP) {#sec-7-4-soldier}

The Soldier is a front-line combatant built around momentum and positioning. Every finisher shifts their posture and spends **Tactical Points (TP)**; plain fighting earns them back.

**Stance Types:**

- **Defensive Stance:** ×0.5 damage dealt and taken. Ideal for absorbing fire and holding choke points.

- **Attack Stance:** the operational baseline (×1).

- **Onslaught Stance:** ×1.5 damage dealt and taken. High-risk offensive burst.

- **The Resource Loop (TP):** TP start at **0 at the beginning of every combat** and have no cap. **Every normal attack that hits gives +1 TP** — a Soldier who just keeps shooting still reaches a finisher every round or two. *Brace & Dig In* gives +2, *Steady Aim* +1. Finishers cost 1–3 TP and move you between stances.

**Subclass Mechanics:**

- **The Grunt (STR / CON):** front-line brawler. Exclusive finishers: *Fix Bayonets / Charge* (Attack → Onslaught, weapon damage +1d6, target Prone), *Bunker Buster* (Onslaught → Defensive, ignores half armor) and *Reckless Execution* (stays in Onslaught, weapon damage twice; empties a magazine of at least 3 rounds).

- **The Officer (DEX / INT):** tactical commander. Exclusive orders: *Commanding Directive* (an ally acts now), *Coordinated Crossfire* (+2 TN and +1d6 for allies against a marked target) and *Tactical Redeployment* (the squad repositions safely).

> **Combat Scenario Example: The Soldier (Grunt Subclass)**

> *Round 1:* The Grunt opens with *Brace & Dig In* (+2 TP, Defensive, +2 armor), then a normal shot that hits (+1 TP): 3 TP. *Dig In & Push* (1 TP) breaks cover into **Attack** and fires: 2 TP left.

> *Round 2:* *Fix Bayonets / Charge* (2 TP) slams into an elite guard: weapon damage +1d6, ×1.5 in **Onslaught**, and the guard is Prone. Two normal attacks follow, both hit: 2 TP, ready for another finisher — but every hit the Grunt takes is ×1.5 too.

### 7-4-2. The Hacker: RAM Allocation & Thermal Strain (Heat) {#sec-7-4-hacker}

The Hacker dominates digital architecture, manipulating enemy cyberware, automated turrets, and subnets from afar. Their engine revolves around balancing cyberdeck memory capacity (**RAM**) against dangerous thermal buildup (**Heat**).

**RAM Capacity & Payload Persistence:**

- **Instant Payloads:** need free RAM while they execute, then release it (e.g., *Ping Sweep* costs 1 RAM / 1 Heat).

- **Sustained Payloads:** lock RAM for as long as the hack stays active (e.g., *Keylogger Injection* locks 1 RAM). Locked RAM is freed when you end the hack (✕ on the deck panel, or *Release Payload* for all of them) or by a *System Hard Reboot*.

- **Deck capacity:** the Hacker's **deck** sets maximum RAM and the heat cap (see *Hacker Decks & Mods*, 8-5). Hardware mods raise both.

- **Thermal Strain (Heat):** every hack generates Heat; the deck vents 1 per round. Reaching the heat cap triggers a **Blue Screen**: every sustained hack crashes (its RAM is freed), the deck is locked for the next round, then reboots at cap − 3 Heat. The *Ghost* talent keeps sustained hacks alive. Manage heat with *Thermal Dump* (−3 Heat) or an emergency *System Hard Reboot* (clears RAM and Heat; the deck is offline for the rest of this round and the next).

**Range & Targets:**

- **Range:** a device in sight, or within 10 squares on a network you have pinged (*Ping Sweep*).

- **Targets:** every enemy is **organic**, **cybernetic** (implants, smart optics) or **synthetic** (drones, turrets, robots). Most hacks only bite on cybernetic or synthetic targets; organic enemies are reached through the systems around them. The GM sees the tag on every enemy card.

- **Housekeeping:** *Thermal Dump*, *Release Payload* and *System Hard Reboot* need no roll; they still take an action. Every other hack rolls Class TN once.

**Subclass Mechanics:**

- **The Scammer (INT / CHA):** social engineering and distraction. Exclusive hacks: *Credentials Spoof* (machines ignore you and an ally, guards wave you through), *Data Loop / Strobe* (a target attacks at −4 TN) and *False Flag Broadcast* (an enemy attacks its own side).

- **The Master (INT / WIS):** heavy network destruction. Exclusive hacks: *Feedback Loop (DDoS)* (3d6 to synthetic, 2d6 to cybernetic, ignoring armor), *Overclock Pulse* (the next instant hack hits twice) and *Logic Bomb* (3d6 when the target moves, 1d6 to everyone adjacent).

> **Combat Scenario Example: The Hacker (Master Subclass)**

> *Round 1:* The Master runs *Ping Sweep* (1 RAM / 1 Heat): a hidden combat drone lights up, and the squad gets +2 TN against it until the round ends. Then *Keylogger Injection* (1 RAM locked / 2 Heat): the GM must announce the drone's next move. The drone acts, the keylogger vents 1 Heat, and the deck vents 1 more at round end. Deck: 1 RAM locked, 1 Heat.

> *Round 2:* With 3 RAM free, the Master fires *Feedback Loop (DDoS)* (3 RAM / 4 Heat): the drone is synthetic, so 3d6 straight through its armor. Heat is at 5 — the Master spends the last action on a *Thermal Dump* (no roll, −3 Heat) and ends the turn at 2.

### 7-4-3. The Tech Wizard: Field Sync {#sec-7-4-techwiz}

The Tech Wizard turns scrap, wiring and structure into shelter for the squad — or into weapons. They hold one of two modes, **Mend** (support) or **Surge** (offense), and build **Sync** (*Cold 0 → Warm 1 → Tuned 2 → Resonant 3*) the longer they hold it: +1 per ability used, +1 at the end of each round without a mode switch. Switching is free but resets Sync to 0; losing HP costs 1 Sync.

**The payoff — Resonant cast:** at Sync 3, the next ability can fire **both faces** (the barricade shelters an ally *and* blasts the enemy beside it), then Sync drops to 0.

**The price — Brownout:** *Structural Collapse* (needs Resonant) drops Sync to 0 and takes the rig offline until the end of the next round.

**Subclass Mechanics:**

- **The Mechanic (CON / WIS):** field fortification, armor repair and healing. Exclusive access to *Fortify Position* and *Healing Surge*.

- **The Engineer (DEX / WIS):** weapon overclocks, shock zones and automated hardware. Exclusive access to *Targeted Overclock*, *Rig Power Conduit* and *Deploy Sentry*; conduits and turrets keep acting at round end without spending Sync.

> **Combat Scenario Example: The Tech Wizard (Mechanic Subclass)**

> *Round 1:* In **Mend** at Cold, the Mechanic uses *Field Maintenance* on the Soldier (2 armor cracks mended, Sync → Warm), then *Scavenge & Survey* (Sync → Tuned). The round ends without a switch: **Resonant**.

> *Round 2:* An enemy flanks the Hacker. The Mechanic makes a **Resonant cast** of *Improvised Cover*: the Hacker gets Partial cover **and** the hurled scrap plate deals 2d6 to the flanker. Sync back to Cold, still in Mend.

> *Round 3:* The Smuggler is pinned and needs firepower, not healing. Switch to **Surge** (Sync 0) and start building — or hold Mend and climb back to Resonant.

### 7-4-4. The Smuggler: The Adrenaline Pendulum (-4 to +4) {#sec-7-4-smuggler}

The Smuggler is an agile opportunist who thrives on high-stakes chaos, turning injuries, close calls, and black-market favors into rapid tactical momentum. Instead of an energy pool, the Smuggler rides a zero-centred spectrum called the **Adrenaline Pendulum**, swinging between **Cold Calculation (-4)** and **Adrenaline Rush (+4)**.

**The Spectrum Mechanics:**

- **Cold Calculation (-4 to -1):** steady hands and a plan. **+2 TN on gun attacks.** Unlocks the support moves: *Contraband Stash* (≤ −1), *Safehouse Route*, *Decoy Deployment*, *Black-Market Ammo* (≤ −2) and *Call in Favor* (≤ −3, once per combat).

- **Composure (0):** the neutral point. No bonus; only *Street Snap-Shot* and *Bribe / Distraction*, which need nothing.

- **Adrenaline Rush (+1 to +4):** blood up. **+1 damage on every damage roll and +1 square per move.** Unlocks the reckless moves: *Pistol Whip & Rob* (≥ +1), *Adrenaline Rush* (≥ +2) and *Desperate Gamble* (≥ +3).

- **Elasticity:** the pendulum swings. Cold moves mostly push you hotter (*Call in Favor* +4), Hot moves mostly cool you (*Adrenaline Rush* −3), and *Desperate Gamble* goes all-in, then crashes you to **−3**.

- **Pain:** if a wounded Smuggler took damage during the round, the pendulum ticks **+1 toward Adrenaline** at round end (7-8).

The sheet applies the zone bonuses automatically: gun Attack TN, damage rolls (shown as "+1 Hot") and the squares on the Move button.

**Subclass Mechanics:**

- **The Dealer (DEX / CHA):** close-range gunman and street trickster. Exclusive moves: *Pistol Whip & Rob* (weapon damage without ammo, steal a magazine or item), *Adrenaline Rush* (sprint twice your squares, no attacks of opportunity) and *Black-Market Ammo* (until reload: ignore half armor or +1d6).

- **The Trafficker (WIS / CHA):** off-grid navigator and tactical coordinator. Exclusive moves: *Safehouse Route* (move an ally safely, clear Prone or Stunned), *Decoy Deployment* (enemies attack the decoy first) and *Call in Favor* (next round: a 3d6 sniper round or a 2d6 flare over a 3×3 area).

> **Combat Scenario Example: The Smuggler (Dealer Subclass)**

> *Round 1:* The Dealer starts at 0 Composure. They fire a *Street Snap-Shot* and duck into cover: the pendulum drops to −1, **Cold**. The next normal shot is at +2 TN. During the enemy's turn the Dealer takes a hit and is Wounded; pain pushes the pendulum +1 at round end, back to 0.

> *Rounds 2–3:* Another hit lands and the wound bites: the Dealer starts round 3 at +1, **Hot**. *Pistol Whip & Rob* on an adjacent guard (weapon damage +1 Hot, and a fresh magazine stolen) swings the pendulum to +3. With 3+ rounds loaded the Dealer unleashes *Desperate Gamble*: weapon damage to every enemy in a 3×3 area, magazine empty, and the pendulum crashes to **−3**. Cold again, and steady enough for a precise shot next round.

### 7-4-5. The Scavenger: Tells {#sec-7-4-scavenger}

The Scavenger turns attention into damage. **Tells** sit on individual enemies (max 3 each, as many enemies as the optic can Track) and are spent on that enemy.

- **Start of your turn:** place 1 Tell on an enemy you can see, or 2 if you are Unseen (full cover and no attack last round). The sheet reminds you how many are still to place.
- **Attacking** (an attack, or *Called Shot* / *Kill Shot*) means you count as having attacked this round: next round you place only 1. *Vanish* (once per combat) slips you back into full cover and clears that.
- **Exploit:** after an attack hits and the damage is in, the roll window asks which enemy you hit and how many of its Tells to spend: +1d4 each, rolled or typed, then those Tells are gone.
- **Abilities** cost Tells on the target: 1 for a small edge (*Mark*, *Lift*, *Misdirect*, *Pin the Route*), 2 for a big one (*Jam*, *Called Shot*, *Strip*), 3 for the finisher (*Kill Shot*). Like every ability they roll your Class TN, and a failed roll still pays its cost.
- **Round end:** remove the Tells of any enemy you lost sight of this round. Enemies that go down take their Tells with them automatically.

> **Combat Scenario Example: The Scavenger (Stalker Subclass)**

> *Round 1:* The Stalker (Courier Visor, Track 3) starts in full cover behind a container, Unseen: 2 Tells. One goes on the heavy gunner (B), one on the sniper (C). They use *Case the Room* for a third look: 1 more Tell each on B and C, and one on the guard (A). B now has 2.

> *Round 2:* Still Unseen (no attack yet): 2 more Tells on B, which caps at 3. The Stalker leans out and fires *Kill Shot* at B: 3 Tells spent, weapon damage +3d4, cover ignored, armor counts half. B drops. Having attacked, next round they place only 1, so they *Vanish* back behind the container to be Unseen again.

## 7-5. Attacks, Damage Resolution, Armor & Targeted Location System {#sec-7-5}

Combat resolution in *The Fractured Century* is fast, lethal, and deterministic. Attacks and class abilities test an Operator's tactical accuracy against explicit Target Numbers (TN), resolved through a simple roll-to-damage-to-armor flow.

### 1. Attack Resolution & Target Numbers (TN)

The method for resolving an offensive action depends on whether the Operator is executing a standard weapon strike or deploying a specialized class payload:

- **Standard Weapon Attacks (Firearms, Melee, Thrown):** Standard attacks use the specific **Target Number (TN)** auto-calculated and listed directly on the weapon card (for ranged weapons) or derived from the relevant combat skill (*Melee / CQC*, *Brawling*, *Thrown Objects*).

- **Class Ability Execution:** When deploying offensive class maneuvers, the roll checks against the character's **Class TN** (the average of their subclass's two main attributes), adjusted for any Global Difficulty Tiers.

### 2. Standard Attack Sequence (General Body Hits)

When an Operator performs a standard attack without declaring a specific body target, resolution follows three rapid steps:

- **Roll Attack (d20):** Roll a d20 against the weapon's TN or skill TN. If `d20 ≤ Effective TN`, the attack hits.

- **Roll Damage:** Roll the weapon or skill's base damage die (e.g., 2d6 + OFF).

**Apply Damage through Armor Mitigation:** Subtraction occurs directly against incoming damage.

**General Armor acts strictly as damage mitigation—it does not increase the difficulty to hit.** Subtract the target's **General Armor Rating** directly from the total rolled damage. Any remaining damage is deducted directly from the target's general HP pool.

### 3. Location Attacks {#sec-7-5-location}

Instead of aiming at centre mass, you can declare a **location attack** before you roll — to cripple a leg, break a gun arm, or put a guard on the floor. Body locations have no HP of their own: they decide **which condition** a hit adds.

**Resolution Flow:**

- **Declare and roll to hit:** a location attack is an attack action at **−4 TN**. It cannot be combined with class abilities.

- **Roll the location (d20):** on a hit, roll a d20 on the table below. With **Aim** (1 extra action spent before the attack) you may shift that d20 by up to ±5.

- **Roll damage:** as usual. Damage minus the target's armor comes off HP — a location attack is never weaker than a normal one.

- **Then the location acts:**
  - **Damage got through the armor** (at least 1 point): the target gains that location's condition.
  - **The armor stopped everything:** no condition, but the target's armor **cracks by 1** until repaired. Cover never cracks.

**What each location does:**

- **Head:** *Stunned* — or *Incapacitated* if the hit leaves the target at half its maximum HP or less.
- **Chest:** *Slowed* — the shock costs 1 action on the next turn.
- **Abdomen:** *Prone* — doubled over, on the ground.
- **Arm:** *Broken arm*. One arm: only one one-handed weapon can be used (a hacker deck still works). Both arms: only movement, talking and mental abilities.
- **Leg:** *Crippled leg*. One leg: half your squares per move. Both legs: 1 square per move.

Left and right count separately. Broken arms and crippled legs stay until treated: **First aid** (1 action, *Medicine / First Aid* check), a **Trauma Patch**, or downtime. A full heal restores HP, not bones.

**Synthetic targets** (drones, turrets, robots) map differently: legs → crippled mobility, arms → *Jammed* weapon mount, chest and abdomen → *Stunned*, head (sensors) → *Blinded*. Some **elites are immune** to a condition (e.g. they cannot be knocked prone): the hit still deals its damage.

**Cracked armor:** normal attacks never crack armor. Armor cracks only when it stops a location attack completely, or when an effect says so (*Bunker Buster*, corrosion, *Field Maintenance* in Surge). **Repair armor** — downtime, or *Field Maintenance* in Mend — mends the cracks.

> *Example:* the Soldier wears 4 armor. A ganger declares a location attack at his chest and rolls 3 damage: the armor holds, and cracks to 3. Next turn the ganger tries again and rolls 5: 2 points get through — the Soldier loses 2 HP and is **Slowed**. Meanwhile, plain shots keep hitting his 3 armor.

> **The "Aim" Tactical Nudge:** spend **1 additional action** before a location attack to **Aim**: you may shift the location d20 by up to ±5 (not the attack roll). *Example:* you roll 15 (chest); with Aim you can move it to 19 — the head.

::table[hit-locations]

## 7-6. Conditions {#sec-7-6}

During high-stakes operations, environmental hazards, heavy ordnance, network hacks, and tactical abilities can inflict severe **Status Conditions** on Operators and enemies alike. Status Conditions alter an entity's operational capability, movement, or accuracy until cleared.

Because these effects are dynamically applied during combat, players and GMs can track active conditions in the **Health & conditions** card of the sheet's Play tab. Location attacks (7-5) are the most common source: *Broken arm*, *Crippled leg*, *Prone*, *Slowed*, *Stunned* and *Incapacitated*.

**The sheet applies the numbers.** Conditions that change a value change it on the sheet: *Stunned* and *Slowed* lower this round's actions, *Prone* halves your squares per move, *Blinded* takes −10 TN off your attacks, *Enraged* adds +2 to melee hits (shown in the damage). A changed value shows in **red** (worse) or **green** (better), with the normal one small beside it.

**Boosts.** Six positive conditions the GM (or a situation) may grant, set by hand on the sheet and lasting until the GM ends them, usually at the end of the scene: *Overdrive* (+1 action each round), *Focused* (+2 TN on attacks), *Sharp* (+1 TN on skill checks), *Fired Up* (+1 OFF), *Guarded* (+1 DEF) and *Bolstered* (+1 armor).

**Reference Table: Global Status Conditions**

::table[conditions]

## 7-7. Death {#sec-7-7}

In *The Fractured Century*, combat is unforgiving and high-lethality. Operators do not possess massive, inflated health pools; a single tactical mistake, poor position, or well-placed sniper shot can lead to permanent maiming or immediate mortality.

### 1. Lethal Triggers & Critical Failure

An Operator or NPC faces immediate death or severe operational impairment under the following physiological conditions:

- **Base Attribute Zeroing (System Collapse):** If any core Base Attribute (e.g., Constitution, Strength, Dexterity) is temporarily reduced to **0** due to severe neuro-toxins, extreme cybernetic feedback, or debilitating debuffs, the entity suffers instant systemic death. This is a rare, high-lethality occurrence requiring immediate field intervention before the attribute drops to zero.

- **Body locations never kill on their own:** a location attack adds a condition (7-5) — a head shot can leave you *Incapacitated* — but death always comes through HP, below.

### 2. General HP Zeroing & Massive Overkill

When an Operator's **General HP** drops to **0 or below**, they immediately collapse into an **Incapacitated / Unconscious** state.

- **Massive Overkill (Negative CON Threshold):** If an attack reduces General HP below zero and the remaining negative damage total meets or exceeds the Operator's **CON score** (e.g., having a CON of 12 and taking enough damage to reach **-12 General HP**), the Operator dies instantly from massive physiological trauma.

**The CON Death Saves:** At the start of every active round while left untreated at 0 HP, the unconscious Operator must make a **Constitution (CON) Check**.

- **First Failure:** The Operator remains critically bleeding and unstable.

- **Second Failure:** Instant death. The Operator succumbs to internal trauma.

- **Taking Damage While Unconscious:** If an unconscious Operator at 0 HP takes additional damage from stray AoE explosives or targeted strikes, the incoming damage accumulates directly toward their negative **CON threshold**. Reaching negative CON results in immediate death.

### 3. Field Stabilization & Reanimation

Squadmates can pull a downed teammate back from the brink of death through two direct field methods:

- **Emergency Med-Kit Reanimation:** An adjacent ally spends **1 Action** and consumes a standard *Med-Kit / Trauma Patch*. The downed Operator is instantly revived, restored to **1 General HP (Stable)**, and placed in the **Prone** condition on the grid.

**Manual First-Aid Stabilization:** An adjacent ally spends **1 Action** to attempt a manual **Medicine / First Aid Skill Check**.

- **Success:** The downed Operator is stabilized at **0 HP**. They remain **Unconscious**, but no longer need to roll CON death saves unless damaged again.

- **Failure:** The stabilization attempt fails, wasting the action while the death clock continues ticking.

## 7-8. Turn & Round End Processing {#sec-7-8}

Combat in *The Fractured Century* is a continuous sequence of tactical turns bound within global rounds. Once all Operators, hostile entities, and automated drones have executed their action pools, the Game Master pauses the scene for **Round End Processing**. This structured cleanup phase resets tactical resources, advances ongoing combat hazards, and maintains the game's high-lethality momentum.

### 1. Active Turn End Processing (Individual Execution)

Immediately after an individual entity finishes spending their action allowance on their turn, perform the following individual steps before handing initiative to the next combatant:

- **Unspent Action Forfeiture:** Any unspent actions not explicitly held for **Proactive Defense (Evasion)** or **Overwatch** are lost. They do not roll over to the next round.

- **Continuous Damage Resolution:** Entities affected by **Poisoned / Corroded** or ongoing electrical hazard fields roll and deduct their continuous damage at this moment.

### 2. Global Round End Processing (The System Cleanup)

Once every combatant on the initiative tracker has acted, the GM resolves global board states and class engines in the following strict sequential order:

**Death Loop & Bleed Checks:**

Every **Incapacitated / Unconscious** Operator sitting at 0 HP who has not been stabilized must roll their mandatory **CON Death Save**. A second accumulated failure results in instant physiological death.

**Class Engine & Resource Reset:**

**The Hacker (RAM & Heat):**

- **Sustained Payload Tick:** Active *Sustained Payloads* (e.g., *Keylogger Injection*, *Data Loop*) continue to lock their assigned RAM slots on the deck. Hackers may choose to voluntarily release any payload now to free up RAM for the coming round.

- **Passive Thermal Decay:** Decks not in Blue Screen vent **−1 Heat**.

- **Blue Screen:** a deck that reached its heat cap this round drops every sustained hack, stays locked through the next round, then reboots at **cap − 3** Heat. A deck stunned by *System Hard Reboot* comes back online.

**The Tech Wizard (Field Sync):**

A Tech Wizard who held the same mode all round gains **+1 Sync** (max Resonant). A rig in **Brownout** counts down: it comes back online at the end of the round after the collapse.

**The Smuggler (Pendulum Stabilization):**

If a Wounded Smuggler took damage during the round, their **Adrenaline Pendulum** passively ticks **+1 toward Adrenaline Rush** due to pain and elevated heart rates.

**Environmental Decay & Tactical Duration Tick:**

- **Temporary Barriers & Traps:** Deployed hazards, electrical shock zones (e.g., *Rig Power Conduit*), and temporary smoke/flashbang effects reduce their duration counter by 1 round.

- **Status Condition Expire:** Temporary conditions set to last "until the end of the round" (e.g., *Stunned*, target locks, or accuracy debuffs) clear automatically.

**Action Allowance Reset:**

All Operators and NPCs replenish their active action allowance up to their base `ACTIONS / RD` metric, minus any actions spent out-of-turn on **Proactive Defense**. Initiative resets to the top of the order for the next round.
