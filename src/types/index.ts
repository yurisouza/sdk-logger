export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  [key: string]: any;
}

export interface SigNozConfig {
  endpoint: string;
  apiKey: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  enableTracing?: boolean;
  enableLogs?: boolean;
}

export interface LoggerConfig extends SigNozConfig {
  logLevel?: LogLevel;
  enableConsole?: boolean;
}

// Para NestJS - usar a mesma interface
export type NestLoggingConfig = SigNozConfig;
