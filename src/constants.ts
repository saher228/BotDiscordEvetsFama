import { MessageFlags } from 'discord.js';

export const EPHEMERAL = MessageFlags.Ephemeral;

/** Срок жизни побочных сообщений (не сам ивент): 5 часов. */
export const MESSAGE_TTL_MS = 5 * 60 * 60 * 1000;

/** Запланировать удаление сообщения через указанное время (мс). */
export function scheduleMessageDelete(msg: { delete(): Promise<unknown> }, delayMs: number): void {
  setTimeout(() => { msg.delete().catch(() => {}); }, delayMs);
}
