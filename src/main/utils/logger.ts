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

    try {
      let stack: string | undefined;
      const context: Record<string, unknown> = {};

      args.forEach((arg, idx) => {
        if (arg instanceof Error) {
          if (!stack) stack = arg.stack;
          context[`error_${idx}`] = { message: arg.message, name: arg.name };
        } else if (typeof arg === 'object' && arg !== null) {
          context[`arg_${idx}`] = arg as Record<string, unknown>;
        } else if (arg !== undefined) {
          context[`arg_${idx}`] = arg;
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { recordError } = require('../services/error-logger.service');
      recordError({
        source: 'main',
        message,
        stack,
        context: Object.keys(context).length > 0 ? context : undefined,
      });
    } catch {
      // Never throw from logger
    }
  },

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, ...args);
      writeToFile('DEBUG', message, ...args);
    }
  },
};
