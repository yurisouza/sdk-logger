import { LoggingInterceptor } from './logging.interceptor';
import { SigNozConfig } from '../../types';

/**
 * Configura o logging para aplicações NestJS
 * @param app - Instância da aplicação NestJS
 * @param config - Configuração do SigNoz
 */
export function setupLogging(app: any, config: SigNozConfig): void {
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

    if (!config.endpoint || typeof config.endpoint !== 'string') {
      return;
    }

    // Registrar interceptor globalmente
    const interceptor = new LoggingInterceptor(config);
    app.useGlobalInterceptors(interceptor);
  } catch (error) {
    // Não quebra a aplicação, apenas ignora o logging
  }
}