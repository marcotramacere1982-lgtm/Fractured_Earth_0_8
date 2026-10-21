# Running the Game {#ch-9}

## 9. Behind the screen

This chapter is for the Game Master. It covers the rules that are yours to apply, how they play out at the table, and where each one lives in the **GM console** (the `/gm/` page the table server opens for you). Each section follows the same order: **the rule**, **how it plays**, **in the console**. Where the two are the same thing, they are merged.

The app is a smart paper sheet for everyone, the GM included. It does the maths and remembers what happened; it does not run the game. Every number it shows can be overridden by you, and every tool in the console that changes a sheet can be taken back.

## 9-1. Fun first {#sec-9-1}

**The rule.** The GM's job is a good evening at the table, not a correct simulation. The rules exist to make choices matter and outcomes surprising. When a rule gets in the way of that, you change the ruling and keep playing. Players should never feel the app is the referee: you are.

**How it plays.** Watch the table, not only the screen. Signs a scene isn't working:

- phones out, side conversations, the same player talking for twenty minutes;
- a fight past round four where nothing has changed but the HP numbers;
- three failed rolls on the same door with nothing new learned;
- a player who has been quiet all evening.

Most of the time the problem is the scene, not the dice. The encounter you built may be too long, too flat or too hard. Change it while it runs:

- **End a fight that is decided.** Enemies surrender, flee, call for a truce or simply break. Narrate the mop-up instead of rolling it.
- **Collapse a chain of rolls into one.** A whole lock, a whole climb, a whole search: one check, and the margin says how well it went.
- **Fail forward.** A failure still moves the story: the door opens but the alarm trips, the clue is found but someone saw you (6-3).
- **Move the difficulty.** Easier tiers exist for this (9-4): help, time, good tools.
- **Hand someone the spotlight.** Ask the quiet player what their character notices; the Explore tab tells you what they are good at (9-5).

**Overrides are yours.** Every one of these is in the console, and none of them needs an excuse:

- **Difficulty** for one roll or the whole table (9-4).
- **Your own dice and notes**, outside the rules (*🎲 Roll / note*, 9-4).
- **Undo** a player's action, a round or a whole fight (9-14).
- **Accept or revert** changes to a sheet (9-3).
- **Gift** talents, XP, items and unique gear (9-11, 9-13).
- **Hide, reveal, move** anything on the map (9-8).

> **Keep it fun — what this does not mean.** It does not mean rerolling every failure or saving every character. Failure, cost and loss are what make success feel earned, and players notice when nothing can go wrong. Use overrides to fix *the evening* (a scene that drags, a rule that misfired, a mistake with a button), not to remove risk. A good test: would the table thank you for it if they saw you do it?

## 9-2. Opening the table {#sec-9-2}

**How it works.** The live table runs from one computer on the room's Wi-Fi. `npm run table` starts the server and prints two things: the **address** players open on their tablets and the **GM key**. Open `/gm/` on your laptop and type the key. Nothing needs internet.

Players open the address, load their character and tap **Join the table** on the sheet (Dossier). From then on their sheet sends its state to you after every action, and receives your messages, difficulty, light, combat order and map.

**In the console — Table tab.**

- **Player cards** — one per connected character: HP, armor, conditions and injuries, the class engine, readied weapons, the round's actions, level and XP, cash and CRS, the debt, the last log lines.
- **Message a player** — the field at the bottom of each card. Messages wait in a mailbox until the sheet has shown them, so a tablet that was asleep still gets them.
- **Tell everyone** — the bar at the top; *Refresh* asks every sheet to send its state again.
- **Sit out** — hides a character and keeps it out of fights (a player who joined with the wrong sheet, someone who left early). It goes to **Not playing now**, with offline characters; *Bring back* returns it.
- **Table log** — every action, roll and purchase as it happens. The 📌 in the Story tab pins lines into the session log (9-9).

Sheets play a soft sound when a player's turn starts, when you send something and when they are hit. Players switch it off on their own device.

## 9-3. The sheet watch {#sec-9-3}

**The rule.** Players own their sheets, and a browser can't stop anyone editing one. So the console doesn't block changes; it **notices** them.

