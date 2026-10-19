# Combattimento {#ch-7}

## 7. L'azione

La fase di combattimento

## 7-1. Iniziativa e struttura del turno {#sec-7-1}

All'inizio di uno scontro, tutti gli Operatori e le unità ostili tirano d20 + bonus di iniziativa per stabilire l'ordine fisso delle azioni. Questo ordine resta lo stesso per tutto il combattimento, così il ritmo tattico resta prevedibile senza dover ritirare a ogni round. Per gli aggiustamenti tattici improvvisi, un giocatore può scegliere di ritardare (*Delay*) il proprio turno durante un round. Dichiarare un ritardo sposta volontariamente il turno dell'Operatore alla fine del round in corso — dopo che hanno agito tutte le unità, amiche e nemiche — per reagire ai cambiamenti sul campo, aspettare che la squadra si prepari o coordinare un'avanzata a fine turno.

**Al tavolo dal vivo**, la tua scheda mostra l'ordine con ogni nemico come *Hostile*, quindi non dice mai quale nemico agisce e quando. Sotto, la lista **Ostili** mostra i nemici che il GM ha rivelato, ognuno con una lettera (A, B, C…) che il GM usa anche a voce e sulle miniature: il nome che gli dà il GM, organico o sintetico, una fascia di ferite (Illeso, Ferito, Grave a metà HP o meno, A terra) e le condizioni visibili. I nemici che il GM tiene nascosti (un'imboscata, un cecchino) compaiono solo quando vengono rivelati.

## 7-2. Linea di vista, copertura e geometria della griglia {#sec-7-2}

Il combattimento nel *Fractured Century* è tattico, spaziale e spietato. Posizione, linea di vista e copertura fisica fanno la differenza tra sopravvivere a uno scontro e subire una ferita strutturale fatale. Movimento e geometria sulla griglia sono volutamente intuitivi, perché il combattimento di squadra resti veloce.

### 1. Movimento tattico e geometria della griglia

Le mappe tattiche usano una griglia quadrata in cui **1 quadretto = 1,5 metri**.

- **Movimento (SQR):** il valore `SQR` di un Operatore (derivato da Costituzione + Destrezza) indica quanti quadretti può percorrere con una singola azione di movimento.

- **Diagonali:** muoversi in diagonale costa come muoversi dritto, 1 a 1: niente calcoli complicati o costi alternati.

- **Ostacoli e terreno:** muoversi su terreno difficile (macerie fino alle ginocchia, binari della metro allagati, cunicoli stretti) costa il doppio (2 quadretti per ogni quadretto percorso).

### 2. Linea di vista (LoS)

Per dichiarare un attacco a distanza, lanciare un payload di classe o interagire con un bersaglio sulla griglia, l'attaccante deve avere una **linea di vista (LoS)** libera.

- **La traccia da centro a centro:** traccia una linea retta immaginaria dal centro del quadretto dell'attaccante al centro di quello del bersaglio.

- **LoS libera:** se la linea attraversa solo quadretti aperti, il tiro non ha ostacoli.

- **LoS bloccata:** se la linea incrocia un muro solido, una porta blindata chiusa o un pericolo ambientale opaco (pilastri di cemento, fumo a visibilità zero), la linea di vista è interrotta e non si può attaccare direttamente.

- **LoS ostruita (copertura):** se la linea passa attraverso ostacoli bassi, mobili, spigoli o il quadretto di un altro personaggio, il bersaglio ottiene i benefici della **copertura**.

### 3. Il sistema di copertura (rinforzo dell'armatura)

In questo sistema la copertura non rende un Operatore più difficile da colpire alterando i tiri di difesa: funziona invece come una schermatura fisica che assorbe danni cinetici ed energetici prima che arrivino al corpo. La copertura aggiunge protezione fissa alla tua **armatura**, su ogni colpo, ovunque arrivi.

::table[cover]

- **La copertura non si incrina:** quando un attacco a una locazione viene fermato del tutto, si incrina solo l'armatura che indossi (vedi 7-5). La copertura è terreno: resta finché non la lasci o non ti prendono di fianco.

- **Prendere di fianco (annullare la copertura):** se un attaccante si sposta in un angolo da cui la sua linea da centro a centro non incrocia più l'elemento di copertura del bersaglio, il bersaglio è **preso di fianco** e perde tutti i bonus di copertura contro quell'attacco.

> Copertura distruttibile (produzione di rottami):

> Quando un elemento di copertura parziale o totale assorbe un attacco cinetico molto potente, può degradarsi. Un Tech Wizard può subito prendere di mira la copertura danneggiata o distrutta con le ability Scavenge & Survey o Deploy Improvised Cover, per raccogliere rottami al volo o ricostruire barricate da campo!

## 7-3. Tipi di azione {#sec-7-3}

Il combattimento nel *Fractured Century* si basa su un'economia delle azioni piatta e fluida. Il sistema elimina volutamente i livelli complicati di azione: non esistono azioni "minori", "maggiori" o "bonus". Ogni azione ha lo stesso peso, così gli Operatori possono adattare la risposta tattica man mano che le minacce crescono.

