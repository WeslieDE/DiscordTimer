// src/index.js
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  PermissionFlagsBits
} from 'discord.js';
import Database from 'better-sqlite3';

// === SQLite Setup ===
const dbPath = process.env.TIMER_DB_PATH || 'timers.db';
const db = new Database(dbPath);
db.exec(`
CREATE TABLE IF NOT EXISTS timers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  comment TEXT,
  end_at INTEGER NOT NULL,      -- Unix Timestamp (Sekunden)
  created_at INTEGER NOT NULL,  -- Unix Timestamp (Sekunden)
  notified INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_timers_due ON timers (end_at, notified);
`);

// Migration: channel_id hinzufügen (falls noch nicht vorhanden)
try {
  db.exec(`ALTER TABLE timers ADD COLUMN channel_id TEXT;`);
} catch (e) {
  // Ignorieren, wenn Spalte bereits existiert
}

const insertTimer = db.prepare(`
  INSERT INTO timers (user_id, channel_id, comment, end_at, created_at, notified)
  VALUES (@user_id, @channel_id, @comment, @end_at, @created_at, 0)
`);

const fetchDue = db.prepare(`
  SELECT id, user_id, channel_id, comment, end_at FROM timers
  WHERE notified = 0 AND end_at <= @now
  ORDER BY end_at ASC
  LIMIT 100
`);

const markNotified = db.prepare(`
  UPDATE timers SET notified = 1 WHERE id = @id
`);

// === Discord Client ===
// Für DMs brauchen wir DirectMessages-Intent und Partials.Channel
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel],
});

// === Zeit-Parser ===
// Unterstützt: Zahl ohne Einheit = Minuten
// Einheiten: m (Minuten), h (Stunden), d (Tage), beliebig kombinierbar (z.B. 1d5h30m)
function parseDurationToSeconds(inputRaw) {
  const input = String(inputRaw).trim().toLowerCase();

  // Reine Zahl => Minuten
  if (/^\d+$/.test(input)) {
    const minutes = parseInt(input, 10);
    if (minutes <= 0) return 0;
    return minutes * 60;
  }

  // Kombiniert: z.B. 1d5h, 2h30m, 1d, 45m
  const regex = /(\d+)\s*([dhm])/g;
  let match;
  let totalSeconds = 0;
  let found = false;

  while ((match = regex.exec(input)) !== null) {
    found = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    if (value <= 0) continue;

    switch (unit) {
      case 'd':
        totalSeconds += value * 24 * 60 * 60;
        break;
      case 'h':
        totalSeconds += value * 60 * 60;
        break;
      case 'm':
        totalSeconds += value * 60;
        break;
      default:
        // ignoriert — sollte nicht auftreten
        break;
    }
  }

  return found ? totalSeconds : 0;
}

// === Neu: Uhrzeit "HH:MM" auf nächsten Zeitpunkt in lokaler Zeit mappen ===
function parseClockToEndAt(inputRaw) {
  const s = String(inputRaw).trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;

  let hours = parseInt(m[1], 10);
  let minutes = parseInt(m[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );

  // Wenn Zielzeit heute bereits vorbei ist -> morgen
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return Math.floor(target.getTime() / 1000); // Unix Sekunden
}


// Formatiert Sekunden hübsch (z.B. "1d 5h 30m")
function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  seconds %= 86400;
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;
  const m = Math.floor(seconds / 60);

  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

// === Timer prüfen & DMs schicken ===
async function processDueTimers() {
  const nowSec = Math.floor(Date.now() / 1000);
  const rows = fetchDue.all({ now: nowSec });

  for (const row of rows) {
    try {
      const user = await client.users.fetch(row.user_id);
      const when = `<t:${row.end_at}:F>`;        // Vollformat
      const rel = `<t:${row.end_at}:R>`;         // relativ
      const note = row.comment ? `\n📝 ${row.comment}` : '';

      const channelInfo = row.channel_id
        ? `\n📍 Ausgeführt in <#${row.channel_id}>`
        : '';

      await user.send({
        content: `⏰ **Timer abgelaufen!**\nFällig: ${when} (${rel})${note}${channelInfo}`
      });

      markNotified.run({ id: row.id });
    } catch (err) {
      // Kann passieren, wenn DMs deaktiviert sind — wir lassen den Timer markiert,
      // damit wir den User nicht spam'en. Optional: Log ausgeben.
      console.error(`DM fehlgeschlagen (user ${row.user_id}, timer ${row.id}):`, err.message);
      // Du könntest hier alternativ NICHT als notified markieren, um später erneut zu versuchen.
      markNotified.run({ id: row.id }); // aktuell markieren wir als zugestellt/versucht
    }
  }
}

// === Events ===
client.once(Events.ClientReady, async () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);

  // Beim Start sofort "überfällige" Timer abarbeiten
  await processDueTimers();

  // Danach regelmäßig prüfen (alle 10s)
  setInterval(processDueTimers, 10_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'timer') return;

  const durationStr = interaction.options.getString('dauer', true);
  const comment = interaction.options.getString('kommentar') || null;

  // 1) Versuche Uhrzeit HH:MM
  let endAtSec = parseClockToEndAt(durationStr);

  if (!endAtSec) {
    // 2) Sonst Dauer-Parsing wie gehabt
    const seconds = parseDurationToSeconds(durationStr);
    if (!seconds || seconds < 60) {
      return interaction.reply({
        content:
          'Bitte gib eine gültige Dauer **oder** Uhrzeit an. Beispiele: `60`, `2h`, `1d5h`, `45m`, **`20:30`** (nächster Termin). Mindestdauer bei relativ: 1 Minute.',
        ephemeral: true,
      });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    endAtSec = nowSec + seconds;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  insertTimer.run({
    user_id: interaction.user.id,
    channel_id: interaction.channelId, // <- neu: Channel speichern
    comment,
    end_at: endAtSec,
    created_at: nowSec
  });

  const when = `<t:${endAtSec}:F>`;
  const rel  = `<t:${endAtSec}:R>`;

  await interaction.reply({
    content: `✅ Timer gesetzt — fällig **${when}** (${rel}). Ich schicke dir dann eine DM.${comment ? `\n📝 ${comment}` : ''}`,
    ephemeral: true
  });
});


client.login(process.env.DISCORD_TOKEN);