**How it plays.** Changes from play — HP, ammo, conditions, class resources, notes — always pass. Changes to the **foundation** — attributes, CRS, cash, inventory, credentials, class, XP, talents — are checked against the sheet's own log. A purchase explains the cash it cost; a gift explains the item. What the log doesn't explain is **flagged**.

**In the console.** A flagged card shows **Unexplained changes**: what changed, from what to what. *Accept* makes it the new baseline; *Revert* sends the old value back to the sheet. Every snapshot is kept on disk (`local/table/history/`), so nothing is ever lost.

> **Keep it fun.** A flag is almost always a mistake — a typo in an attribute, a test purchase, a player fixing something you told them to fix. Ask first, out loud and kindly. The watch is there so nobody has to wonder, not to catch anyone.

## 9-4. Checks, difficulty and light {#sec-9-4}

**The rule.** Every check is a d20 rolled **under** a Target Number (TN): the skill or attribute TN, changed by one **difficulty step** for the whole situation (6-2). Harder steps lower the TN; the easier ones — **Favourable +2, Easy +4, Very easy +6** — raise it. Help is not a separate rule: one helper is Favourable, two people giving each other a leg-up is Easy, the whole crew with the right gear is Very easy. One step, never stacked, and only the person acting rolls. Missing by 1 can be a success with a cost; a natural 1 or 20 adds something the GM narrates. Contested and passive checks are in 6-2.

**How it plays.** Call for a roll only when failure would be interesting. Opening an unlocked door, buying lunch, knowing what your own career taught you: no roll. When you do call for one, say the step out loud, or set it for the table.

The sheet already counts what the player carries: tools appear as tick boxes (one counts), active items and stims show as *In play*, and in the dark a *Light* row suggests the right line (7-2 §4). You have the last word on all three: "the lockpick doesn't help with a keycard" is your call.

**In the console — Table tab, top row.**

- **Table difficulty** — Off, or a step from *Very easy +6* to the hardest. It appears on every sheet as a banner and is pre-picked in every roll window until you switch it off. For a single roll, just tell the player which step to pick.
- **Light** — *Bright* / *Dark* for checks when there is no map on the table. With a map, each player's own square decides (9-8).
- **🎲 Roll / note** (console header) — your own dice and notes, outside the rules: any expression (`3d6+2`), an optional TN to roll under, *About* (a player or an NPC) and a note. *Log* writes one line into the live mission's session log. Use it for secret rolls, NPC checks, random tables, or just to remember something said at the table. Nothing reaches the sheets.

> **Keep it fun.** If the whole plan hangs on one roll, either make it easier or make failure open a different door. A heist that dies on a Sleight of Hand check at the front gate is a short evening.

## 9-5. Exploration and the spotlight {#sec-9-5}

**The rule.** Out of combat the game runs on intent and means (6-3): the player says what they want and how; you name the skill and the step; the dice decide how well. Time is a resource (the Operating Clock, 6-1); preparation before a job (the zero-round, 6-4) earns advantages for the fight to come. Locks follow 5-3: mechanical → Sleight of Hand, electronic → Electronics / Security, networked → Computers / Hacking, or STR to force it.

**In the console — Explore tab.** A cheat sheet for everything that isn't a fight:

- **Who's best at…** — every skill side by side for the characters playing now, the best TN highlighted. When nobody knows who should try, you do.
- **Per character** — debt anchor, notable traits, credentials, life path and backstory. These are your hooks: a contact from their career, a creditor from their debt, a place from their youth.

> **Keep it fun.** Give each player a moment where *their* character is the right one for the job. The Explore tab makes it easy to see who hasn't had one yet.

## 9-6. Running a fight {#sec-9-6}

**The rule.** Everyone rolls **d20 + INIT** once; the order stays for the whole fight (7-1). A combatant may *Delay* to the end of the round. Each turn has a number of actions (shown on every sheet and enemy card): move, attack, ability, reload, interact, aim, and so on (7-3). Enemy attacks are rolled exactly like the players': d20 under the attack TN, damage minus the target's armor, location attacks at −4 TN with a condition if damage gets through (7-5). Players never see enemy stats: their sheets show an anonymous order and the **Hostiles** list — letter, the name you give, a wound band (Unhurt, Hurt, Bloodied, Down) and visible conditions.

