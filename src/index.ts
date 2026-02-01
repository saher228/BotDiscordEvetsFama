import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  ActivityType,
} from 'discord.js';
import { loadEvents, getEventByMessageId, setEvent, getActiveEvents } from './store';
import { normalizeTime } from './utils/time';
import { EPHEMERAL, MESSAGE_TTL_MS, scheduleMessageDelete } from './constants';
import { buildEventEmbed, buildActionRows } from './utils/embeds';
import { data as eventCommandData, execute as eventCommandExecute } from './commands/createEvent';
import {
  handleModalSubmit,
  handleButton,
  handleSelectMenu,
} from './handlers/interactions';
import { logger } from './logger';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  logger.error('DISCORD_BOT_TOKEN не задан в .env');
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

const activity = process.env.BOT_STATUS_ACTIVITY || 'Семья San La Murte';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  presence: {
    status: 'idle',
    activities: [{ name: activity, type: ActivityType.Watching }],
  },
});

loadEvents();

client.once(Events.ClientReady, async (c) => {
  logger.log(`Бот готов: ${c.user.tag}`);

  const rest = new REST().setToken(token!);
  const commands = [eventCommandData.toJSON()];
  try {
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId || c.user.id, guildId),
        { body: commands }
      );
      const guild = await c.guilds.fetch(guildId);
      logger.log(`Команды зарегистрированы для сервера: ${guild.name}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId || c.user.id), {
        body: commands,
      });
      logger.log('Команды зарегистрированы глобально');
    }
  } catch (e) {
    logger.error('Ошибка регистрации команд', e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'event') {
        await eventCommandExecute(interaction);
      }
      return;
    }
    if (interaction.isModalSubmit()) {
      const c = interaction.customId;
      const isOurModal = c.startsWith('event_configure_modal_') || c.startsWith('event_reschedule_modal_') || c.startsWith('event_timer_modal_') || c === 'event_create_modal_1' || c === 'event_create_modal_2';
      if (isOurModal) {
        try {
          await interaction.deferReply(c === 'event_create_modal_2' ? {} : { flags: EPHEMERAL });
        } catch (deferErr: unknown) {
          const code = (deferErr as { code?: number })?.code;
          const isNetwork = (deferErr as { code?: string })?.code === 'UND_ERR_SOCKET' || (deferErr as Error)?.message?.includes('other side closed');
          if (isNetwork) {
            try { await interaction.deferReply(c === 'event_create_modal_2' ? {} : { flags: EPHEMERAL }); } catch { throw deferErr; }
          } else {
            throw deferErr;
          }
        }
      }
      await handleModalSubmit(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
      return;
    }
  } catch (err) {
    const apiCode = (err as { code?: number })?.code;
    if (apiCode === 10062) {
      logger.error(`Взаимодействие истекло (10062). Возможная причина: сеть или ответ позже 3 сек.`, err);
      return;
    }
    logger.error(`Ошибка обработки взаимодействия: ${interaction.type}`, err);
    if (interaction.isRepliable() && !interaction.replied && apiCode !== 10062) {
      try {
        await interaction.reply({
          content: 'Произошла ошибка. Попробуйте позже.',
          flags: EPHEMERAL,
        });
      } catch {
        // ignore
      }
    }
  }
});

client.on(Events.Error, (err) => {
  logger.error('Discord client error', err);
});

setInterval(async () => {
  const now = new Date();
  const moscowOffset = 3 * 60;
  const utcOffset = now.getTimezoneOffset();
  const moscowTime = new Date(now.getTime() + (moscowOffset + utcOffset) * 60000);
  const currentHHMM = `${String(moscowTime.getHours()).padStart(2, '0')}:${String(moscowTime.getMinutes()).padStart(2, '0')}`;

  const events = getActiveEvents();
  const pingRoleId = process.env.DISCORD_EVENT_PING_ROLE_ID?.trim();
  if (!pingRoleId) return;

  for (const event of events) {
    if (event.notified) continue;
    if (normalizeTime(event.time) !== currentHHMM) continue;

    event.notified = true;
    setEvent(event);

    try {
      const channel = await client.channels.fetch(event.channelId);
      if (!channel?.isTextBased() || !('send' in channel)) continue;

      const location = event.location || 'место сбора';
      const groupCode = event.group ? `\n**КОД ГРУППЫ: ${event.group}**` : '';
      const m = await channel.send({
        content: `<@&${pingRoleId}> **ВСЕ, КТО В СПИСКЕ, СТАКАЕМСЯ НА ${location.toUpperCase()}. ${groupCode}**`,
      });
      scheduleMessageDelete(m, MESSAGE_TTL_MS);
    } catch (e) {
      logger.error('Ошибка отправки напоминания', e);
    }
  }
}, 15 * 1000);

setInterval(async () => {
  const events = getActiveEvents();
  for (const event of events) {
    if (!event.messageId) continue;
    try {
      const channel = await client.channels.fetch(event.channelId);
      if (!channel?.isTextBased() || !('messages' in channel)) continue;
      const msg = await channel.messages.fetch(event.messageId).catch(() => null);
      if (!msg) continue;
      const embed = buildEventEmbed(event);
      const rows = buildActionRows(event.id);
      await msg.edit({ embeds: [embed], components: rows }).catch(() => {});
    } catch (_) {}
  }
}, 60 * 1000);

client.on(Events.MessageDelete, async (message) => {
  if (!message.id) return;
  const event = getEventByMessageId(message.id);
  if (!event || event.status !== 'active') return;
  try {
    const channel = message.channel;
    if (!channel?.isTextBased() || !('send' in channel)) return;
    const embed = buildEventEmbed(event);
    const rows = buildActionRows(event.id);
    const msg = await channel.send({ embeds: [embed], components: rows });
    event.messageId = msg.id;
    setEvent(event);
  } catch (e) {
    logger.error('Не удалось восстановить сообщение ивента', e);
  }
});

client.login(token);
