import { LoggingInterceptor } from './logging.interceptor';
import { LoggerConfig } from '../../types';

/**
 * Configura o logging para aplicações NestJS
 * @param app - Instância da aplicação NestJS
 * @param config - Configuração do logger
 */
export function setupLogging(app: any, config: LoggerConfig): void {
  try {
    // Validação básica do app
    if (!app || typeof app.useGlobalInterceptors !== 'function') {
      return;
    }

    // Validação básica da config
    if (!config || typeof config !== 'object') {
      return;
    }

    // Validação dos campos obrigatórios
    if (!config.serviceName || typeof config.serviceName !== 'string') {
      return;
    }

    // Validação específica para collector
    if (!config.collectorEndpoint) {
      return;
    }

    // Registrar interceptor globalmente
    const interceptor = new LoggingInterceptor(config);
    app.useGlobalInterceptors(interceptor);
  } catch (error) {
    // Não quebra a aplicação, apenas ignora o logging
  }
}