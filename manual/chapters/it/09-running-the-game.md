# Condurre il gioco {#ch-9}

## 9. Dietro lo schermo

Questo capitolo è per il Game Master. Copre le regole che tocca a te applicare, come funzionano al tavolo e dove si trovano nella **console del GM** (la pagina `/gm/` che il server del tavolo apre per te). Ogni sezione segue lo stesso ordine: **la regola**, **come si gioca**, **nella console**. Dove le due cose coincidono, sono unite.

L'app è una scheda di carta intelligente per tutti, GM compreso. Fa i conti e ricorda cosa è successo; non conduce il gioco. Ogni numero che mostra può essere scavalcato da te, e ogni strumento della console che cambia una scheda si può annullare. La console è in inglese: i nomi dei pulsanti qui restano quelli che vedi sullo schermo.

## 9-1. Prima di tutto, divertirsi {#sec-9-1}

**La regola.** Il lavoro del GM è una bella serata al tavolo, non una simulazione corretta. Le regole servono a dare peso alle scelte e a rendere sorprendenti i risultati. Quando una regola si mette di traverso, cambi la decisione e si continua a giocare. I giocatori non devono mai sentire che l'arbitro è l'app: sei tu.

**Come si gioca.** Guarda il tavolo, non solo lo schermo. Segnali che una scena non funziona:

- telefoni in mano, chiacchiere a parte, lo stesso giocatore che parla da venti minuti;
- un combattimento oltre il quarto round in cui non è cambiato niente tranne gli HP;
- tre tiri falliti sulla stessa porta senza aver scoperto niente di nuovo;
- un giocatore rimasto zitto tutta la sera.

Quasi sempre il problema è la scena, non i dadi. L'incontro che hai preparato può essere troppo lungo, troppo piatto o troppo duro. Cambialo mentre si gioca:

- **Chiudi un combattimento già deciso.** I nemici si arrendono, scappano, chiedono una tregua o semplicemente cedono. Racconta il rastrellamento invece di tirarlo.
- **Riduci una catena di tiri a uno solo.** Tutta una serratura, tutta una scalata, tutta una perquisizione: una prova, e il margine dice quanto è andata bene.
- **Fallisci in avanti.** Anche un fallimento manda avanti la storia: la porta si apre ma scatta l'allarme, l'indizio si trova ma qualcuno vi ha visti (6-3).
- **Sposta la difficoltà.** I livelli più facili servono a questo (9-4): aiuto, tempo, attrezzi buoni.
- **Passa la scena a qualcun altro.** Chiedi al giocatore silenzioso cosa nota il suo personaggio; la scheda Explore ti dice in cosa è bravo (9-5).

**Gli interventi sono tuoi.** Sono tutti nella console, e nessuno ha bisogno di una scusa:

- la **difficoltà** di un tiro o di tutto il tavolo (9-4);
- **i tuoi dadi e le tue note**, fuori dalle regole (*🎲 Roll / note*, 9-4);
- **annullare** un'azione di un giocatore, un round o un combattimento intero (9-14);
- **accettare o annullare** le modifiche a una scheda (9-3);
- **regalare** talenti, XP, oggetti e pezzi unici (9-11, 9-13);
- **nascondere, rivelare, spostare** qualsiasi cosa sulla mappa (9-8).

> **Prima di tutto, divertirsi: cosa non vuol dire.** Non vuol dire ritirare ogni fallimento o salvare ogni personaggio. Fallimenti, costi e perdite sono ciò che rende meritato un successo, e i giocatori si accorgono quando niente può andare storto. Usa gli interventi per sistemare *la serata* (una scena che si trascina, una regola che ha fatto cilecca, un pulsante sbagliato), non per togliere il rischio. Una buona prova: il tavolo ti ringrazierebbe, se ti vedesse farlo?

## 9-2. Aprire il tavolo {#sec-9-2}

**Come funziona.** Il tavolo dal vivo gira da un computer sul Wi-Fi della stanza. `npm run table` avvia il server e stampa due cose: l'**indirizzo** che i giocatori aprono sui tablet e la **chiave del GM**. Apri `/gm/` sul tuo portatile e inserisci la chiave. Non serve internet.

