import { GuildMember } from 'discord.js';

export async function isAdmin(member: GuildMember | null, userId?: string): Promise<boolean> {
  const uid = userId || (member as any)?.id;
  if (uid) {
    const adminUserIds = (process.env.DISCORD_ADMIN_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (adminUserIds.includes(uid)) return true;
  }
  if (!member) return false;
  if (typeof member.permissions?.has === 'function' && member.permissions.has('Administrator')) return true;
  const adminRoleIds = (process.env.DISCORD_ADMIN_ROLE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminRoleIds.length === 0) return false;
  const cache = member.roles?.cache;
  if (!cache) return false;
  return cache.some((r: { id: string }) => adminRoleIds.includes(r.id));
}
