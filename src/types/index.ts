export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  service?: string;
  version?: string;
  environment?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
}

export interface SigNozConfig {
  endpoint: string;
  apiKey: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  region?: string;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableLogs?: boolean;
  batchSize?: number;
  flushInterval?: number;
}

export interface LoggerConfig {
  signoz: SigNozConfig;
  logLevel?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxFileSize?: string;
  maxFiles?: number;
  format?: 'json' | 'simple';
}

export interface TracedLoggerContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  context?: LogContext;
}

