import { Logger, LogLevel, createLogger } from '../index';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger({
      endpoint: 'https://test.signoz.cloud',
      apiKey: 'test-api-key',
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test'
    });
  });

  describe('Criação do Logger', () => {
    it('deve criar um logger com configuração válida', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });
  });

  describe('Níveis de Log', () => {
    it('deve suportar todos os níveis de log', () => {
      expect(LogLevel.ERROR).toBe('error');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.DEBUG).toBe('debug');
    });
  });

  describe('Métodos de Log', () => {
    it('deve ter métodos de log definidos', () => {
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });
});