I giocatori aprono l'indirizzo, caricano il personaggio e toccano **Unisciti al tavolo** nella scheda (Dossier). Da quel momento la loro scheda ti manda il suo stato dopo ogni azione e riceve i tuoi messaggi, la difficoltà, la luce, l'ordine di combattimento e la mappa.

**Nella console — scheda Table.**

- **Schede dei giocatori** — una per ogni personaggio collegato: HP, armatura, condizioni e ferite, il motore di classe, le armi pronte, le azioni del round, livello e XP, contanti e CRS, il debito, le ultime righe del registro.
- **Messaggio a un giocatore** — il campo in fondo a ogni scheda. I messaggi aspettano in una casella finché la scheda non li ha mostrati, così anche un tablet in standby li riceve.
- **Tell everyone** — la barra in alto; *Refresh* chiede a ogni scheda di rimandare il suo stato.
- **Sit out** — nasconde un personaggio e lo tiene fuori dai combattimenti (un giocatore entrato con la scheda sbagliata, qualcuno andato via prima). Finisce in **Not playing now**, insieme ai personaggi offline; *Bring back* lo riporta.
- **Table log** — ogni azione, tiro e acquisto, in tempo reale. La 📌 nella scheda Story fissa una riga nel registro della sessione (9-9).

Le schede emettono un suono discreto quando inizia il turno di un giocatore, quando mandi qualcosa e quando vengono colpite. Ogni giocatore lo spegne sul proprio dispositivo.

## 9-3. Il controllo delle schede {#sec-9-3}

**La regola.** I giocatori sono padroni delle loro schede, e un browser non può impedire a nessuno di modificarne una. Quindi la console non blocca le modifiche: le **nota**.

**Come si gioca.** Le modifiche di gioco — HP, munizioni, condizioni, risorse di classe, appunti — passano sempre. Le modifiche alle **fondamenta** — attributi, CRS, contanti, inventario, credenziali, classe, XP, talenti — vengono confrontate con il registro della scheda stessa. Un acquisto spiega i contanti spesi; un regalo spiega l'oggetto. Quello che il registro non spiega viene **segnalato**.

**Nella console.** Una scheda segnalata mostra **Unexplained changes**: cosa è cambiato, da cosa a cosa. *Accept* lo rende il nuovo riferimento; *Revert* rimanda il vecchio valore alla scheda. Ogni istantanea resta sul disco (`local/table/history/`), quindi non si perde mai niente.

> **Prima di tutto, divertirsi.** Una segnalazione è quasi sempre un errore: un refuso in un attributo, un acquisto di prova, un giocatore che sistema qualcosa che gli avevi chiesto di sistemare. Chiedi prima, ad alta voce e con gentilezza. Il controllo esiste perché nessuno debba avere dubbi, non per beccare qualcuno.

## 9-4. Prove, difficoltà e luce {#sec-9-4}

**La regola.** Ogni prova è un d20 da fare **sotto** un numero bersaglio (TN): il TN dell'abilità o dell'attributo, cambiato da un solo **livello di difficoltà** per tutta la situazione (6-2). I livelli più difficili abbassano il TN; quelli più facili — **Favourable +2, Easy +4, Very easy +6** — lo alzano. L'aiuto non è una regola a parte: un aiutante è Favourable, due persone che si danno una spinta è Easy, tutta la squadra con l'attrezzatura giusta è Very easy. Un solo livello, mai sommato, e tira solo chi agisce. Mancare di 1 può essere un successo con un costo; un 1 o un 20 naturale aggiunge qualcosa che racconta il GM. Prove contrapposte e passive sono in 6-2.

**Come si gioca.** Chiedi un tiro solo quando fallire sarebbe interessante. Aprire una porta non chiusa, comprare il pranzo, sapere quello che la propria carriera ti ha insegnato: niente tiro. Quando lo chiedi, di' il livello ad alta voce, o impostalo per tutto il tavolo.

La scheda conta già quello che il giocatore porta con sé: gli attrezzi compaiono come caselle da spuntare (ne conta uno), oggetti attivi e stimolanti compaiono come *In gioco*, e al buio una riga *Luce* suggerisce l'opzione giusta (7-2 §4). L'ultima parola su tutte e tre è tua: "il set da scasso non serve con un lettore di badge" lo decidi tu.

