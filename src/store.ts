import { EventData } from './types';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

const getStoragePath = (): string => {
  const p = process.env.EVENTS_STORAGE_PATH || './data/events.json';
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
};

let events: Map<string, EventData> = new Map();

export function loadEvents(): void {
  const filePath = getStoragePath();
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      events = new Map(Object.entries(data));
    }
  } catch (e) {
    logger.error('Error loading events', e);
    events = new Map();
  }
}

export function saveEvents(): void {
  const filePath = getStoragePath();
  const obj = Object.fromEntries(events);
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

export function getEvent(id: string): EventData | undefined {
  return events.get(id);
}

export function getEventByMessageId(messageId: string): EventData | undefined {
  return getAllEvents().find((e) => e.messageId === messageId);
}

export function getAllEvents(): EventData[] {
  return Array.from(events.values());
}

export function getActiveEvents(): EventData[] {
  return getAllEvents().filter((e) => e.status === 'active');
}

export function setEvent(event: EventData): void {
  events.set(event.id, event);
  saveEvents();
}

export function deleteEvent(id: string): boolean {
  const ok = events.delete(id);
  if (ok) saveEvents();
  return ok;
}

export function generateEventId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 8);
}
