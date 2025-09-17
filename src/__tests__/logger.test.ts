import { Logger, LogLevel, createLogger, createSigNozLogger } from '../index';

// Mock do winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    close: jest.fn()
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  },
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    json: jest.fn(),
    errors: jest.fn()
  }
}));

// Mock do SigNozExporter
jest.mock('../exporters/signoz-exporter', () => ({
  SigNozExporter: jest.fn().mockImplementation(() => ({
    exportLog: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSigNozLogger', () => {
    it('deve criar logger com configuração básica', () => {
      const config = {
        endpoint: 'https://ingest.us.signoz.cloud:443',
        apiKey: 'test-api-key',
        serviceName: 'test-service'
      };

      logger = createSigNozLogger(config);

      expect(logger).toBeInstanceOf(Logger);
    });

    it('deve criar logger com configuração completa', () => {
      const config = {
        endpoint: 'https://ingest.us.signoz.cloud:443',
        apiKey: 'test-api-key',
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test',
        enableTracing: true,
        enableMetrics: true,
        enableLogs: true
      };

      logger = createSigNozLogger(config, {
        logLevel: LogLevel.DEBUG,
        enableConsole: true,
        enableFile: true
      });

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('Métodos de log', () => {
    beforeEach(() => {
      logger = createSigNozLogger({
        endpoint: 'https://ingest.us.signoz.cloud:443',
        apiKey: 'test-api-key',
        serviceName: 'test-service'
      });
    });

    it('deve chamar winston.error para logs de erro', () => {
      const mockWinston = logger['winston'];
      
      logger.error('Mensagem de erro', { userId: '123' });
      
      expect(mockWinston.error).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: 'Mensagem de erro',
          context: { userId: '123' }
        })
      );
    });

    it('deve chamar winston.warn para logs de aviso', () => {
      const mockWinston = logger['winston'];
      
      logger.warn('Mensagem de aviso');
      
      expect(mockWinston.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.WARN,
          message: 'Mensagem de aviso'
        })
      );
    });

    it('deve chamar winston.info para logs informativos', () => {
      const mockWinston = logger['winston'];
      
      logger.info('Mensagem informativa');
      
      expect(mockWinston.info).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Mensagem informativa'
        })
      );
    });

    it('deve chamar winston.debug para logs de debug', () => {
      const mockWinston = logger['winston'];
      
      logger.debug('Mensagem de debug');
      
      expect(mockWinston.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.DEBUG,
          message: 'Mensagem de debug'
        })
      );
    });

    it('deve chamar winston.silly para logs de trace', () => {
      const mockWinston = logger['winston'];
      
      logger.trace('Mensagem de trace');
      
      expect(mockWinston.silly).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.TRACE,
          message: 'Mensagem de trace'
        })
      );
    });
  });

  describe('Métodos de rastreamento', () => {
    beforeEach(() => {
      logger = createSigNozLogger({
        endpoint: 'https://ingest.us.signoz.cloud:443',
        apiKey: 'test-api-key',
        serviceName: 'test-service'
      });
    });

    it('deve criar logger com traceId', () => {
      const tracedLogger = logger.withTraceId('trace-123');
      
      expect(tracedLogger).toBeInstanceOf(Logger);
      expect(tracedLogger).not.toBe(logger);
    });

    it('deve criar logger com spanId', () => {
      const tracedLogger = logger.withSpanId('span-456');
      
      expect(tracedLogger).toBeInstanceOf(Logger);
      expect(tracedLogger).not.toBe(logger);
    });

    it('deve criar logger com userId', () => {
      const tracedLogger = logger.withUserId('user-789');
      
      expect(tracedLogger).toBeInstanceOf(Logger);
      expect(tracedLogger).not.toBe(logger);
    });

    it('deve criar logger com requestId', () => {
      const tracedLogger = logger.withRequestId('req-abc');
      
      expect(tracedLogger).toBeInstanceOf(Logger);
      expect(tracedLogger).not.toBe(logger);
    });

    it('deve criar logger com correlationId', () => {
      const tracedLogger = logger.withCorrelationId('corr-def');
      
      expect(tracedLogger).toBeInstanceOf(Logger);
      expect(tracedLogger).not.toBe(logger);
    });

    it('deve criar child logger com contexto', () => {
      const childLogger = logger.child({ userId: '123', sessionId: '456' });
      
      expect(childLogger).toBeInstanceOf(Logger);
      expect(childLogger).not.toBe(logger);
    });
  });

  describe('shutdown', () => {
    it('deve chamar winston.close', async () => {
      const mockWinston = logger['winston'];
      mockWinston.close = jest.fn().mockResolvedValue(undefined);
      
      await logger.shutdown();
      
      expect(mockWinston.close).toHaveBeenCalled();
    });
  });
});