**In the console — Combat tab.**

1. **Set up.** *New encounter*. Search the enemy library (chapter 10 shows it as a collection), choose how many copies and *Add*; or fill the custom line (name, HP, armor, actions, INIT, one attack). Connected players who aren't sitting out join automatically.
2. **Initiative.** *Roll missing initiative* rolls for everyone without a roll; type the d20 for players who rolled at the table. *Re-roll all* if you need to start over.
3. **Start combat.** Sheets get the order and their turn banner.
4. **Turns.** *Now acting* shows whose turn it is. Mark each combatant *Done* (in any order); *Delay* moves one to the end of the round; *Next turn ▶* moves on.
5. **End round.** Runs every sheet's round end: class engines tick, timed effects count down, conditions clear.
6. **End combat** when it's over. *Clear defeated* tidies the list mid-fight.

**Enemy cards.**

- **Players see** — the public name ("Guard in red"); the letter is given automatically and never reused. *Hide* keeps an enemy (an ambusher, a sniper) off the players' order and Hostiles list until you reveal it.
- **HP** — type the damage a player tells you and pick where it landed (a normal hit, or ⌖ head / chest / abdomen / arm / leg for a location attack: the condition is added for you); armor is subtracted unless you tick *ignore armor*. *Crack armor −1* when a location attack is fully stopped.
- **ACT** pips track the enemy's actions this round.
- **Attack buttons** — normal or location attack: the console rolls the hit; *Send hit* sends damage (and location) to the target's sheet, where their armor is applied.
- **Injuries and conditions** — tap to set; they show on the players' Hostiles list.
- **Sees in the dark** — night vision or thermal: the dark doesn't hide anyone from it (7-2 §4).
- **Notes** — position, target, tricks. A Scavenger's **Tells** on that enemy show here too.

**The challenge meter** estimates how hard the fight is from both sides' damage per round, armor and HP: **Easy, Fair, Hard, Deadly**, with notes ("armor nobody can get through", "one-round knockout risk"). It ignores abilities, cover and tactics, so treat it as a first opinion. The rating when the fight starts also decides the danger XP (9-11).

**↶ Undo** on the tracker takes back your last changes (about 15) and is announced to the table as "The GM took back their last move" — no names, so hidden enemies stay hidden.

> **Keep it fun.** The meter can't see the room. If a Deadly fight is a slog after two rounds, the enemies' morale breaks; if an Easy one is over in a turn and the players look bored, reinforcements arrive. A fight should end when its question is answered — who controls the room, did they get the data — not when the last HP is gone.

## 9-7. Building maps {#sec-9-7}

**The rule.** Tactical maps use squares of **1.5 m** (7-2). Walls and closed doors block movement and sight; open doors and windows let sight through; pieces can block sight, give cover or make difficult ground (2 squares per square).

**In the console — Maps tab.** A builder for the maps you'll put on the table:

- **Walls** in three widths, **doors** and **windows** on the grid lines; snap on or off. A door can start open, closed or **locked** (locks are never shown to players).
- **The library** — furniture, crates, terminals, vehicles, cover, floors, stairs and elevators, grouped and searchable. Each piece says its footprint and what it blocks; *Turn* rotates it.
- **Hidden pieces** (*Hidden (GM only)*) — loot found by searching, a trap, a secret door: placed now, revealed in play.
- **Security** — sensors, laser lines and alarm keypads, GM-only; lights that can be on or off; wall safes that open.
- **Light** — the map's environment, *Bright* or *Dark*, and **darkness zones** for unlit corners of a bright map.
- **Save**, *Duplicate*, *Export file*. Maps are saved in `local/gm/maps/`; nothing is published.

> **Keep it fun.** A map is a stage, not a puzzle. Build the rooms where something will happen, and describe the rest. Ten minutes on a good map beats an hour on a perfect one.

## 9-8. The map on the table {#sec-9-8}

**The rule.** Movement, line of sight and range follow 7-2. The map *informs*; you *decide*. Line of sight and range shown on a tablet are a guide — you confirm cover and anything unusual.