### 1. L'economia delle azioni

- **Una moneta unica:** ogni dichiarazione in combattimento costa esattamente **1 azione**, salvo indicazione diversa.

- **Azioni massime per round:** il numero massimo di azioni per round dipende dal valore `ACTIONS / RD` del tuo Operatore (derivato da Saggezza + Destrezza, da 2 a 7).

- **Ripetere le azioni:** puoi ripetere la stessa azione più volte nello stesso round (per esempio 3 azioni per *Movimento → Movimento → Movimento*, o *Attacco → Attacco → Attacco*), finché hai azioni a disposizione.

### 2. Azioni di combattimento standard

Durante un round di combattimento, un Operatore può spendere le sue azioni in qualsiasi combinazione delle seguenti manovre:

- **Movimento (posizione e copertura):** avanzi fino al tuo movimento massimo (`SQR`) per ogni azione. Comprende tuffarsi dietro, accucciarsi sotto o entrare in una **copertura parziale** (+2 armatura) o **totale** (+4 armatura) lungo il percorso.

**Attacco standard (a distanza e in mischia):** un attacco diretto senza usare ability di classe.

- **Armi da fuoco:** spari un singolo colpo controllato per azione, usando il **numero bersaglio (TN)** dell'arma calcolato in automatico e mostrato sulla sua scheda. Raffiche o colpi multipli sono permessi *solo* se lo indica esplicitamente la scheda dell'arma.

- **Mischia e lancio:** colpi in mischia, risse a mani nude o armi da lancio tirano direttamente contro le abilità di combattimento corrispondenti (*Melee / CQC*, *Brawling* o *Thrown Objects*).

- **Ability di classe:** attivi un'ability di classe pronta o un modulo tattico dal tuo HUD (per esempio *Ping Sweep*, *Brace & Dig In*, *Contraband Stash*). Attivare un'ability di classe costa **1 azione**, salvo indicazione diversa sulla sua scheda.

- **Ricarica o cambio d'equipaggiamento:** spendi **1 azione** per inserire un caricatore di scorta nell'arma che hai in mano (quello vecchio si butta), o per passare all'altra arma. **Solo l'arma in mano può attaccare**, quindi per sparare con l'altra devi prima cambiare. Fuori dal combattimento scegli liberamente l'arma in mano sulla scheda dell'arma. Il pulsante *Ricarica / cambia* della scheda mostra entrambe le scelte.
- **Seconde possibilità:** se un giocatore vuole ritirare una mossa, decide il GM. Dalla console il GM può annullare l'ultima azione di un giocatore, il suo round o il suo intero combattimento; la scheda torna indietro e ogni annullamento viene registrato dove il GM lo vede, così il tavolo resta equo. Quando il GM ritira una sua mossa sul tracker del combattimento, il tavolo viene avvisato.

**Interagire con l'ambiente e l'inventario:** azionare console, aprire porte blindate, raccogliere equipaggiamento caduto o scambiare oggetti con un compagno adiacente (per esempio passargli un med-kit o un caricatore).

- **Interazioni lunghe:** oggetti complessi o hardware pesante possono richiedere più azioni o più round, come indicato sulla loro scheda.

- **Cure e stabilizzazione sul campo:** applicare cerotti per traumi o prestare primo soccorso a un alleato a terra costa 1 o più azioni, come indicato dall'oggetto medico.

- **Sganciarsi / disimpegno:** spendi **1 azione** per allontanarti in sicurezza da un avversario in mischia, interrompendo lo scontro senza provocare un attacco di opportunità.

- **Overwatch:** dichiari un corridoio di linea di vista e tieni la mira. Spari automaticamente un colpo a distanza gratuito al primo avversario che entra in quella linea o la attraversa durante il suo turno.

> **Azioni improvvisate del GM nel pieno della battaglia:**

> Non tutte le manovre disperate di uno scontro a fuoco sono scritte su una scheda. I compiti ambientali complessi e ad alta posta tentati durante il combattimento — mettere in moto un'auto per la fuga sotto il fuoco di soppressione, forzare un terminale di sicurezza a metà irruzione, manomettere una gru per far cadere un carico su un'unità d'élite — non hanno regole fisse. La **prova di abilità richiesta** e il **numero di azioni o di round** necessari li decide il Game Master sul momento, in base alla gravità della situazione.

### 3. Azioni di reazione e fuori turno

Il combattimento è fluido, e gli Operatori non sono del tutto indifesi quando non è il loro turno. Alcune manovre permettono di spendere azioni fuori dal normale ordine:

- **Difesa proattiva (schivata):** quando vieni attaccato fuori dal tuo turno, puoi spendere **1 o più azioni prese direttamente dal round successivo** per schivare o tuffarti al riparo. Tira contro la tua abilità *Avoid / Reflexes* per ridurre o evitare il danno in arrivo.

