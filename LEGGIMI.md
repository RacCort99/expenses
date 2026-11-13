# Expenses

App per spese, budget e risparmi. Funziona su PC e su telefono, anche offline. Tutto gratis.

## 1. Provarla sul PC

```bash
node serve.js
```

Poi apri http://localhost:5173.

Al primo avvio vai su **Impostazioni → Ripristina da file** e scegli `import/finance-import.json`. Contiene lo storico convertito dal tuo Excel.

> ⚠️ La cartella `import/` contiene i tuoi dati personali. È esclusa da Git tramite `.gitignore`, quindi non pubblicarla mai.

## 2. Pubblicarla online (GitHub Pages, gratis)

1. Crea un account su github.com e un repository nuovo, per esempio `expenses`. Può essere anche privato, ma GitHub Pages su un repo privato richiede un piano a pagamento, quindi usa un repo **pubblico**. Nel codice non ci sono dati: i tuoi dati restano solo sui tuoi dispositivi.
2. Carica i file di questa cartella **tranne** `import/`.
3. Vai in Settings → Pages → Branch `main` → Save.
4. Dopo un minuto l'app è su `https://TUO-UTENTE.github.io/expenses/`.

## 3. Installarla

- **Android:** apri l'indirizzo con Chrome, menu ⋮ → **Installa app**. Compare l'icona come un'app normale.
- **PC:** apri l'indirizzo con Chrome o Edge e clicca l'icona "Installa" nella barra degli indirizzi.
- **APK vero e proprio (facoltativo):** vai su https://www.pwabuilder.com, incolla l'indirizzo, scegli **Android → Generate package** e installa l'APK che scarichi. Non serve il Play Store.

## 4. Sincronizzazione automatica tra PC e telefono (gratis)

L'app salva i dati su Google Drive tramite un piccolo script Google tutto tuo. Non serve la Google Cloud Console.

**Sul primo dispositivo (es. il PC, dove hai già i dati):**

1. Apri **Impostazioni → Prima configurazione** e premi **Copia il codice**. Il codice contiene già una chiave segreta generata per te.
2. Apri https://script.google.com, crea un nuovo progetto, cancella quello che c'è e incolla.
3. **Esegui il deployment → Nuovo deployment**, tipo **App web**, *Esegui come: Me*, *Chi ha accesso: Chiunque*.
4. Autorizza con il tuo account Google. Se compare "App non verificata": *Avanzate → Vai a … (non sicuro)*. È il tuo script.
5. Copia l'**URL dell'app web** e incollalo nell'app, poi premi **Collega**.

**Sugli altri dispositivi (es. il telefono):**

1. Sul PC: **Impostazioni → Copia link per un altro dispositivo**.
2. Manda il link a te stesso (per esempio nei *Messaggi salvati* di Telegram) e aprilo sul telefono. Si collega da solo e scarica tutto.

Da quel momento:

- ogni modifica viene caricata su Drive in automatico;
- gli altri dispositivi la ricevono quando li apri, e ogni 2 minuti se l'app resta aperta;
- se due dispositivi cambiano cose diverse nello stesso momento, vengono tenute entrambe;
- ogni giorno resta una copia nella cartella **Expenses backup** del tuo Drive (ultimi 60 giorni).

Il pallino verde sull'icona Impostazioni indica che la sincronizzazione è attiva: arancione mentre sincronizza, rosso se c'è un problema.

> ⚠️ Il link di collegamento contiene la chiave: chi lo ha può leggere i tuoi dati. Mandalo solo a te stesso.

## 5. Prestiti

Nella sezione **Prestiti** tieni traccia dei debiti (soldi che devi restituire) e dei crediti (soldi che ti devono), con il piano delle rate.

- Per caricare quelli del tuo Excel: **Prestiti → Importa prestiti da file** e scegli . Basta farlo su un dispositivo: arrivano anche sugli altri con la sincronizzazione.
- **✓ Pagata** sulla scheda segna la prossima rata. Nel dettaglio puoi spuntare le singole rate, cambiare date e importi, aggiungere rate e segnare in un colpo tutte quelle scadute.
- Se attivi **Registra le rate tra le spese**, ogni rata segnata crea anche un movimento (categoria *Prestiti & Rate* per i debiti, *Altre entrate* per i crediti). Attenzione a non avere anche una spesa ricorrente per la stessa rata, altrimenti la conti due volte.
- Il numero rosso sull'icona Prestiti indica le rate scadute non ancora segnate.

## Aggiornare l'app

Dopo aver modificato i file, cambia `VERSION` in `sw.js`, così i dispositivi scaricano la versione nuova.
