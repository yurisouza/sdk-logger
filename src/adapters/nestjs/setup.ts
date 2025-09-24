import { LoggingInterceptor } from './logging.interceptor';
import { LoggerConfig } from '../../types';

/**
 * Configura o logging para aplicações NestJS
 * @param app - Instância da aplicação NestJS
 * @param config - Configuração do logger
 */
export function setupLogging(app: any, config: LoggerConfig): void {
  try {
    console.log('🔍 setupLogging: Iniciando configuração do logging');
    
    // Validação básica do app
    if (!app || typeof app.useGlobalInterceptors !== 'function') {
      console.log('❌ setupLogging: App inválido ou sem useGlobalInterceptors');
      return;
    }

    // Validação básica da config
    if (!config || typeof config !== 'object') {
      console.log('❌ setupLogging: Config inválida');
      return;
    }

    // Validação dos campos obrigatórios
    if (!config.serviceName || typeof config.serviceName !== 'string') {
      console.log('❌ setupLogging: serviceName inválido');
      return;
    }

    // Validação específica para collector
    if (!config.collectorEndpoint) {
      console.log('❌ setupLogging: collectorEndpoint inválido');
      return;
    }

    console.log('✅ setupLogging: Configuração válida, registrando interceptor');
    
    // Registrar interceptor globalmente
    const interceptor = new LoggingInterceptor(config);
    app.useGlobalInterceptors(interceptor);
    
    console.log('✅ setupLogging: Interceptor registrado com sucesso');
  } catch (error) {
    console.log('❌ setupLogging: Erro ao configurar logging:', error);
    // Não quebra a aplicação, apenas ignora o logging
  }
}