import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export interface GuildEventSettings {
  name: string;
  server?: string;
  participantLimit: number;
  color: string;
  group: string;
  time: string;
}

const getSettingsPath = (): string => {
  const p = process.env.EVENTS_STORAGE_PATH || './data/events.json';
  const baseDir = path.dirname(p);
  return path.join(baseDir, 'guild-settings.json');
};

let settings: Map<string, GuildEventSettings> = new Map();

function loadSettings(): void {
  const filePath = getSettingsPath();
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      settings = new Map(Object.entries(data));
} catch (e) {
    logger.error('Error loading guild settings', e);
  }
  }
}

function saveSettings(): void {
  const filePath = getSettingsPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(settings), null, 2));
}

export function getGuildSettings(guildId: string): GuildEventSettings | undefined {
  loadSettings();
  return settings.get(guildId);
}

export function setGuildSettings(guildId: string, s: GuildEventSettings): void {
  settings.set(guildId, s);
  saveSettings();
}