**How it plays.** Players see a **Map** tab while a map is on the table (7-2 §5). They see what their crew can see right now, and remember what they've seen. They drag their own marker: free out of combat; in combat one Move action gives them their squares for the round. They open and close doors next to them (an Interact action in combat). A locked door stays shut: they're told it's locked, you get a note that they tried. Torches, flares and vision gear work on their own.

**In the console — Deploy tab.**

- **Put a map on the table** — pick a saved map; the turn tracker sits beside it.
- **Not on the map** — players and enemies waiting to be placed: tap one, then a square. Drag markers to move them; tap one marker then another to check sight.
- **Players move their markers: on / off** — let players drag their own markers, or move everyone yourself. In combat the console re-checks every move against the player's squares and turn.
- **Fog of war & light** — fog *On* or *Off — they see everything*; *Reveal all*, *Reset*, and *Edit squares* to reveal a square by hand (a floor plan they bought, a camera feed). *Bright* / *Dark* changes the environment live.
- **Pieces** — tap one to reveal it, hide it again, switch it on or off (lights, sensors, lasers), open or lock a door, or take it off for this session. The saved map keeps its starting state.
- **NPCs** — pick a role (worker, clerk, guard…) and *+ Add*: players see *Worker 1* until you rename it to a real name. Each NPC has a private note for you.
- **Take the map off the table** when the scene ends.

> **Keep it fun.** If the map and the story disagree, the story wins: move the marker, open the door, reveal the room. If a player struggles with dragging, move their marker for them. The map is there to end arguments, not to start them.

## 9-9. Missions, the session log and factions {#sec-9-9}

**How it works.** The **Story tab** is the campaign's notebook, saved on your computer (`local/gm/campaign.json`) and never published.

- **Missions** — title, code, **objectives** (primary and secondary, marked done or failed), **chapters** for the scenes (*Next chapter ▶*), the zones involved.
- **Notable NPCs** — shared across missions, with their state.
- **Threats** — prepared enemies; *→ Combat* sends them to the tracker.
- **Session log** — 15 lines a page; anything you write, every *🎲 Roll / note*, and every line you pin with 📌 from **At the table** (the live table log).
- **Handouts** — images from `local/gm/handouts/`: pick one, tick who gets it (or *Everyone*), add a caption. It arrives on their sheets like a message.
- **AI prompts** — *Build prompt* writes a debrief of the mission (from the log and objectives) or a draft for the next one, to paste into your own AI. *Save to campaign story* keeps the debrief in the campaign story.

**Factions.** The rule: each power has a standing from **−3 Hostile** to **+3 Patron** (−2 Watched, −1 Wary, 0 Neutral, +1 Friendly, +2 Allied). It moves by 1, always with a reason, inside a floor and a ceiling you set ("they'll never trust a crew that hit their depot"). In play it decides who answers a call, what a contact will risk, who shows up uninvited. In the console it sits under the campaign; changes go into the session log, and the AI prompts carry the standings. Players never see it.

## 9-10. Crew and Unity {#sec-9-10}

**The rule.** The crew has one shared **Crew track** from 0 to 10 (start 5). It measures **whether they act together, never whether the act was good** (6-6). +1 when the crew commits to a costly or risky call together, or when you see them cover for each other; −1 when one player overrides a crew that objected. Bands: Broken 0, Fractured 1–3, Steady 4–6, Tight 7–10.

**Unity Checks.** When one character wants to do something the crew may not back — kill the witness, take the side deal — talk it through, then open a check. Everyone but the actor votes in secret on their sheet: *Back*, *Object*, *Stay out*. You see who voted what; the table sees only the tally. The actor always decides; the track records it.

**Drives.** Each character has a Drive — Justice or Ambition — and a line in their own words. It's a compass, never a score. Acting on it at a real cost is a good reason for Spotlight XP.

**In the console — Table tab, Crew & Unity.** The track with *+1 intent* and *−1*; *Open Unity Check* (actor and intent), *Reveal the tally*, then *Backed together +1*, *Override −1* or *No change · close*. Voting by voice works too: just record the outcome.

## 9-11. Experience and levels {#sec-9-11}

**The rule.** No XP per kill. Per mission, each player present gets:

