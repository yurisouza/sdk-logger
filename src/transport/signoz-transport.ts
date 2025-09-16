import { LogEntry } from '../types';
import { SigNozExporter } from '../exporters/signoz-exporter';
import TransportStream = require('winston-transport');

export class SigNozTransport extends TransportStream {
  private exporter: SigNozExporter;

  constructor(options: any) {
    super();
    this.exporter = new SigNozExporter(options.signoz);
  }

  log(info: LogEntry, callback: () => void): void {
    // Enviar para SigNoz de forma assíncrona
    this.exporter.exportLog(info).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Erro ao enviar log para SigNoz:', error);
    });

    callback();
  }
}
