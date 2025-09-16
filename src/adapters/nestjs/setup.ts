import { INestApplication } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { LoggerConfig } from '../../types';

/**
 * Configura automaticamente o logging e tracing para aplicações NestJS
 * @param app - Instância da aplicação NestJS
 * @param config - Configuração opcional do logger
 */
export function setupLogging(app: any, config?: Partial<LoggerConfig>): void {
  // Registrar interceptor globalmente
  app.useGlobalInterceptors(new LoggingInterceptor(config));
}

/**
 * Configuração mínima - apenas com variáveis de ambiente
 * @param app - Instância da aplicação NestJS
 */
export function setupMinimalLogging(app: any): void {
  setupLogging(app);
}

/**
 * Configuração completa com parâmetros
 * @param app - Instância da aplicação NestJS
 * @param serviceName - Nome do serviço
 * @param serviceVersion - Versão do serviço
 * @param environment - Ambiente (production, development, etc)
 * @param signozEndpoint - Endpoint do SigNoz
 * @param signozApiKey - API Key do SigNoz
 */
export function setupCompleteLogging(
  app: any,
  serviceName: string,
  serviceVersion: string,
  environment: string,
  signozEndpoint: string,
  signozApiKey: string
): void {
  const config: Partial<LoggerConfig> = {
    signoz: {
      endpoint: signozEndpoint,
      apiKey: signozApiKey,
      serviceName: serviceName,
      serviceVersion: serviceVersion,
      environment: environment,
      enableLogs: true
    }
  };

  setupLogging(app, config);
}