- **3** for a primary objective achieved, **1** for a secondary, **1** for an objective failed (you learn from it);
- **+1** for surviving a fight rated Hard, **+2** for Deadly (the rating when the fight started);
- **+1 Spotlight** from you, at most once or twice per player per session: a great scene, a real cost paid for their Drive.

**10 XP is a level**: a talent point every level, +1 to an attribute on even levels, an extra ability slot at 3, 6 and 9 (5-9). Players spend levels only when you open level-up — usually in downtime, somewhere quiet.

**In the console.**

- **Mission XP** (Story tab) — totals per player from objectives, danger and spotlight; *Award* sends them once per mission.
- **Open level-up for everyone** / *Close level-up* (Table tab), or per player on their card.
- **Gift** a talent from the player's card: free, no prerequisites. Use it for story rewards — training with a veteran, a debt repaid in kind.

## 9-12. Downtime and debt {#sec-9-12}

**The rule.** Between missions, somewhere quiet, time passes (5-10). Injuries heal and armor is repaired. Lifestyle upkeep is **shown, not charged** — the table settles it. Each character's **debt pressure** rises by 1 (0–3): Squeeze, Escalation, then **Crisis**, which is a mission hook. An instalment or a story resolution lowers it.

**How it plays.** Each character gets one **story event** — a creditor's visit, an old contact, a quiet moment — and the crew may get one together. Events are narrative: their options are shown as choices, never applied by the app. You and the player decide what happens.

**In the console — Story tab → Downtime.** Choose the duration. For each player the console suggests events with a **confidence %** and the reasons (their debt and its stage, career, youth, current state, the world); recently used ones fade. Pick, edit, swap, write your own or skip; add a crew event; open level-up if you like; send. Each sheet restores itself, raises the pressure, adds the event to *Story so far* and shows a report. Set pressure by hand from the player's card when the story pays a debt down.

## 9-13. Loot, the Forge and backstories {#sec-9-13}

**Street prices.** Gear bought officially costs Credit Score (traced); on the street it costs cash at a markup of **×3 to ×10** (untraced). The player picks the markup in the purchase window — you tell them which: ×3 from a friendly fence, ×10 for a rifle the night before a job. The rarest gear is street only.

**The Forge (Admin tab).** For the one-off find: pick a kind and a base item, change its numbers, add bonuses while it's in use (any attribute or skill, armor, actions, OFF, DEF, initiative), a one-line note, a value or *can't be fenced*, and *Forge & send* it to the player who found it. It shows in purple on their sheet and keeps its stats if given away. Forged items are kept for reuse (*Forged so far*).

**Backstories (Admin tab).** Players can ask you to write or polish their backstory from the builder or the Dossier. Requests wait here; add a note per request (hooks, ties to the campaign). In Claude Code, `/backstories` writes the waiting ones; you read, edit and send. Nothing reaches a player until you send it.

> **Keep it fun.** Loot is story. A unique item works best with a name, a past and a note — "the grip is wrapped in a dead courier's scarf" — and a small bonus. A +5 is a solved problem; a +1 with a story is a conversation piece.

## 9-14. Mistakes, undo and the archive {#sec-9-14}

**The rule.** Players never undo their own sheets — they ask, and you decide.

**In the console.**

- **↶ Undo…** on a player's card — *Last action*, *This round*, *Whole combat*, or back to before any line of their log. The sheet returns to the snapshot taken just before; rolls stay in the log. Every undo is listed in the **Undo log** (Table tab), with a count on each card, so the table can see it was fair.
- **↶ Undo** on the combat tracker for your own changes, announced to the table (9-6).
- **Admin tab** — characters, missions and session logs on disk. *Archive* moves a finished character or mission out of the way; *Restore* brings it back; *Inspect* reads it. Nothing is ever deleted, and every action asks first.

> **Keep it fun.** Undo is for mistakes — a wrong button, a misread rule, damage applied twice, a fight started too early. It is also for the rare moment when the dice produce something nobody at the table wants: a character dying to a stray bullet in a scene that didn't matter. Use that one sparingly and openly. Tell the table you're doing it and why; then it's a gift, not a cheat.