- **Attacchi di opportunità:** se un nemico impegnato in mischia prova ad allontanarsi o a sganciarsi *senza* spendere un'azione di **Sganciarsi / disimpegno**, puoi fargli subito un attacco di reazione gratuito. L'attacco usa la tua abilità *Melee / CQC* e infligge i normali danni a mani nude o con armi improvvisate: `1d4 + Bonus offensivo (OFF)`.

## 7-4. Le classi {#sec-7-4}

Nel *Fractured Century*, la scelta di classe e sottoclasse determina la dottrina tattica del tuo Operatore sulla griglia. Più che archetipi fissi, le classi sono motori meccanici distinti, ciascuno con il suo ciclo di risorse, la sua meccanica di stance e il suo equilibrio tra rischio e ricompensa.

La tua **sottoclasse** è la tua specializzazione operativa. Alcune ability di base sono comuni a tutta la classe, ma i colpi finali di alto livello e i moduli tattici specializzati sono esclusivi di sottoclassi precise.

### 7-4-1. Il Soldier: Stance-Flow e Tactical Points (TP) {#sec-7-4-soldier}

Il Soldier è un combattente di prima linea costruito intorno allo slancio e al posizionamento. Ogni colpo finale cambia la sua postura e spende **Tactical Points (TP)**; combattere normalmente li fa recuperare.

**Le stance:**

- **Defensive:** ×0,5 ai danni inflitti e subiti. Ideale per assorbire il fuoco e tenere i punti chiave.

- **Attack:** la base operativa (×1).

- **Onslaught:** ×1,5 ai danni inflitti e subiti. Un'esplosione offensiva ad alto rischio.

- **Il ciclo delle risorse (TP):** i TP partono da **0 all'inizio di ogni combattimento** e non hanno limite. **Ogni attacco normale a segno dà +1 TP**: un Soldier che continua semplicemente a sparare arriva comunque a un colpo finale ogni round o due. *Brace & Dig In* dà +2, *Steady Aim* +1. I colpi finali costano da 1 a 3 TP e ti spostano da una stance all'altra.

**Le sottoclassi:**

