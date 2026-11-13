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

I dati sono salvati separatamente su ogni dispositivo. Per passarli da uno all'altro usa il backup: lo salvi da un dispositivo e lo ripristini sull'altro.

## 4. Attivare il backup su Google Drive (gratis, una volta sola)

1. Vai su https://console.cloud.google.com e crea un progetto, per esempio "Expenses".
2. **API e servizi → Libreria**: cerca "Google Drive API" e clicca **Abilita**.
3. **Schermata consenso OAuth**: tipo *Esterno*, inserisci nome app e la tua email. Nella sezione *Utenti di test* aggiungi il tuo indirizzo Gmail.
4. **Credenziali → Crea credenziali → ID client OAuth**, tipo *Applicazione web*. In *Origini JavaScript autorizzate* aggiungi:
   - `http://localhost:5173`
   - `https://TUO-UTENTE.github.io`
5. Copia l'**ID client** (finisce con `.apps.googleusercontent.com`) e incollalo in **Impostazioni → Google Client ID** nell'app.

Da quel momento hai i pulsanti **Salva su Drive** e **Ripristina da Drive**. L'app può vedere solo il file `expenses-backup.json` che crea lei, nient'altro del tuo Drive.

Finché l'app resta in modalità "test", Google mostra un avviso del tipo "app non verificata": è normale, clicca *Continua*.

## Aggiornare l'app

Dopo aver modificato i file, cambia `VERSION` in `sw.js`, così i dispositivi scaricano la versione nuova.
