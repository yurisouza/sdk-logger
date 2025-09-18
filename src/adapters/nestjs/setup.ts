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
    // Registrar interceptor globalmente
    console.log('🔨 Criando LoggingInterceptor...');
    const interceptor = new LoggingInterceptor(config);
    console.log('📝 LoggingInterceptor criado com sucesso');
    
    console.log('🔗 Registrando interceptor globalmente...');
    app.useGlobalInterceptors(interceptor);
    console.log('✅ LoggingInterceptor registrado globalmente');
  } catch (error) {
    console.error('❌ Erro ao registrar LoggingInterceptor:', error);
    console.error('❌ Stack trace:', (error as Error).stack);
  }
}