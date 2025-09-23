export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// Níveis de log em ordem de prioridade (maior para menor)
const LOG_LEVEL_PRIORITY = {
  [LogLevel.ERROR]: 4,
  [LogLevel.WARN]: 3,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 1
};

// Função utilitária para verificar se um nível de log deve ser processado
export function shouldLogLevel(currentLevel: LogLevel, minLevel: LogLevel = LogLevel.INFO): boolean {
  return LOG_LEVEL_PRIORITY[currentLevel] >= LOG_LEVEL_PRIORITY[minLevel];
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  service?: string;
  version?: string;
  environment?: string;
  context?: any;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  userId?: string;
  correlationId?: string;
  error?: any;
  performance?: any;
  request?: any;
  response?: any;
}

export interface LoggerConfig {
  // Configuração do Collector
  collectorEndpoint: string;
  collectorProtocol?: 'http' | 'grpc';
  collectorTimeout?: number;
  collectorHeaders?: Record<string, string>;
  
  // Configurações do serviço
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  logLevel?: LogLevel;
  minLogLevel?: LogLevel; // Nível mínimo de log (padrão: INFO)
  
  // Configurações de habilitação (padrão: true, exceto enableConsole)
  enableConsole?: boolean; // Padrão: false
  enableTracing?: boolean; // Padrão: true
  enableLogs?: boolean;    // Padrão: true
  enableMetrics?: boolean; // Padrão: true
}

// Para NestJS - usar a mesma interface
export type NestLoggingConfig = LoggerConfig;
