import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let logDir: string;

try {
  logDir = path.join(app.getPath('userData'), 'logs');
} catch {
  logDir = path.join(process.cwd(), 'logs');
}

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `pos-${date}.log`);
}

function writeToFile(level: string, message: string, ...args: unknown[]): void {
  const logLine = `[${getTimestamp()}] [${level}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
  try {
    fs.appendFileSync(getLogFilePath(), logLine);
  } catch {
    // Silently fail file logging
  }
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
    writeToFile('INFO', message, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
    writeToFile('WARN', message, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
    writeToFile('ERROR', message, ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, ...args);
      writeToFile('DEBUG', message, ...args);
    }
  },
};
