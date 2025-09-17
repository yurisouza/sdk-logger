// Auto-inicialização do OpenTelemetry
import './telemetry';

// Exportar componentes
export { LoggingInterceptor } from './logging.interceptor';
export { setupLogging, setupMinimalLogging, setupCompleteLogging } from './setup';
export { initializeTelemetry, shutdownTelemetry } from './telemetry';

// Re-exportar tipos necessários
export { LoggerConfig } from '../../types';

