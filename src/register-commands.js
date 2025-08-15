// src/register-commands.js
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

/**
 * Registriert einen globalen Slash-Command für User- und Guild-Install.
 * Wichtig: integration_types & contexts erlauben Nutzung in User-DMs/GDMs/Guilds.
 * Docs: Application Commands & User-Installable Apps.
 */

const commands = [
  {
    name: 'timer',
    description: 'Stellt einen Timer (Dauer oder Uhrzeit HH:MM) und schickt dir eine DM, wenn er abläuft.',
    // 0 = GUILD_INSTALL, 1 = USER_INSTALL
    integration_types: [0, 1],
    // 0 = Guild, 1 = Bot DM, 2 = Private Channel (Group DM)
    contexts: [0, 1, 2],
    options: [
      {
        type: 3, // STRING
        name: 'dauer',
        description: 'z.B. 90, 2h, 1d5h oder Uhrzeit wie 20:30',
        required: true,
      },
      {
        type: 3, // STRING
        name: 'kommentar',
        description: 'Optionaler Kommentar',
        required: false,
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registriere (/) Commands global …');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Fertig: Commands registriert.');
  } catch (error) {
    console.error('❌ Fehler beim Registrieren:', error);
    process.exit(1);
  }
})();
