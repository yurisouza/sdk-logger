import { SigNozConfig } from '../types';

export function setupOpenTelemetry(config: SigNozConfig): any {
  // Versão simplificada - retorna um objeto vazio por enquanto
  // Em uma implementação futura, pode ser expandida para incluir OpenTelemetry
  
  return {
    start: () => {
      console.log('OpenTelemetry iniciado');
    },
    shutdown: () => {
      console.log('OpenTelemetry finalizado');
    }
  };
}