**Nella console — scheda Table, riga in alto.**

- **Table difficulty** — Off, oppure un livello da *Very easy +6* al più duro. Compare su ogni scheda come avviso ed è già scelto in ogni finestra del tiro finché non lo spegni. Per un tiro solo, di' al giocatore quale livello scegliere.
- **Light** — *Bright* / *Dark* per le prove quando sul tavolo non c'è una mappa. Con una mappa decide il quadretto di ogni giocatore (9-8).
- **🎲 Roll / note** (intestazione della console) — i tuoi dadi e le tue note, fuori dalle regole: qualsiasi espressione (`3d6+2`), un TN facoltativo da fare sotto, *About* (un giocatore o un PNG) e una nota. *Log* scrive una riga nel registro della sessione della missione in corso. Usalo per tiri segreti, prove dei PNG, tabelle casuali, o solo per ricordarti qualcosa detto al tavolo. Alle schede non arriva niente.

> **Prima di tutto, divertirsi.** Se tutto il piano dipende da un solo tiro, rendilo più facile o fai in modo che il fallimento apra un'altra porta. Un colpo che muore su una prova di Sleight of Hand al cancello d'ingresso è una serata corta.

## 9-5. Esplorazione e riflettori {#sec-9-5}

**La regola.** Fuori dal combattimento il gioco va per intenzione e mezzi (6-3): il giocatore dice cosa vuole e come; tu nomini l'abilità e il livello; i dadi decidono quanto bene va. Il tempo è una risorsa (l'orologio operativo, 6-1); la preparazione prima di un colpo (il round zero, 6-4) guadagna vantaggi per lo scontro che verrà. Le serrature seguono la 5-3: meccanica → Sleight of Hand, elettronica → Electronics / Security, in rete → Computers / Hacking, oppure STR per forzarla.

**Nella console — scheda Explore.** Un promemoria per tutto quello che non è un combattimento:

- **Who's best at…** — tutte le abilità affiancate per i personaggi che stanno giocando, con il TN migliore evidenziato. Quando nessuno sa chi dovrebbe provarci, lo sai tu.
- **Per personaggio** — il debito, i tratti notevoli, le credenziali, il percorso di vita e la storia. Sono i tuoi agganci: un contatto della carriera, un creditore del debito, un luogo della giovinezza.

> **Prima di tutto, divertirsi.** Dai a ogni giocatore un momento in cui il *suo* personaggio è quello giusto per il lavoro. La scheda Explore ti fa vedere subito chi non l'ha ancora avuto.

## 9-6. Condurre un combattimento {#sec-9-6}

**La regola.** Tutti tirano **d20 + INIT** una volta; l'ordine resta per tutto il combattimento (7-1). Chi vuole può *rimandare* (Delay) alla fine del round. Ogni turno ha un certo numero di azioni (mostrate su ogni scheda e su ogni scheda nemico): muoversi, attaccare, ability, ricaricare, interagire, mirare e così via (7-3). Gli attacchi nemici si tirano esattamente come quelli dei giocatori: d20 sotto il TN dell'attacco, danni meno l'armatura del bersaglio, colpi localizzati a −4 TN con una condizione se il danno passa (7-5). I giocatori non vedono mai le statistiche dei nemici: le loro schede mostrano un ordine anonimo e l'elenco **Hostiles** — lettera, il nome che dai tu, una fascia di ferite (Unhurt, Hurt, Bloodied, Down) e le condizioni visibili.

**Nella console — scheda Combat.**

1. **Preparazione.** *New encounter*. Cerca nella libreria dei nemici (il capitolo 10 la mostra come collezione), scegli quante copie e *Add*; oppure compila la riga personalizzata (nome, HP, armatura, azioni, INIT, un attacco). I giocatori collegati che non sono in *Sit out* entrano da soli.
2. **Iniziativa.** *Roll missing initiative* tira per chi non ha ancora un tiro; scrivi il d20 dei giocatori che hanno tirato al tavolo. *Re-roll all* se devi ricominciare.
3. **Start combat.** Le schede ricevono l'ordine e l'avviso del proprio turno.
4. **Turni.** *Now acting* mostra di chi è il turno. Segna ognuno come *Done* (in qualsiasi ordine); *Delay* sposta qualcuno in fondo al round; *Next turn ▶* va avanti.
5. **End round.** Esegue la fine round di ogni scheda: i motori di classe avanzano, gli effetti a tempo scalano, le condizioni si chiudono.
6. **End combat** quando è finita. *Clear defeated* fa pulizia a metà scontro.

