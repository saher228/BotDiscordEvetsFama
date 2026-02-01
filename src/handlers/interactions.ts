import {
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getEvent,
  setEvent,
  deleteEvent,
  generateEventId,
} from '../store';
import { EPHEMERAL } from '../constants';
import { EventData } from '../types';
import { buildEventEmbed, buildActionRows, buildCompletedEventEmbed, buildCompleteSelectMenu, buildExcludeParticipantSelect, getCompletionTitle } from '../utils/embeds';
import { isAdmin } from '../utils/admin';
import { normalizeTime, formatTimeDisplay } from '../utils/time';
import { GuildMember } from 'discord.js';

const pendingCreates = new Map<string, { name: string; server: string; time: string; participantLimit: number; location: string }>();
const pendingConfigure = new Map<string, { eventId: string; name: string; server: string; time: string; participantLimit: number; location: string }>();

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith('event_configure_modal_2_')) {
    const eventId = customId.replace('event_configure_modal_2_', '');
    const event = getEvent(eventId);
    const userId = interaction.user.id;
    const pending = pendingConfigure.get(userId);
    pendingConfigure.delete(userId);
    if (!event || !pending || pending.eventId !== eventId) {
      await interaction.editReply({
        content: 'Мероприятие не найдено или сессия настройки истекла. Заполните форму заново.',
      });
      return;
    }
    const colorRaw = interaction.fields.getTextInputValue('configure_color')?.trim() || '';
    const group = interaction.fields.getTextInputValue('configure_group')?.trim() || '';
    const map = interaction.fields.getTextInputValue('configure_map')?.trim() || '';

    const oldTime = event.time;
    event.name = pending.name;
    event.server = pending.server?.trim() || undefined;
    event.time = normalizeTime(pending.time);
    event.notified = false;
    event.participantLimit = pending.participantLimit;
    event.location = pending.location || undefined;
    event.group = group || undefined;
    event.map = map || undefined;
    event.color = colorRaw || undefined;
    event.colorSetByUser = colorRaw.length > 0 || event.colorSetByUser;
    setEvent(event);

    const embed = buildEventEmbed(event);
    const rows = buildActionRows(event.id);
    const pingRoleId = process.env.DISCORD_EVENT_PING_ROLE_ID?.trim();
    const messageContent = pingRoleId ? `<@&${pingRoleId}> Новое мероприятие **${event.name}**!` : undefined;
    await interaction.editReply({
      content: `Мероприятие обновлено: **${event.name}**`,
    });
    try {
      const channel = await interaction.client.channels.fetch(event.channelId);
      if (channel?.isTextBased() && 'messages' in channel && event.messageId) {
        const msg = await channel.messages.fetch(event.messageId);
        await msg.edit({ content: messageContent ?? undefined, embeds: [embed], components: rows });
      }
      if (pingRoleId && oldTime !== event.time) {
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send({
            content: `<@&${pingRoleId}> **ПЕРЕНОС ВРЕМЕНИ НА ${formatTimeDisplay(event.time)}**`,
          });
        }
      }
    } catch (_) {}
    return;
  }

  if (customId.startsWith('event_configure_modal_1_')) {
    const eventId = customId.replace('event_configure_modal_1_', '');
    const event = getEvent(eventId);
    if (!event) {
      await interaction.editReply({ content: 'Мероприятие не найдено.' });
      return;
    }
    if (interaction.guild) {
      const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);
      if (!await isAdmin(member, interaction.user.id)) {
        await interaction.editReply({ content: 'Только администраторы могут настраивать мероприятие.' });
        return;
      }
    }
    const name = interaction.fields.getTextInputValue('configure_name');
    const server = interaction.fields.getTextInputValue('configure_server')?.trim() || '';
    const time = normalizeTime(interaction.fields.getTextInputValue('configure_time'));
    const limitStr = interaction.fields.getTextInputValue('configure_participant_limit');
    const location = interaction.fields.getTextInputValue('configure_location')?.trim() || '';
    const limit = Math.max(1, parseInt(limitStr, 10) || event.participantLimit);

    pendingConfigure.set(interaction.user.id, { eventId, name, server, time, participantLimit: limit, location });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`event_configure_step2_${eventId}`)
        .setLabel('Указать цвет, группу и карту')
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.editReply({
      content: 'Данные сохранены. Нажмите кнопку ниже, чтобы указать цвет, группу и карту.',
      components: [row],
    });
    return;
  }

  if (customId.startsWith('event_reschedule_modal_')) {
    const eventId = customId.replace('event_reschedule_modal_', '');
    const event = getEvent(eventId);
    if (!event) {
      await interaction.editReply({ content: 'Мероприятие не найдено.' });
      return;
    }
    const newTime = normalizeTime(interaction.fields.getTextInputValue('new_time'));
    event.time = newTime;
    event.notified = false;
    setEvent(event);
    const embed = buildEventEmbed(event);
    const rows = buildActionRows(event.id);
    await interaction.editReply({
      content: `Время мероприятия обновлено на **${newTime}**`,
    });
    try {
      const msg = await interaction.channel?.messages.fetch(event.messageId!);
      if (msg) await msg.edit({ embeds: [embed], components: rows });
    } catch (_) {}
    const pingRoleId = process.env.DISCORD_EVENT_PING_ROLE_ID?.trim();
    if (pingRoleId) {
      try {
        const channel = await interaction.client.channels.fetch(event.channelId);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send({
            content: `<@&${pingRoleId}> **ПЕРЕНОС ВРЕМЕНИ НА ${formatTimeDisplay(newTime)}**`,
          });
        }
      } catch (_) {}
    }
    return;
  }

  if (customId === 'event_create_modal_1') {
    const name = interaction.fields.getTextInputValue('event_name');
    const server = interaction.fields.getTextInputValue('event_server')?.trim() || '';
    const time = normalizeTime(interaction.fields.getTextInputValue('event_time'));
    const limitStr = interaction.fields.getTextInputValue('event_participant_limit');
    const location = interaction.fields.getTextInputValue('event_location')?.trim() || '';
    const limit = Math.max(1, parseInt(limitStr, 10) || 35);

    pendingCreates.set(interaction.user.id, { name, server, time, participantLimit: limit, location });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('event_create_step2')
        .setLabel('Указать цвет, группу и карту')
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.editReply({
      content: 'Данные сохранены. Нажмите кнопку ниже, чтобы указать цвет, группу и карту.',
      components: [row],
    });
    return;
  }

  if (customId === 'event_create_modal_2') {
    const userId = interaction.user.id;
    const pending = pendingCreates.get(userId);
    pendingCreates.delete(userId);
    if (!pending) {
      await interaction.editReply({
        content: 'Сессия создания истекла. Заполните форму заново через /event create.',
      });
      return;
    }
    const colorRaw = interaction.fields.getTextInputValue('event_color')?.trim() || '';
    const group = interaction.fields.getTextInputValue('event_group')?.trim() || '';
    const map = interaction.fields.getTextInputValue('event_map')?.trim() || '';
    const colorSetByUser = colorRaw.length > 0;

    const event: EventData = {
      id: generateEventId(),
      name: pending.name,
      server: pending.server?.trim() || undefined,
      participantLimit: pending.participantLimit,
      color: colorRaw || undefined,
      colorSetByUser,
      group: group || undefined,
      time: pending.time,
      map: map || undefined,
      location: pending.location || undefined,
      creatorId: userId,
      mainRoster: [],
      reserveList: [],
      rejected: [],
      status: 'active',
      channelId: interaction.channelId!,
      createdAt: Date.now(),
    };

    setEvent(event);

    const embed = buildEventEmbed(event);
    const rows = buildActionRows(event.id);

    const pingRoleId = process.env.DISCORD_EVENT_PING_ROLE_ID?.trim();
    const content = pingRoleId ? `<@&${pingRoleId}> Новое мероприятие **${event.name}**!` : undefined;

    await interaction.editReply({
      content: content ?? undefined,
      embeds: [embed],
      components: rows,
    });
    const msg = await interaction.fetchReply();
    event.messageId = msg.id;
    setEvent(event);
    return;
  }
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === 'event_create_step2') {
    const modal = new ModalBuilder()
      .setCustomId('event_create_modal_2')
      .setTitle('Создание мероприятия (шаг 2/2)');
    const colorInput = new TextInputBuilder()
      .setCustomId('event_color')
      .setLabel('Цвет / дресс-код')
      .setPlaceholder('фиолетовый, purple, быть в фиолетовой одежде')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    const groupInput = new TextInputBuilder()
      .setCustomId('event_group')
      .setLabel('Код группы')
      .setPlaceholder('ABC123')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    const mapInput = new TextInputBuilder()
      .setCustomId('event_map')
      .setLabel('Карта')
      .setPlaceholder('Название карты')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(groupInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(mapInput)
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId.startsWith('event_configure_step2_')) {
    const eventId = interaction.customId.replace('event_configure_step2_', '');
    const event = getEvent(eventId);
    if (!event) {
      await interaction.deferReply({ flags: EPHEMERAL });
      await interaction.editReply({ content: 'Мероприятие не найдено или удалено.' });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId(`event_configure_modal_2_${event.id}`)
      .setTitle('Настройка мероприятия (шаг 2/2)');
    const colorInput = new TextInputBuilder()
      .setCustomId('configure_color')
      .setLabel('Цвет / дресс-код')
      .setStyle(TextInputStyle.Short)
      .setValue(event.color || '')
      .setRequired(false);
    const groupInput = new TextInputBuilder()
      .setCustomId('configure_group')
      .setLabel('Код группы')
      .setStyle(TextInputStyle.Short)
      .setValue(event.group || '')
      .setRequired(false);
    const mapInput = new TextInputBuilder()
      .setCustomId('configure_map')
      .setLabel('Карта')
      .setStyle(TextInputStyle.Short)
      .setValue(event.map || '')
      .setRequired(false);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(groupInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(mapInput)
    );
    await interaction.showModal(modal);
    return;
  }

  const [action, , eventId] = interaction.customId.split('_');
  if (action !== 'event' || !eventId) return;

  await interaction.deferReply({ flags: EPHEMERAL });

  const event = getEvent(eventId);
  if (!event) {
    await interaction.editReply({
      content: 'Мероприятие не найдено или удалено.',
    });
    return;
  }

  if (event.status !== 'active') {
    await interaction.editReply({
      content: 'Мероприятие уже завершено или отменено.',
    });
    return;
  }

  const userId = interaction.user.id;

  if (interaction.customId.startsWith('event_reject_')) {
    if (event.mainRoster.includes(userId)) {
      await interaction.editReply({
        content: 'Вы уже в основном составе.',
      });
      return;
    }
    if (event.mainRoster.length >= event.participantLimit) {
      await interaction.editReply({
        content: 'Основной состав заполнен.',
      });
      return;
    }
    event.mainRoster.push(userId);
    setEvent(event);
    await interaction.editReply({
      content: 'Вы добавлены в основной состав!',
    });
  } else if (interaction.customId.startsWith('event_cancel_')) {
    const inMain = event.mainRoster.indexOf(userId);
    if (inMain >= 0) {
      event.mainRoster.splice(inMain, 1);
      setEvent(event);
      await interaction.editReply({
        content: 'Ваша запись отменена.',
      });
    } else {
      await interaction.editReply({
        content: 'Вы не записаны на мероприятие.',
      });
      return;
    }
  } else if (interaction.customId.startsWith('event_complete_')) {
    if (!interaction.guild) {
      await interaction.editReply({ content: 'Ошибка.' });
      return;
    }
    const member = interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(userId);
    if (!await isAdmin(member, userId)) {
      await interaction.editReply({
        content: 'Только администраторы могут завершать мероприятие.',
      });
      return;
    }
    await interaction.editReply({
      content: 'Выберите способ завершения:',
      components: [buildCompleteSelectMenu(event.id)],
    });
    return;
  }

  if (event.status === 'active') {
    const embed = buildEventEmbed(event);
    const rows = buildActionRows(event.id);
    try {
      await interaction.message.edit({ embeds: [embed], components: rows });
    } catch (_) {}
  }
}

export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId.startsWith('event_complete_type_')) {
    const eventId = interaction.customId.replace('event_complete_type_', '');
    const event = getEvent(eventId);
    if (!event || event.status !== 'active') {
      await interaction.reply({
        content: 'Мероприятие не найдено или уже завершено.',
        flags: EPHEMERAL,
      }).catch(() => {});
      return;
    }
    const completionType = interaction.values[0] as 'success' | 'failure' | 'complete';
    event.status = 'completed';
    event.completionType = completionType;
    const gratitude = process.env.EVENT_GRATITUDE_MESSAGE || 'Спасибо за участие в мероприятии!';
    await interaction.update({
      content: `**${event.name}** — ${completionType === 'success' ? 'завершено с успехом! ✨' : completionType === 'failure' ? 'завершено с провалом 😔' : 'завершено!'}. ${gratitude}`,
      components: [],
    });
    try {
      const channel = await interaction.client.channels.fetch(event.channelId);
      if (channel?.isTextBased() && 'messages' in channel && event.messageId) {
        const msg = await channel.messages.fetch(event.messageId);
        const completedEmbed = buildCompletedEventEmbed(event);
        const pingRoleId = process.env.DISCORD_EVENT_PING_ROLE_ID?.trim();
        const completionContent = pingRoleId ? `<@&${pingRoleId}> ${getCompletionTitle(event)}` : getCompletionTitle(event);
        await msg.edit({ content: completionContent, embeds: [completedEmbed], components: [] });
      }
    } catch (_) {}
    deleteEvent(event.id);
    return;
  }

  if (interaction.customId.startsWith('event_exclude_')) {
    const eventId = interaction.customId.replace('event_exclude_', '');
    const event = getEvent(eventId);
    if (!event || event.status !== 'active') {
      await interaction.update({
        content: 'Мероприятие не найдено или уже завершено.',
        components: [],
      }).catch(() => {});
      return;
    }
    const excludedUserId = interaction.values[0];
    const idx = event.mainRoster.indexOf(excludedUserId);
    if (idx >= 0) {
      event.mainRoster.splice(idx, 1);
      setEvent(event);
    }
    await interaction.update({
      content: `Участник <@${excludedUserId}> исключён из состава.`,
      components: [],
    });
    try {
      const channel = await interaction.client.channels.fetch(event.channelId);
      if (channel?.isTextBased() && 'messages' in channel && event.messageId) {
        const msg = await channel.messages.fetch(event.messageId);
        const embed = buildEventEmbed(event);
        const rows = buildActionRows(event.id);
        await msg.edit({ embeds: [embed], components: rows });
      }
    } catch (_) {}
    return;
  }

  const prefix = 'event_lists_';
  if (!interaction.customId.startsWith(prefix)) return;

  const eventId = interaction.customId.slice(prefix.length);
  const event = getEvent(eventId);
  if (!event) {
    await interaction.reply({
      content: 'Мероприятие не найдено или удалено.',
      flags: EPHEMERAL,
    });
    return;
  }

  if (event.status !== 'active') {
    await interaction.reply({
      content: 'Мероприятие уже завершено или отменено.',
      flags: EPHEMERAL,
    });
    return;
  }

  const value = interaction.values[0];
  const userId = interaction.user.id;

  if (value === 'reschedule') {
    if (!interaction.guild) return;
    const member = interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(userId);
    if (!await isAdmin(member, userId)) {
      await interaction.reply({
        content: 'Только администраторы могут переносить мероприятие.',
        flags: EPHEMERAL,
      });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId(`event_reschedule_modal_${event.id}`)
      .setTitle('Перенос мероприятия');
    const timeInput = new TextInputBuilder()
      .setCustomId('new_time')
      .setLabel('Новое время')
      .setPlaceholder('18:30')
      .setStyle(TextInputStyle.Short)
      .setValue(formatTimeDisplay(event.time))
      .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
    );
    await interaction.showModal(modal);
    return;
  }

  if (value === 'exclude_participant') {
    if (!interaction.guild) return;
    const member = interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(userId);
    if (!await isAdmin(member, userId)) {
      await interaction.reply({
        content: 'Только администраторы могут исключать участников.',
        flags: EPHEMERAL,
      });
      return;
    }
    const excludeRow = await buildExcludeParticipantSelect(event, interaction.guild as any);
    if (!excludeRow) {
      await interaction.reply({
        content: 'Список участников пуст.',
        flags: EPHEMERAL,
      });
      return;
    }
    await interaction.reply({
      content: 'Выберите участника для исключения:',
      components: [excludeRow],
      flags: EPHEMERAL,
    });
    return;
  }

  if (value === 'configure_event') {
    if (!interaction.guild) return;
    const modal = new ModalBuilder()
      .setCustomId(`event_configure_modal_1_${event.id}`)
      .setTitle('Настройка мероприятия (шаг 1/2)');
    const nameInput = new TextInputBuilder()
      .setCustomId('configure_name')
      .setLabel('Название')
      .setStyle(TextInputStyle.Short)
      .setValue(event.name)
      .setRequired(true);
    const serverInput = new TextInputBuilder()
      .setCustomId('configure_server')
      .setLabel('Сервер')
      .setStyle(TextInputStyle.Short)
      .setValue(event.server ?? '')
      .setPlaceholder('Необязательно')
      .setRequired(false);
    const timeInput = new TextInputBuilder()
      .setCustomId('configure_time')
      .setLabel('Время')
      .setStyle(TextInputStyle.Short)
      .setValue(formatTimeDisplay(event.time))
      .setRequired(true);
    const limitInput = new TextInputBuilder()
      .setCustomId('configure_participant_limit')
      .setLabel('Лимит участников')
      .setStyle(TextInputStyle.Short)
      .setValue(String(event.participantLimit))
      .setRequired(true);
    const locationInput = new TextInputBuilder()
      .setCustomId('configure_location')
      .setLabel('Место')
      .setStyle(TextInputStyle.Short)
      .setValue(event.location || '')
      .setRequired(false);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(limitInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput)
    );
    await interaction.showModal(modal);
    return;
  }

  const embed = buildEventEmbed(event);
  const rows = buildActionRows(event.id);
  try {
    await interaction.message.edit({ embeds: [embed], components: rows });
  } catch (_) {}
}
