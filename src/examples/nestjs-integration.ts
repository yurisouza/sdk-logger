// Este arquivo é um exemplo de integração com NestJS
// Para usar, instale as dependências: @nestjs/common, rxjs
import { createSigNozLogger, Logger } from '../index';

// Interfaces para o exemplo (substitua pelas importações reais do NestJS)
interface Module {
  providers: any[];
  exports: string[];
}

interface Injectable {
  new (...args: any[]): any;
}

interface Inject {
  (token: string): ParameterDecorator;
}

interface NestInterceptor {
  intercept(context: any, next: any): any;
}

interface ExecutionContext {
  switchToHttp(): {
    getRequest(): any;
    getResponse(): any;
  };
}

interface CallHandler {
  handle(): any;
}

interface Observable<T> {
  pipe(...operators: any[]): Observable<T>;
}

// Mock das funções do NestJS para o exemplo
const Module = (config: any) => config;
const Injectable = () => (target: any) => target;
const Inject = (token: string) => (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {};
const tap = (callbacks: any) => (source: any) => source;

// Módulo do Logger
@Module({
  providers: [
    {
      provide: 'LOGGER',
      useFactory: () => createSigNozLogger({
        endpoint: process.env.SIGNOZ_ENDPOINT || 'https://ingest.us.signoz.cloud:443',
        apiKey: process.env.SIGNOZ_API_KEY || 'your-api-key',
        serviceName: process.env.SERVICE_NAME || 'viagens-svc',
        serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        enableTracing: true,
        enableMetrics: true,
        enableLogs: true
      })
    }
  ],
  exports: ['LOGGER']
})
export class LoggerModule {}

// Service de exemplo
@Injectable()
export class UserService {
  constructor(@Inject('LOGGER') private logger: Logger) {}

  async createUser(userData: any) {
    const requestId = this.generateRequestId();
    const tracedLogger = this.logger.withRequestId(requestId);

    try {
      tracedLogger.info('Iniciando criação de usuário', { 
        email: userData.email,
        action: 'createUser'
      });

      // Simular validação
      if (!userData.email) {
        tracedLogger.warn('Email não fornecido', { userData });
        throw new Error('Email é obrigatório');
      }

      // Simular criação do usuário
      const user = await this.saveUser(userData);
      
      tracedLogger.info('Usuário criado com sucesso', { 
        userId: user.id,
        email: user.email
      });

      return user;
    } catch (error) {
      tracedLogger.error('Erro ao criar usuário', { 
        error: (error as Error).message,
        stack: (error as Error).stack,
        userData
      });
      throw error;
    }
  }

  private async saveUser(userData: any) {
    // Simular operação de banco
    return { id: 'user-123', ...userData };
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Interceptor para logging automático de requisições
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject('LOGGER') private logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const requestId = this.generateRequestId();
    
    const tracedLogger = this.logger
      .withRequestId(requestId)
      .withTraceId(request.headers['x-trace-id'] || this.generateTraceId());

    tracedLogger.info('Requisição recebida', {
      method,
      url,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const duration = Date.now() - startTime;
          tracedLogger.info('Requisição processada com sucesso', {
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            responseSize: JSON.stringify(data).length
          });
        },
        error: (error: any) => {
          const duration = Date.now() - startTime;
          tracedLogger.error('Erro ao processar requisição', {
            statusCode: response.statusCode || 500,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack
          });
        }
      })
    );
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
