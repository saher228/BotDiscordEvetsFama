import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildMember,
} from 'discord.js';
import { getEvent } from '../store';
import { EPHEMERAL } from '../constants';
import { isAdmin } from '../utils/admin';

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Управление мероприятиями')
  .addSubcommand((sub) =>
    sub.setName('create').setDescription('Создать новое мероприятие')
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Удалить мероприятие')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID мероприятия').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'create') {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Команда доступна только на сервере.',
        flags: EPHEMERAL,
      });
      return;
    }
    const member = interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild!.members.fetch(interaction.user.id);
    if (!await isAdmin(member, interaction.user.id)) {
      await interaction.reply({
        content: 'Только администраторы могут создавать мероприятия.',
        flags: EPHEMERAL,
      });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId('event_create_modal_1')
      .setTitle('Создание мероприятия (шаг 1/2)');

    const nameInput = new TextInputBuilder()
      .setCustomId('event_name')
      .setLabel('Название мероприятия')
      .setPlaceholder('Название мероприятия')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const serverInput = new TextInputBuilder()
      .setCustomId('event_server')
      .setLabel('Сервер')
      .setPlaceholder('Например: Phoenix (необязательно)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const timeInput = new TextInputBuilder()
      .setCustomId('event_time')
      .setLabel('Время')
      .setPlaceholder('17:20')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const limitInput = new TextInputBuilder()
      .setCustomId('event_participant_limit')
      .setLabel('Лимит участников')
      .setPlaceholder('35')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const locationInput = new TextInputBuilder()
      .setCustomId('event_location')
      .setLabel('Место')
      .setPlaceholder('СКЛАД #6')
      .setStyle(TextInputStyle.Short)
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

  if (sub === 'delete') {
    const id = interaction.options.getString('id', true);
    const event = getEvent(id);
    if (!event) {
      await interaction.reply({ content: 'Мероприятие не найдено.', flags: EPHEMERAL });
      return;
    }
    if (event.creatorId !== interaction.user.id) {
      await interaction.reply({
        content: 'Только создатель может удалить мероприятие.',
        flags: EPHEMERAL,
      });
      return;
    }
    const { deleteEvent } = await import('../store');
    deleteEvent(id);
    await interaction.reply({
      content: `Мероприятие **${event.name}** удалено.`,
      flags: EPHEMERAL,
    });
    return;
  }

}