**Schede dei nemici.**

- **Players see** — il nome pubblico ("Guardia in rosso"); la lettera è assegnata da sola e mai riusata. *Hide* tiene un nemico (un'imboscata, un cecchino) fuori dall'ordine e dall'elenco Hostiles dei giocatori finché non lo riveli.
- **HP** — scrivi il danno che ti dice un giocatore e scegli dove è arrivato (colpo normale, oppure ⌖ testa / petto / addome / braccio / gamba per un colpo localizzato: la condizione si aggiunge da sola); l'armatura si sottrae, a meno che spunti *ignore armor*. *Crack armor −1* quando un colpo localizzato viene fermato del tutto.
- I pallini **ACT** tengono il conto delle azioni del nemico nel round.
- **Pulsanti d'attacco** — attacco normale o colpo localizzato: la console tira il colpo; *Send hit* manda i danni (e la locazione) alla scheda del bersaglio, dove si applica la sua armatura.
- **Ferite e condizioni** — tocca per impostarle; compaiono nell'elenco Hostiles dei giocatori.
- **Sees in the dark** — visione notturna o termica: il buio non nasconde nessuno a quel nemico (7-2 §4).
- **Notes** — posizione, bersaglio, trucchi. Qui compaiono anche i **Tells** di uno Scavenger su quel nemico.

**Il misuratore di sfida** stima quanto è duro lo scontro dai danni per round delle due parti, dall'armatura e dagli HP: **Easy, Fair, Hard, Deadly**, con delle note ("armatura che nessuno riesce a passare", "rischio di KO in un round"). Ignora ability, coperture e tattica, quindi prendilo come un primo parere. Il giudizio all'inizio dello scontro decide anche gli XP di pericolo (9-11).

**↶ Undo** nel tracker annulla le tue ultime modifiche (circa 15) e viene annunciato al tavolo con "The GM took back their last move" — senza nomi, così i nemici nascosti restano nascosti.

> **Prima di tutto, divertirsi.** Il misuratore non vede la stanza. Se uno scontro Deadly dopo due round è una fatica, il morale dei nemici crolla; se uno Easy finisce in un turno e i giocatori si annoiano, arrivano rinforzi. Uno scontro finisce quando ha avuto risposta la sua domanda — chi controlla la stanza, hanno preso i dati? — non quando è finito l'ultimo HP.

## 9-7. Costruire le mappe {#sec-9-7}

**La regola.** Le mappe tattiche usano quadretti di **1,5 m** (7-2). Muri e porte chiuse bloccano movimento e vista; porte aperte e finestre lasciano passare la vista; gli oggetti possono bloccare la vista, dare copertura o rendere il terreno difficile (2 quadretti per quadretto).

**Nella console — scheda Maps.** Un editor per le mappe da mettere sul tavolo:

- **Muri** in tre spessori, **porte** e **finestre** sulle linee della griglia; aggancio alla griglia attivabile. Una porta può partire aperta, chiusa o **chiusa a chiave** (la serratura non viene mai mostrata ai giocatori).
- **La libreria** — mobili, casse, terminali, veicoli, coperture, pavimenti, scale e ascensori, divisi in gruppi e cercabili. Ogni pezzo dice il suo ingombro e cosa blocca; *Turn* lo ruota.
- **Pezzi nascosti** (*Hidden (GM only)*) — bottino da trovare cercando, una trappola, una porta segreta: piazzati ora, rivelati in gioco.
- **Sicurezza** — sensori, raggi laser e tastierini d'allarme, solo per il GM; luci accendibili e spegnibili; casseforti a muro che si aprono.
- **Luce** — l'ambiente della mappa, *Bright* o *Dark*, e le **zone d'oscurità** per gli angoli bui di una mappa illuminata.
- **Save**, *Duplicate*, *Export file*. Le mappe si salvano in `local/gm/maps/`; non viene pubblicato niente.

> **Prima di tutto, divertirsi.** Una mappa è un palcoscenico, non un rompicapo. Costruisci le stanze dove succederà qualcosa e racconta il resto. Dieci minuti su una buona mappa valgono più di un'ora su una mappa perfetta.

## 9-8. La mappa sul tavolo {#sec-9-8}

**La regola.** Movimento, linea di vista e portata seguono la 7-2. La mappa *informa*; tu *decidi*. Linea di vista e portata mostrate su un tablet sono una guida: coperture e casi particolari li confermi tu.

**Come si gioca.** I giocatori vedono una scheda **Mappa** finché c'è una mappa sul tavolo (7-2 §5). Vedono quello che la loro squadra vede ora, e ricordano quello che hanno visto. Trascinano il proprio segnalino: libero fuori dal combattimento; in combattimento un'azione di Movimento dà i quadretti del round. Aprono e chiudono le porte accanto a loro (un'azione Interagisci in combattimento). Una porta chiusa a chiave resta chiusa: a loro viene detto che è chiusa a chiave, a te arriva una nota che ci hanno provato. Torce, bengala e visori funzionano da soli.

**Nella console — scheda Deploy.**

- **Mettere una mappa sul tavolo** — scegli una mappa salvata; il tracker dei turni le sta accanto.
- **Not on the map** — giocatori e nemici da piazzare: tocca uno, poi un quadretto. Trascina i segnalini per spostarli; tocca un segnalino e poi un altro per controllare la vista.
- **Players move their markers: on / off** — lascia che i giocatori trascinino i propri segnalini, oppure muovi tu tutti quanti. In combattimento la console ricontrolla ogni movimento con i quadretti e il turno del giocatore.
- **Fog of war & light** — nebbia *On* oppure *Off — they see everything*; *Reveal all*, *Reset*, e *Edit squares* per rivelare un quadretto a mano (una planimetria comprata, una telecamera). *Bright* / *Dark* cambia l'ambiente dal vivo.
- **Pezzi** — toccane uno per rivelarlo, nasconderlo di nuovo, accenderlo o spegnerlo (luci, sensori, laser), aprire o chiudere a chiave una porta, o toglierlo per questa sessione. La mappa salvata tiene il suo stato iniziale.
- **NPCs** — scegli un ruolo (impiegato, addetto, guardia…) e *+ Add*: i giocatori vedono *Worker 1* finché non lo rinomini con un nome vero. Ogni PNG ha una nota privata per te.
- **Marks** — i giocatori si indicano le cose nel proprio colore (un mirino, una freccia, un punto di domanda, una linea a mano libera, 7-2 §5); spariscono dopo due minuti, a meno che non vengano tenuti. Scegli uno strumento per disegnare i tuoi, in ambra ("lo senti arrivare da *qui*"); in modalità segni, un tocco su qualsiasi segno lo toglie; *Clear all* pulisce tutto. I segni non vengono mai salvati e non toccano le regole; spariscono quando la mappa lascia il tavolo.
- **Take the map off the table** quando la scena finisce.

> **Prima di tutto, divertirsi.** Se mappa e storia non vanno d'accordo, vince la storia: sposta il segnalino, apri la porta, rivela la stanza. Se un giocatore fa fatica a trascinare, muovi tu il suo segnalino. La mappa serve a chiudere le discussioni, non ad aprirle.

## 9-9. Missioni, registro della sessione e fazioni {#sec-9-9}

**Come funziona.** La **scheda Story** è il quaderno della campagna, salvato sul tuo computer (`local/gm/campaign.json`) e mai pubblicato.

- **Missioni** — titolo, codice, **obiettivi** (primari e secondari, segnati come riusciti o falliti), **capitoli** per le scene (*Next chapter ▶*), le zone coinvolte.
- **Notable NPCs** — condivisi tra le missioni, con il loro stato.
- **Threats** — nemici preparati; *→ Combat* li manda al tracker.
- **Session log** — 15 righe per pagina; tutto quello che scrivi, ogni *🎲 Roll / note* e ogni riga che fissi con 📌 da **At the table** (il registro del tavolo dal vivo).
- **Handouts** — immagini da `local/gm/handouts/`: scegline una, spunta chi la riceve (o *Everyone*), aggiungi una didascalia. Arriva sulle schede come un messaggio.
- **Prompt per l'IA** — *Build prompt* scrive un riepilogo della missione (dal registro e dagli obiettivi) o una bozza per la prossima, da incollare nella tua IA. *Save to campaign story* tiene il riepilogo nella storia della campagna.

**Fazioni.** La regola: ogni potere ha una posizione da **−3 Hostile** a **+3 Patron** (−2 Watched, −1 Wary, 0 Neutral, +1 Friendly, +2 Allied). Si sposta di 1, sempre con un motivo, dentro un minimo e un massimo che decidi tu ("non si fideranno mai di una squadra che ha colpito il loro deposito"). In gioco decide chi risponde a una chiamata, cosa rischia un contatto, chi si presenta senza invito. Nella console sta sotto la campagna; le modifiche finiscono nel registro della sessione, e i prompt per l'IA riportano le posizioni. I giocatori non la vedono mai.

## 9-10. La squadra e l'Unity {#sec-9-10}

**La regola.** La squadra ha un'unica **traccia Crew** condivisa da 0 a 10 (si parte da 5). Misura **se agiscono insieme, mai se il gesto era giusto** (6-6). +1 quando la squadra si impegna insieme in una scelta costosa o rischiosa, o quando li vedi coprirsi a vicenda; −1 quando un giocatore scavalca una squadra che si era opposta. Fasce: Broken 0, Fractured 1–3, Steady 4–6, Tight 7–10.

**Unity Check.** Quando un personaggio vuole fare qualcosa che la squadra potrebbe non appoggiare — uccidere il testimone, accettare l'accordo sottobanco — se ne parla, poi apri una prova. Tutti tranne chi agisce votano in segreto sulla propria scheda: *Appoggio*, *Mi oppongo*, *Mi astengo*. Tu vedi chi ha votato cosa; il tavolo vede solo il conteggio. Chi agisce decide sempre; la traccia lo registra.

**Drive.** Ogni personaggio ha un Drive — Justice o Ambition — e una frase con parole sue. È una bussola, mai un punteggio. Seguirlo pagando un prezzo vero è un buon motivo per dare XP di Spotlight.

**Nella console — scheda Table, Crew & Unity.** La traccia con *+1 intent* e *−1*; *Open Unity Check* (chi agisce e cosa vuole fare), *Reveal the tally*, poi *Backed together +1*, *Override −1* o *No change · close*. Si può anche votare a voce: registra solo il risultato.

## 9-11. Esperienza e livelli {#sec-9-11}

**La regola.** Niente XP per uccisione. Per missione, ogni giocatore presente riceve:

- **3** per un obiettivo primario raggiunto, **1** per un secondario, **1** per un obiettivo fallito (si impara anche così);
- **+1** per essere sopravvissuto a uno scontro giudicato Hard, **+2** per uno Deadly (il giudizio all'inizio dello scontro);
- **+1 Spotlight** da te, al massimo una o due volte per giocatore a sessione: una grande scena, un prezzo vero pagato per il proprio Drive.

**10 XP fanno un livello**: un punto talento a ogni livello, +1 a un attributo ai livelli pari, uno slot ability in più al 3, al 6 e al 9 (5-9). I giocatori spendono i livelli solo quando apri il level-up — di solito nel downtime, in un posto tranquillo.

**Nella console.**

- **Mission XP** (scheda Story) — i totali per giocatore da obiettivi, pericolo e spotlight; *Award* li manda una volta per missione.
- **Open level-up for everyone** / *Close level-up* (scheda Table), oppure per un solo giocatore sulla sua scheda.
- **Gift** un talento dalla scheda del giocatore: gratis, senza prerequisiti. Usalo per le ricompense di storia — l'addestramento con un veterano, un debito ripagato in natura.

## 9-12. Downtime e debito {#sec-9-12}

**La regola.** Tra una missione e l'altra, in un posto tranquillo, il tempo passa (5-10). Le ferite guariscono e l'armatura si ripara. Le spese dello stile di vita vengono **mostrate, non addebitate**: le sistema il tavolo. La **pressione del debito** di ogni personaggio sale di 1 (0–3): Squeeze, Escalation, poi **Crisis**, che è un aggancio per una missione. Una rata o una soluzione nella storia la abbassano.

**Come si gioca.** Ogni personaggio riceve un **evento di storia** — la visita di un creditore, un vecchio contatto, un momento tranquillo — e la squadra può riceverne uno insieme. Gli eventi sono narrativi: le loro opzioni compaiono come scelte, l'app non le applica mai. Tu e il giocatore decidete cosa succede.

**Nella console — scheda Story → Downtime.** Scegli la durata. Per ogni giocatore la console suggerisce degli eventi con una **percentuale di affinità** e i motivi (il debito e la sua fase, la carriera, la giovinezza, lo stato attuale, il mondo); quelli usati di recente sbiadiscono. Scegli, modifica, cambia, scrivi il tuo o salta; aggiungi un evento per la squadra; apri il level-up se vuoi; invia. Ogni scheda si rimette in sesto da sola, alza la pressione, aggiunge l'evento a *La storia finora* e mostra un resoconto. Imposta la pressione a mano dalla scheda del giocatore quando la storia fa calare un debito.

## 9-13. Bottino, la Forgia e le storie {#sec-9-13}

**Prezzi di strada.** L'equipaggiamento comprato in via ufficiale costa Credit Score (tracciato); per strada costa contanti con un ricarico da **×3 a ×10** (non tracciato). Il giocatore sceglie il ricarico nella finestra d'acquisto — tu gli dici quale: ×3 da un ricettatore amico, ×10 per un fucile la sera prima di un colpo. L'equipaggiamento più raro si trova solo per strada.

**La Forgia (scheda Admin).** Per il ritrovamento unico: scegli un tipo e un oggetto di base, cambia i suoi numeri, aggiungi bonus mentre è in uso (qualsiasi attributo o abilità, armatura, azioni, OFF, DEF, iniziativa), una nota di una riga, un valore oppure *can't be fenced*, e *Forge & send* al giocatore che l'ha trovato. Sulla sua scheda compare in viola e mantiene le sue statistiche anche se viene regalato. Gli oggetti forgiati restano per essere riusati (*Forged so far*).

**Le storie (scheda Admin).** I giocatori possono chiederti di scrivere o rifinire la loro storia dalla creazione o dal Dossier. Le richieste aspettano qui; aggiungi una nota per ciascuna (agganci, legami con la campagna). In Claude Code, `/backstories` scrive quelle in attesa; tu leggi, modifichi e invii. Al giocatore non arriva niente finché non lo mandi tu.

> **Prima di tutto, divertirsi.** Il bottino è storia. Un oggetto unico funziona meglio con un nome, un passato e una nota — "l'impugnatura è avvolta nella sciarpa di un corriere morto" — e un piccolo bonus. Un +5 è un problema risolto; un +1 con una storia è un argomento di conversazione.

## 9-14. Errori, annullamenti e archivio {#sec-9-14}

**La regola.** I giocatori non annullano mai le proprie schede: chiedono, e decidi tu.

**Nella console.**

- **↶ Undo…** sulla scheda di un giocatore — *Last action*, *This round*, *Whole combat*, oppure indietro fino a prima di una qualsiasi riga del suo registro. La scheda torna all'istantanea presa subito prima; i tiri restano nel registro. Ogni annullamento finisce nell'**Undo log** (scheda Table), con un conteggio su ogni scheda, così il tavolo vede che è stato giusto.
- **↶ Undo** nel tracker del combattimento per le tue modifiche, annunciato al tavolo (9-6).
- **Scheda Admin** — personaggi, missioni e registri di sessione sul disco. *Archive* mette da parte un personaggio o una missione finiti; *Restore* li riporta; *Inspect* li legge. Non si cancella mai niente, e ogni azione chiede conferma.

> **Prima di tutto, divertirsi.** Annullare serve per gli errori: un pulsante sbagliato, una regola letta male, danni applicati due volte, un combattimento iniziato troppo presto. Serve anche per il raro momento in cui i dadi producono qualcosa che nessuno al tavolo vuole: un personaggio che muore per un proiettile vagante in una scena che non contava. Quello usalo con parsimonia e alla luce del sole. Di' al tavolo che lo stai facendo e perché: allora è un regalo, non un imbroglio.
