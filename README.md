# Discord Timer Bot

Ein einfacher Discord-Bot, mit dem du Timer setzen kannst, die dir bei Ablauf **eine Direktnachricht (DM)** schicken.  
Unterstützt **Dauer** (Minuten/Stunden/Tage) und **Uhrzeiten** (`HH:MM`).  
Speichert Timer in einer SQLite-Datenbank und verschickt auch überfällige DMs, wenn der Bot zwischenzeitlich offline war.

---

## 🚀 Installation in deinem Discord

[**➡ Bot zu Discord hinzufügen**](https://discord.com/oauth2/authorize?client_id=1405944058886488104)

Der Bot unterstützt **User-Install**:  
Du kannst ihn in **dein Benutzerkonto** oder in **einen Server** installieren.

---

## 🛠 Nutzung

### Befehl: `/timer`

Setzt einen neuen Timer.

**Syntax:**

/timer dauer:<Dauer oder Uhrzeit> kommentar:<optional>


**Parameter:**
- **dauer** (Pflicht):  
  - **Minuten**: `60` → 60 Minuten  
  - **Stunden**: `2h` → 2 Stunden  
  - **Tage**: `1d` → 1 Tag  
  - **Kombiniert**: `1d5h` → 1 Tag, 5 Stunden  
  - **Uhrzeit**: `20:30` → nächster Termin um 20:30 Uhr  
- **kommentar** (optional): Frei wählbarer Text, wird in der DM mit angezeigt.

**Beispiele:**
/timer dauer:90 kommentar:Pause
/timer dauer:2h
/timer dauer:1d5h kommentar:Projekt Deadline
/timer dauer:20:30 kommentar:Meeting

⏰ Timer abgelaufen!
Fällig: 15. August 2025 um 20:30 Uhr (in 2 Stunden)
📝 Projekt Deadline
📍 Ausgeführt in #general


---

## 💾 Datenhaltung

- Alle Timer werden in **SQLite** unter `timers.db` gespeichert (Pfad per `TIMER_DB_PATH` änderbar).
- Zeitangaben werden als **Unix-Timestamps (Sekunden)** gespeichert.
- Falls der Bot beim Ablauf offline ist, werden die DMs beim nächsten Start verschickt.

---

## 🔧 Selbst hosten

1. Repository klonen oder Code herunterladen
2. Node.js 18+ installieren
3. Abhängigkeiten installieren:
   ```bash
   npm install
