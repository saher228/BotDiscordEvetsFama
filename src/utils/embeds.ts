import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { EventData } from '../types';
import { formatTimeDisplay } from './time';

const COLOR_MAP: Record<string, number> = {
  purple: parseInt(process.env.EMBED_COLOR_PURPLE || '9B59B6', 16),
  green: parseInt(process.env.EMBED_COLOR_GREEN || '57B99D', 16),
  red: parseInt(process.env.EMBED_COLOR_RED || 'ED4245', 16),
  grey: parseInt(process.env.EMBED_COLOR_GREY || '4F545C', 16),
};

function getEmbedBarColor(colorText?: string): number {
  if (!colorText) return COLOR_MAP.purple;
  const key = colorText.trim().toLowerCase();
  if (COLOR_MAP[key] != null) return COLOR_MAP[key];
  return COLOR_MAP.purple;
}

export function buildEventEmbed(event: EventData): EmbedBuilder {
  const color = getEmbedBarColor(event.color);
  const rosterList = event.mainRoster
    .map((id, i) => `${i + 1}. <@${id}>`)
    .join('\n') || '-';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(event.name);

  const fields: { name: string; value: string; inline: boolean }[] = [];

  if (event.server && event.server.trim()) {
    fields.push({ name: '・Сервер:', value: event.server.trim(), inline: true });
  }
  fields.push({ name: '・Лимит участников:', value: String(event.participantLimit), inline: true });
  fields.push({ name: '・Время:', value: formatTimeDisplay(event.time), inline: true });

  if (event.location) {
    fields.push({ name: '・Место:', value: event.location, inline: true });
  }
  if (event.group) {
    fields.push({ name: '・Группа:', value: event.group, inline: true });
  }
  if (event.map) {
    fields.push({ name: '・Карта:', value: event.map, inline: true });
  }
  if (event.color && event.color.trim()) {
    fields.push({ name: '・Цвет:', value: event.color.trim(), inline: true });
  }

  fields.push({ name: '・Создатель:', value: `<@${event.creatorId}>`, inline: true });

  fields.push({
    name: `Основной состав | ${event.mainRoster.length}/${event.participantLimit} человек`,
    value: rosterList,
    inline: false,
  });

  embed.addFields(fields);
  embed.setFooter({ text: `ID: ${event.id}` });
  embed.setTimestamp();

  return embed;
}

export function getCompletionTitle(event: EventData): string {
  const base = `МЕРОПРИЯТИЕ ${event.name} ЗАВЕРШЕНО!`;
  if (event.completionType === 'success') return `${base} С УСПЕХОМ ✨`;
  if (event.completionType === 'failure') return `${base} С ПРОВАЛОМ 😔`;
  return base;
}

export function buildCompletedEventEmbed(event: EventData): EmbedBuilder {
  const color = getEmbedBarColor(event.color);
  const rosterList = event.mainRoster
    .map((id, i) => `${i + 1}. <@${id}>`)
    .join('\n') || '-';
  const gratitude = process.env.EVENT_GRATITUDE_MESSAGE || 'Спасибо за участие в мероприятии!';
  const title = getCompletionTitle(event);
  const titleSafe = title.length > 256 ? title.slice(0, 253) + '…' : title;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(titleSafe)
    .setFooter({ text: `${gratitude} | ID: ${event.id}` })
    .setTimestamp();

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (event.server && event.server.trim()) {
    fields.push({ name: '・Сервер:', value: event.server.trim(), inline: true });
  }
  fields.push({ name: '・Лимит участников:', value: String(event.participantLimit), inline: true });
  fields.push({ name: '・Время:', value: formatTimeDisplay(event.time), inline: true });
  if (event.location) fields.push({ name: '・Место:', value: event.location, inline: true });
  if (event.group) fields.push({ name: '・Группа:', value: event.group, inline: true });
  if (event.map) fields.push({ name: '・Карта:', value: event.map, inline: true });
  if (event.color && event.color.trim()) fields.push({ name: '・Цвет:', value: event.color.trim(), inline: true });
  fields.push({ name: '・Создатель:', value: `<@${event.creatorId}>`, inline: true });
  fields.push({
    name: `Основной состав | ${event.mainRoster.length}/${event.participantLimit} человек`,
    value: rosterList,
    inline: false,
  });
  embed.addFields(fields);
  return embed;
}

export function buildCompleteSelectMenu(eventId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`event_complete_type_${eventId}`)
    .setPlaceholder('Выберите способ завершения')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Мероприятие завершили с успехом! ✨')
        .setValue('success')
        .setDescription('Успешное завершение'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Мероприятие завершили с провалом 😔')
        .setValue('failure')
        .setDescription('Завершение с провалом'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Завершить')
        .setValue('complete')
        .setDescription('Просто завершить.')
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export function buildActionRows(eventId: string): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rejectBtn = new ButtonBuilder()
    .setCustomId(`event_reject_${eventId}`)
    .setLabel('Откинуть +')
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`event_cancel_${eventId}`)
    .setLabel('Отменить запись')
    .setStyle(ButtonStyle.Danger);

  const pingBtn = new ButtonBuilder()
    .setCustomId(`event_ping_${eventId}`)
    .setLabel('ПИНГ!')
    .setStyle(ButtonStyle.Primary);

  const completeBtn = new ButtonBuilder()
    .setCustomId(`event_complete_${eventId}`)
    .setLabel('Завершить')
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    rejectBtn,
    cancelBtn,
    pingBtn,
    completeBtn
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`event_lists_${eventId}`)
    .setPlaceholder('Взаимодействие со списками')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Перенести')
        .setValue('reschedule')
        .setDescription('Перенести время мероприятия'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Исключить участника из списка')
        .setValue('exclude_participant')
        .setDescription('Убрать участника из основного состава'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Настроить ивент')
        .setValue('configure_event')
        .setDescription('Изменить параметры мероприятия'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Установить таймер')
        .setValue('set_timer')
        .setDescription('Обратный отсчёт до напоминания (минуты)')
    );

  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  return [row1, row2];
}

export async function buildExcludeParticipantSelect(
  event: EventData,
  guild: { members: { fetch: (id: string) => Promise<{ user: { username: string }; displayName: string }> } }
): Promise<ActionRowBuilder<StringSelectMenuBuilder> | null> {
  if (event.mainRoster.length === 0) return null;
  const options: StringSelectMenuOptionBuilder[] = [];
  for (const userId of event.mainRoster.slice(0, 25)) {
    let label = 'Участник';
    try {
      const member = await guild.members.fetch(userId);
      label = member.displayName || member.user.username;
      if (label.length > 100) label = label.slice(0, 97) + '…';
    } catch {
      label = `Участник ${userId.slice(-4)}`;
    }
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(userId)
        .setDescription('Исключить из состава')
    );
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId(`event_exclude_${event.id}`)
    .setPlaceholder('Выберите участника для исключения')
    .addOptions(options);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}