- **Il Grunt (STR / CON):** picchiatore di prima linea. Colpi finali esclusivi: *Fix Bayonets / Charge* (Attack → Onslaught, danni dell'arma +1d6, bersaglio Prone), *Bunker Buster* (Onslaught → Defensive, ignora metà dell'armatura) e *Reckless Execution* (resta in Onslaught, danni dell'arma due volte; svuota un caricatore con almeno 3 colpi).

- **L'Officer (DEX / INT):** comandante tattico. Ordini esclusivi: *Commanding Directive* (un alleato agisce subito), *Coordinated Crossfire* (+2 TN e +1d6 per gli alleati contro un bersaglio marcato) e *Tactical Redeployment* (la squadra si riposiziona in sicurezza).

> **Esempio di combattimento: il Soldier (sottoclasse Grunt)**

> *Round 1:* il Grunt apre con *Brace & Dig In* (+2 TP, Defensive, +2 armatura), poi un colpo normale a segno (+1 TP): 3 TP. *Dig In & Push* (1 TP) esce dalla copertura in **Attack** e spara: restano 2 TP.

> *Round 2:* *Fix Bayonets / Charge* (2 TP) travolge una guardia d'élite: danni dell'arma +1d6, ×1,5 in **Onslaught**, e la guardia è Prone. Seguono due attacchi normali, entrambi a segno: 2 TP, pronto per un altro colpo finale. Ma ogni colpo che il Grunt subisce vale ×1,5 anche lui.

### 7-4-2. L'Hacker: allocazione della RAM e stress termico (Heat) {#sec-7-4-hacker}

L'Hacker domina l'architettura digitale: manipola da lontano il cyberware nemico, le torrette automatiche e le sottoreti. Il suo motore consiste nel bilanciare la memoria del cyberdeck (**RAM**) con il pericoloso accumulo termico (**Heat**).

**Capacità di RAM e persistenza dei payload:**

- **Payload istantanei:** richiedono RAM libera mentre vengono eseguiti, poi la rilasciano (per esempio *Ping Sweep* costa 1 RAM / 1 Heat).

- **Payload sostenuti:** bloccano RAM finché l'hack resta attivo (per esempio *Keylogger Injection* blocca 1 RAM). La RAM bloccata si libera quando termini l'hack (la ✕ nel pannello del deck, o *Release Payload* per terminarli tutti) oppure con un *System Hard Reboot*.

- **Capacità del deck:** il **deck** dell'Hacker determina la RAM massima e l'heat cap (vedi *Deck e mod da Hacker*, 8-5). Le mod hardware alzano entrambi.

- **Stress termico (Heat):** ogni hack genera Heat; il deck ne smaltisce 1 a round. Raggiungere l'heat cap provoca un **Blue Screen**: tutti gli hack sostenuti crollano (la loro RAM si libera), il deck resta bloccato per il round successivo, poi si riavvia a cap − 3 di Heat. Il talento *Ghost* tiene in vita gli hack sostenuti. Gestisci l'heat con *Thermal Dump* (−3 Heat) o con un *System Hard Reboot* d'emergenza (azzera RAM e Heat; il deck resta offline per il resto di questo round e per il prossimo).

**Portata e bersagli:**

- **Portata (range):** un dispositivo in vista, o entro 10 quadretti su una rete che hai pingato (*Ping Sweep*).

- **Bersagli:** ogni nemico è **organico** (organic), **cibernetico** (cybernetic: impianti, ottiche smart) o **sintetico** (synthetic: droni, torrette, robot). Quasi tutti gli hack fanno presa solo su bersagli cibernetici o sintetici; i nemici organici si raggiungono attraverso i sistemi che li circondano. Il GM vede l'etichetta su ogni scheda nemico.

- **Manutenzione:** *Thermal Dump*, *Release Payload* e *System Hard Reboot* non richiedono tiri; costano comunque un'azione. Ogni altro hack tira una volta la Class TN.

**Le sottoclassi:**

- **Lo Scammer (INT / CHA):** ingegneria sociale e distrazione. Hack esclusivi: *Credentials Spoof* (le macchine ignorano te e un alleato, le guardie vi lasciano passare), *Data Loop / Strobe* (un bersaglio attacca a −4 TN) e *False Flag Broadcast* (un nemico attacca la propria parte).

- **Il Master (INT / WIS):** distruzione pesante delle reti. Hack esclusivi: *Feedback Loop (DDoS)* (3d6 ai sintetici, 2d6 ai cibernetici, ignorando l'armatura), *Overclock Pulse* (il prossimo hack istantaneo colpisce due volte) e *Logic Bomb* (3d6 quando il bersaglio si muove, 1d6 a chiunque sia adiacente).

> **Esempio di combattimento: l'Hacker (sottoclasse Master)**

> *Round 1:* il Master esegue *Ping Sweep* (1 RAM / 1 Heat): un drone da combattimento nascosto si accende sulla mappa, e la squadra ottiene +2 TN contro di lui fino a fine round. Poi *Keylogger Injection* (1 RAM bloccata / 2 Heat): il GM deve annunciare la prossima mossa del drone. Il drone agisce, il keylogger smaltisce 1 Heat, e il deck ne smaltisce un altro a fine round. Deck: 1 RAM bloccata, 1 Heat.

> *Round 2:* con 3 RAM libere, il Master lancia *Feedback Loop (DDoS)* (3 RAM / 4 Heat): il drone è sintetico, quindi 3d6 dritti attraverso l'armatura. L'Heat è a 5: il Master spende l'ultima azione in un *Thermal Dump* (nessun tiro, −3 Heat) e chiude il turno a 2.

### 7-4-3. Il Tech Wizard: Field Sync {#sec-7-4-techwiz}

Il Tech Wizard trasforma rottami, cavi e strutture in riparo per la squadra, o in armi. Mantiene una di due modalità, **Mend** (supporto) o **Surge** (offensiva), e accumula **Sync** (*Cold 0 → Warm 1 → Tuned 2 → Resonant 3*) più a lungo la mantiene: +1 per ogni ability usata, +1 alla fine di ogni round senza cambiare modalità. Cambiare è gratis ma azzera il Sync; perdere HP costa 1 Sync.

**La ricompensa — Resonant cast:** a Sync 3, la prossima ability può far scattare **entrambe le facce** (la barricata ripara un alleato *e* colpisce il nemico lì accanto), poi il Sync torna a 0.

**Il prezzo — Brownout:** *Structural Collapse* (richiede Resonant) azzera il Sync e manda il rig offline fino alla fine del round successivo.

**Le sottoclassi:**

- **Il Mechanic (CON / WIS):** fortificazioni da campo, riparazione delle armature e cure. Ha accesso esclusivo a *Fortify Position* e *Healing Surge*.

- **L'Engineer (DEX / WIS):** overclock delle armi, zone di shock e hardware automatizzato. Ha accesso esclusivo a *Targeted Overclock*, *Rig Power Conduit* e *Deploy Sentry*; condotti e torrette continuano ad agire a fine round senza spendere Sync.

> **Esempio di combattimento: il Tech Wizard (sottoclasse Mechanic)**

> *Round 1:* in **Mend** a Cold, il Mechanic usa *Field Maintenance* sul Soldier (2 incrinature dell'armatura riparate, Sync → Warm), poi *Scavenge & Survey* (Sync → Tuned). Il round finisce senza cambi: **Resonant**.

> *Round 2:* un nemico prende di fianco l'Hacker. Il Mechanic fa un **Resonant cast** di *Improvised Cover*: l'Hacker ottiene copertura parziale **e** la lamiera scagliata infligge 2d6 al nemico. Sync di nuovo a Cold, sempre in Mend.

> *Round 3:* lo Smuggler è inchiodato e serve potenza di fuoco, non cure. Passa a **Surge** (Sync 0) e ricomincia ad accumulare, oppure resta in Mend e risali fino a Resonant.

### 7-4-4. Lo Smuggler: l'Adrenaline Pendulum (da −4 a +4) {#sec-7-4-smuggler}

Lo Smuggler è un opportunista agile che prospera nel caos ad alto rischio: trasforma ferite, scampati pericoli e favori del mercato nero in slancio tattico. Invece di una riserva di energia, lo Smuggler cavalca uno spettro centrato sullo zero, l'**Adrenaline Pendulum**, che oscilla tra **Cold Calculation (−4)** e **Adrenaline Rush (+4)**.

**Come funziona lo spettro:**

- **Cold Calculation (da −4 a −1):** mani ferme e un piano. **+2 TN agli attacchi con armi da fuoco.** Sblocca le mosse di supporto: *Contraband Stash* (≤ −1), *Safehouse Route*, *Decoy Deployment*, *Black-Market Ammo* (≤ −2) e *Call in Favor* (≤ −3, una volta per combattimento).

- **Composure (0):** il punto neutro. Nessun bonus; solo *Street Snap-Shot* e *Bribe / Distraction*, che non richiedono nulla.

- **Adrenaline Rush (da +1 a +4):** sangue caldo. **+1 ai danni di ogni tiro e +1 quadretto per movimento.** Sblocca le mosse spericolate: *Pistol Whip & Rob* (≥ +1), *Adrenaline Rush* (≥ +2) e *Desperate Gamble* (≥ +3).

- **Elasticità:** il pendolo oscilla. Le mosse Cold in genere ti scaldano (*Call in Favor* +4), quelle Hot in genere ti raffreddano (*Adrenaline Rush* −3), e *Desperate Gamble* punta tutto, poi ti fa crollare a **−3**.

- **Dolore:** se uno Smuggler ferito ha subito danni durante il round, il pendolo sale di **+1 verso Adrenaline** a fine round (7-8).

La scheda applica i bonus di zona in automatico: la Attack TN delle armi da fuoco, i tiri di danni (indicati come "+1 Hot") e i quadretti sul pulsante Movimento.

**Le sottoclassi:**

- **Il Dealer (DEX / CHA):** pistolero da distanza ravvicinata e imbroglione di strada. Mosse esclusive: *Pistol Whip & Rob* (danni dell'arma senza munizioni, ruba un caricatore o un oggetto), *Adrenaline Rush* (scatto fino al doppio dei quadretti, niente attacchi di opportunità) e *Black-Market Ammo* (fino alla ricarica: ignora metà armatura o +1d6).

- **Il Trafficker (WIS / CHA):** navigatore fuori rete e coordinatore tattico. Mosse esclusive: *Safehouse Route* (sposta un alleato al sicuro, toglie Prone o Stunned), *Decoy Deployment* (i nemici attaccano prima l'esca) e *Call in Favor* (il round dopo: un colpo di cecchino da 3d6 o un razzo da 2d6 su un'area 3×3).

> **Esempio di combattimento: lo Smuggler (sottoclasse Dealer)**

> *Round 1:* il Dealer parte da 0, Composure. Spara uno *Street Snap-Shot* e si butta in copertura: il pendolo scende a −1, **Cold**. Il prossimo colpo normale è a +2 TN. Nel turno nemico il Dealer viene colpito ed è Wounded; il dolore spinge il pendolo di +1 a fine round, di nuovo a 0.

> *Round 2–3:* arriva un altro colpo e la ferita brucia: il Dealer inizia il round 3 a +1, **Hot**. *Pistol Whip & Rob* su una guardia adiacente (danni dell'arma +1 Hot, e un caricatore nuovo rubato) porta il pendolo a +3. Con almeno 3 colpi carichi il Dealer scatena *Desperate Gamble*: danni dell'arma a ogni nemico in un'area 3×3, caricatore vuoto, e il pendolo crolla a **−3**. Di nuovo Cold, e abbastanza lucido per un colpo preciso il round dopo.

### 7-4-5. Lo Scavenger: i Tell {#sec-7-4-scavenger}

Lo Scavenger trasforma l'attenzione in danno. I **Tell** stanno sui singoli nemici (massimo 3 ciascuno, su tanti nemici quanti l'ottica può tracciare) e si spendono su quel nemico.

- **Inizio del tuo turno:** piazza 1 Tell su un nemico che vedi, o 2 se sei Unseen (copertura totale e nessun attacco nel round precedente). La scheda ti ricorda quanti ne restano da piazzare.
- **Attaccare** (un attacco, o *Called Shot* / *Kill Shot*) significa che in questo round hai attaccato: il round dopo ne piazzi solo 1. *Vanish* (una volta per scontro) ti riporta in copertura totale e cancella questo effetto.
- **Exploit:** dopo che un attacco va a segno e i danni sono inseriti, la finestra del tiro chiede quale nemico hai colpito e quanti dei suoi Tell spendere: +1d4 ciascuno, tirati o inseriti, poi quei Tell spariscono.
- **Le abilità** costano Tell sul bersaglio: 1 per un piccolo vantaggio (*Mark*, *Lift*, *Misdirect*, *Pin the Route*), 2 per uno grosso (*Jam*, *Called Shot*, *Strip*), 3 per il colpo finale (*Kill Shot*). Come ogni abilità tirano la tua Class TN, e un tiro fallito paga comunque il costo.
- **Fine round:** togli i Tell di ogni nemico che hai perso di vista in questo round. I nemici che vanno a terra si portano via i loro Tell automaticamente.

> **Esempio di combattimento: lo Scavenger (sottoclasse Stalker)**

> *Round 1:* lo Stalker (Courier Visor, Track 3) parte in copertura totale dietro un container, Unseen: 2 Tell. Uno va sul mitragliere pesante (B), uno sul cecchino (C). Usa *Case the Room* per un'altra occhiata: 1 Tell in più ciascuno su B e C, e uno sulla guardia (A). B ora ne ha 2.

> *Round 2:* ancora Unseen (nessun attacco finora): altri 2 Tell su B, che arriva al massimo di 3. Lo Stalker si sporge e spara *Kill Shot* su B: 3 Tell spesi, danni dell'arma +3d4, copertura ignorata, armatura dimezzata. B va giù. Avendo attaccato, il round dopo ne piazzerebbe solo 1, quindi usa *Vanish* per tornare dietro il container, di nuovo Unseen.

## 7-5. Attacchi, danni, armatura e attacchi a una locazione {#sec-7-5}

Nel *Fractured Century* la risoluzione del combattimento è veloce, letale e senza ambiguità. Attacchi e ability di classe mettono alla prova la precisione tattica di un Operatore contro numeri bersaglio (TN) espliciti, con un flusso semplice: tiro, danni, armatura.

### 1. Risolvere l'attacco e i numeri bersaglio (TN)

Il modo di risolvere un'azione offensiva dipende dal fatto che l'Operatore stia facendo un normale attacco con un'arma o stia lanciando un payload di classe:

- **Attacchi normali con armi (da fuoco, in mischia, da lancio):** usano il **numero bersaglio (TN)** calcolato in automatico e mostrato sulla scheda dell'arma (per le armi a distanza) o derivato dall'abilità di combattimento corrispondente (*Melee / CQC*, *Brawling*, *Thrown Objects*).

- **Eseguire un'ability di classe:** quando lanci manovre offensive di classe, il tiro è contro il **Class TN** del personaggio (la media dei due attributi principali della sua sottoclasse), corretto per l'eventuale livello di difficoltà globale.

### 2. La sequenza dell'attacco normale (colpi al corpo in generale)

Quando un Operatore fa un attacco normale senza dichiarare una parte del corpo, si risolve in tre passi veloci:

- **Tiro d'attacco (d20):** tira un d20 contro il TN dell'arma o dell'abilità. Se `d20 ≤ TN effettivo`, l'attacco va a segno.

- **Tiro dei danni:** tira il dado di danno base dell'arma o dell'abilità (per esempio 2d6 + OFF).

**Applica i danni attraverso l'armatura:** la sottrazione avviene direttamente sui danni in arrivo.

**L'armatura generale serve solo a ridurre i danni: non rende più difficile colpire.** Sottrai l'**armatura generale** del bersaglio direttamente dai danni totali tirati. Il danno che resta si toglie direttamente dagli HP generali del bersaglio.

### 3. Attacchi a una locazione {#sec-7-5-location}

Invece di mirare al centro del corpo, puoi dichiarare un **attacco a una locazione** (*location attack*) prima di tirare: per azzoppare una gamba, rompere il braccio che impugna l'arma o mandare a terra una guardia. Le locazioni del corpo non hanno HP propri: decidono **quale condizione** aggiunge un colpo.

**Come si risolve:**

- **Dichiara e tira per colpire:** un attacco a una locazione è un'azione di attacco a **−4 TN**. Non si può combinare con le ability di classe.

- **Tira la locazione (d20):** se colpisci, tira un d20 sulla tabella qui sotto. Con **Mirare** (*Aim*, 1 azione in più spesa prima dell'attacco) puoi spostare quel d20 fino a ±5.

- **Tira i danni:** come sempre. I danni meno l'armatura del bersaglio tolgono HP: un attacco a una locazione non è mai più debole di uno normale.

- **Poi agisce la locazione:**
  - **Il danno ha superato l'armatura** (almeno 1 punto): il bersaglio subisce la condizione di quella locazione.
  - **L'armatura ha fermato tutto:** nessuna condizione, ma l'armatura del bersaglio **si incrina di 1** finché non viene riparata. La copertura non si incrina mai.

**Cosa fa ogni locazione:**

- **Testa:** *Stunned*, oppure *Incapacitated* se il colpo lascia il bersaglio a metà dei suoi HP massimi o meno.
- **Torace:** *Slowed*: lo shock costa 1 azione nel turno successivo.
- **Addome:** *Prone*: piegato in due, a terra.
- **Braccio:** *Broken arm*. Un braccio: puoi usare una sola arma a una mano (il deck da hacker funziona comunque). Entrambe le braccia: solo movimento, parlare e abilità mentali.
- **Gamba:** *Crippled leg*. Una gamba: metà dei quadretti per movimento. Entrambe le gambe: 1 quadretto per movimento.

Destra e sinistra contano separatamente. Braccia rotte e gambe azzoppate restano finché non vengono curate: **Primo soccorso** (1 azione, prova di *Medicine / First Aid*), un **Trauma Patch**, o il downtime. Una cura completa rimette a posto gli HP, non le ossa.

**I bersagli sintetici** (droni, torrette, robot) funzionano diversamente: gambe → mobilità azzoppata, braccia → supporto dell'arma *Jammed*, torace e addome → *Stunned*, testa (sensori) → *Blinded*. Alcuni **élite sono immuni** a una condizione (per esempio non possono essere buttati a terra): il colpo infligge comunque i suoi danni.

**Armatura incrinata:** gli attacchi normali non incrinano mai l'armatura. L'armatura si incrina solo quando ferma del tutto un attacco a una locazione, o quando un effetto lo dice (*Bunker Buster*, corrosione, *Field Maintenance* in Surge). **Ripara armatura** (nel downtime, o con *Field Maintenance* in Mend) sistema le incrinature.

> *Esempio:* il Soldier indossa 4 di armatura. Un ganger dichiara un attacco al suo torace e fa 3 danni: l'armatura regge e si incrina a 3. Al turno dopo il ganger ci riprova e fa 5: 2 punti passano, il Soldier perde 2 HP ed è **Slowed**. Intanto i colpi normali continuano a sbattere contro i suoi 3 di armatura.

> **Il ritocco tattico "Mirare":** spendi **1 azione in più** prima di un attacco a una locazione per **Mirare** (*Aim*): puoi spostare il d20 della locazione fino a ±5 (non il tiro d'attacco). *Esempio:* fai 15 (torace); mirando puoi portarlo a 19, la testa.

::table[hit-locations]

## 7-6. Condizioni {#sec-7-6}

Durante le operazioni ad alta posta, pericoli ambientali, ordigni pesanti, hack di rete e ability tattiche possono infliggere gravi **condizioni** a Operatori e nemici. Le condizioni alterano le capacità operative, il movimento o la precisione di un'entità finché non vengono rimosse.

Siccome questi effetti si applicano durante il combattimento, giocatori e GM possono tenere traccia delle condizioni attive nella scheda *Salute e condizioni* della sezione Gioco, sulla scheda del personaggio. La fonte più comune sono gli attacchi a una locazione (7-5): *Broken arm*, *Crippled leg*, *Prone*, *Slowed*, *Stunned* e *Incapacitated*.

**La scheda applica i numeri.** Le condizioni che cambiano un valore lo cambiano sulla scheda: *Stunned* e *Slowed* riducono le azioni del round, *Prone* dimezza i quadretti per movimento, *Blinded* toglie −10 TN ai tuoi attacchi, *Enraged* aggiunge +2 ai colpi in mischia (visibile nei danni). Un valore cambiato compare in **rosso** (peggio) o in **verde** (meglio), con quello normale piccolo accanto.

**Potenziamenti.** Sei condizioni positive che il GM (o la situazione) può concedere, da attivare a mano sulla scheda e che durano finché il GM non le termina, di solito alla fine della scena: *Overdrive* (+1 azione a ogni round), *Focused* (+2 TN agli attacchi), *Sharp* (+1 TN alle prove di abilità), *Fired Up* (+1 OFF), *Guarded* (+1 DEF) e *Bolstered* (+1 armatura).

**Tabella di riferimento: le condizioni**

::table[conditions]

## 7-7. La morte {#sec-7-7}

Nel *Fractured Century* il combattimento non perdona ed è altamente letale. Gli Operatori non hanno riserve di salute enormi e gonfiate: un solo errore tattico, una posizione sbagliata o un colpo di cecchino ben piazzato possono portare a menomazioni permanenti o alla morte immediata.

### 1. Cause letali e fallimento critico

Un Operatore o un PNG rischia la morte immediata o una grave menomazione operativa nelle seguenti condizioni fisiologiche:

- **Un attributo base a zero (collasso del sistema):** se un attributo base (per esempio Costituzione, Forza, Destrezza) scende temporaneamente a **0** per neurotossine potenti, feedback cibernetici estremi o debuff invalidanti, l'entità muore all'istante per collasso dell'organismo. È un evento raro e molto letale, che richiede un intervento immediato sul campo prima che l'attributo arrivi a zero.

- **Le locazioni del corpo non uccidono da sole:** un attacco a una locazione aggiunge una condizione (7-5), e un colpo alla testa può lasciarti *Incapacitated*, ma la morte arriva sempre dagli HP, qui sotto.

### 2. HP generali a zero e danno devastante

Quando gli **HP generali** di un Operatore scendono a **0 o meno**, crolla subito in stato di **Incapacitated / privo di sensi**.

- **Danno devastante (la soglia della CON negativa):** se un attacco porta gli HP generali sotto zero e il danno negativo rimanente raggiunge o supera il punteggio di **CON** dell'Operatore (per esempio con CON 12, subire abbastanza danni da arrivare a **−12 HP generali**), l'Operatore muore all'istante per il trauma devastante.

**Le prove di morte su CON:** all'inizio di ogni round in cui resta a 0 HP senza cure, l'Operatore privo di sensi deve fare una **prova di Costituzione (CON)**.

- **Primo fallimento:** l'Operatore resta in emorragia critica e instabile.

- **Secondo fallimento:** morte istantanea. L'Operatore soccombe ai traumi interni.

- **Subire danni da privo di sensi:** se un Operatore privo di sensi a 0 HP subisce altri danni da esplosioni ad area vaganti o colpi mirati, il danno si accumula direttamente verso la sua **soglia di CON negativa**. Raggiungerla significa morte immediata.

### 3. Stabilizzazione e rianimazione sul campo

I compagni di squadra possono strappare un compagno a terra all'orlo della morte in due modi:

- **Rianimazione d'emergenza con med-kit:** un alleato adiacente spende **1 azione** e consuma un normale *Med-Kit / Trauma Patch*. L'Operatore a terra si riprende all'istante, torna a **1 HP generale (stabile)** e resta sulla griglia in condizione **Prone**.

**Stabilizzazione manuale con il primo soccorso:** un alleato adiacente spende **1 azione** per tentare una **prova di Medicine / First Aid**.

- **Successo:** l'Operatore a terra è stabilizzato a **0 HP**. Resta **privo di sensi**, ma non deve più fare prove di morte su CON a meno che non subisca altri danni.

- **Fallimento:** il tentativo di stabilizzazione fallisce, l'azione è sprecata e il conto alla rovescia della morte continua.

## 7-8. Fine del turno e fine del round {#sec-7-8}

Nel *Fractured Century* il combattimento è una sequenza continua di turni tattici racchiusi in round globali. Quando tutti gli Operatori, le entità ostili e i droni automatici hanno speso le loro azioni, il Game Master ferma la scena per la **fine del round**. Questa fase di pulizia strutturata azzera le risorse tattiche, fa avanzare i pericoli in corso e mantiene lo slancio letale del gioco.

### 1. Fine del turno individuale

Subito dopo che un'entità ha finito di spendere le sue azioni nel proprio turno, prima di passare l'iniziativa al combattente successivo, si fanno questi passi:

- **Le azioni non spese si perdono:** le azioni non spese e non trattenute esplicitamente per la **difesa proattiva (schivata)** o l'**Overwatch** vanno perse. Non passano al round successivo.

- **Danni continui:** le entità colpite da **Poisoned / Corroded** o da campi di pericolo elettrico ancora attivi tirano e sottraggono adesso i danni continui.

### 2. Fine del round globale (la pulizia del sistema)

Quando tutti i combattenti nell'ordine d'iniziativa hanno agito, il GM risolve lo stato globale del campo e i motori di classe in quest'ordine preciso:

**Prove di morte ed emorragie:**

Ogni Operatore **Incapacitated / privo di sensi** a 0 HP e non stabilizzato deve fare la sua obbligatoria **prova di morte su CON**. Il secondo fallimento accumulato significa morte istantanea.

**Motori di classe e risorse:**

**L'Hacker (RAM e Heat):**

- **I payload sostenuti continuano:** i *payload sostenuti* attivi (per esempio *Keylogger Injection*, *Data Loop*) continuano a bloccare i loro slot di RAM sul deck. Ora l'Hacker può decidere di rilasciare volontariamente un payload per liberare RAM per il round successivo.

- **Raffreddamento passivo:** i deck che non sono in Blue Screen smaltiscono **−1 Heat**.

- **Blue Screen:** un deck che in questo round ha raggiunto l'heat cap perde tutti gli hack sostenuti, resta bloccato per tutto il round successivo, poi si riavvia a **cap − 3** di Heat. Un deck stordito da *System Hard Reboot* torna online.

**Il Tech Wizard (Field Sync):**

Un Tech Wizard che ha mantenuto la stessa modalità per tutto il round ottiene **+1 Sync** (massimo Resonant). Un rig in **Brownout** fa il conto alla rovescia: torna online alla fine del round successivo al crollo.

**Lo Smuggler (assestamento del pendolo):**

Se uno Smuggler Wounded ha subito danni durante il round, il suo **Adrenaline Pendulum** sale passivamente di **+1 verso Adrenaline Rush** per il dolore e il battito accelerato.

**Durata degli effetti ambientali e tattici:**

- **Barriere e trappole temporanee:** i pericoli schierati, le zone di shock elettrico (per esempio *Rig Power Conduit*) e gli effetti temporanei di fumo o flashbang riducono di 1 round il loro contatore di durata.

- **Condizioni che scadono:** le condizioni temporanee che durano "fino alla fine del round" (per esempio *Stunned*, agganci di mira o debuff di precisione) si rimuovono da sole.

**Ripristino delle azioni:**

Tutti gli Operatori e i PNG ricaricano le proprie azioni fino al loro valore base `ACTIONS / RD`, meno le azioni già spese fuori turno per la **difesa proattiva**. L'iniziativa riparte dall'inizio dell'ordine per il round successivo.
