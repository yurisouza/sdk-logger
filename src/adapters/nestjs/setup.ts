import { LoggingInterceptor } from './logging.interceptor';
import { SigNozConfig } from '../../types';

/**
 * Configura o logging para aplicações NestJS
 * @param app - Instância da aplicação NestJS
 * @param config - Configuração do SigNoz
 */
export function setupLogging(app: any, config: SigNozConfig): void {
  console.log('🔧 setupLogging chamado...');
  console.log('📋 Config recebida:', config);
  
  try {
    // Validação básica do app
    if (!app || typeof app.useGlobalInterceptors !== 'function') {
      console.warn('setupLogging: app inválido ou sem método useGlobalInterceptors, ignorando logging');
      return;
    }

    // Validação básica da config
    if (!config || typeof config !== 'object') {
      console.warn('setupLogging: config inválido, ignorando logging');
      return;
    }

    // Validação dos campos obrigatórios
    if (!config.serviceName || typeof config.serviceName !== 'string') {
      console.warn('setupLogging: serviceName inválido, ignorando logging');
      return;
    }

    if (!config.endpoint || typeof config.endpoint !== 'string') {
      console.warn('setupLogging: endpoint inválido, ignorando logging');
      return;
    }

    // Registrar interceptor globalmente
    console.log('🔨 Criando LoggingInterceptor...');
    const interceptor = new LoggingInterceptor(config);
    console.log('📝 LoggingInterceptor criado com sucesso');
    
    console.log('🔗 Registrando interceptor globalmente...');
    app.useGlobalInterceptors(interceptor);
    console.log('✅ LoggingInterceptor registrado globalmente');
  } catch (error) {
    console.warn('setupLogging: Erro ao configurar logging (ignorando):', error instanceof Error ? error.message : String(error));
    // Não quebra a aplicação, apenas ignora o logging
  }
}