import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = process.env.LOGS_DIR || './logs';
const LOGS_FILE = path.join(LOGS_DIR, 'logs.txt');
const ERRORS_FILE = path.join(LOGS_DIR, 'errors.txt');

function ensureDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function writeLog(file: string, line: string): void {
  ensureDir();
  fs.appendFileSync(file, line + '\n', 'utf-8');
}

export const logger = {
  log(...args: unknown[]): void {
    const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${timestamp()}] ${msg}`;
    console.log(msg);
    writeLog(LOGS_FILE, line);
  },

  error(msg: string, err?: unknown): void {
    const lines: string[] = [
      '---',
      `[${timestamp()}] ERROR: ${msg}`,
    ];
    if (err instanceof Error) {
      lines.push(`  ${err.name}: ${err.message}`);
      if (err.stack) lines.push(err.stack);
    } else if (err !== undefined) {
      lines.push(`  ${String(err)}`);
    }
    lines.push('---');
    const block = lines.join('\n');
    console.error(msg, err ?? '');
    writeLog(ERRORS_FILE, block);
  },
};
