type Level = 'info' | 'warn' | 'error' | 'debug';

function stamp(): string {
  return new Date().toISOString();
}

function emit(level: Level, source: string, msg: string, extra?: unknown): void {
  const line = `[${stamp()}] [${level.toUpperCase()}] [${source}] ${msg}`;
  if (level === 'error') console.error(line, extra ?? '');
  else if (level === 'warn') console.warn(line, extra ?? '');
  else console.log(line, extra ?? '');
}

export function makeLogger(source: string) {
  return {
    info: (msg: string, extra?: unknown) => emit('info', source, msg, extra),
    warn: (msg: string, extra?: unknown) => emit('warn', source, msg, extra),
    error: (msg: string, extra?: unknown) => emit('error', source, msg, extra),
    debug: (msg: string, extra?: unknown) => {
      if (process.env.LOG_LEVEL === 'debug') emit('debug', source, msg, extra);
    },
  };
}

export type Logger = ReturnType<typeof makeLogger>;
