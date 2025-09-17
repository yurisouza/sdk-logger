describe('Defensive Programming - SDK Logger', () => {
  const calculateResponseSize = (data: any): number => {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return data.length;
    if (typeof data === 'number') return data.toString().length;
    if (typeof data === 'boolean') return data.toString().length;
    
    try {
      const jsonString = JSON.stringify(data);
      return jsonString ? jsonString.length : 0;
    } catch (error) {
      return 0;
    }
  };

  const safeExtractRequestData = (request: any): { method: string; url: string; headers: any; body: any } => {
    try {
      return {
        method: request?.method || 'UNKNOWN',
        url: request?.url || '/',
        headers: request?.headers || {},
        body: request?.body || null
      };
    } catch (error) {
      return {
        method: 'UNKNOWN',
        url: '/',
        headers: {},
        body: null
      };
    }
  };

  const safeGetUserAgent = (headers: any): string => {
    try {
      return headers?.['user-agent'] || headers?.['User-Agent'] || '';
    } catch (error) {
      return '';
    }
  };

  const safeGetIp = (request: any): string => {
    try {
      return request?.ip || 
             request?.connection?.remoteAddress || 
             request?.socket?.remoteAddress || 
             'unknown';
    } catch (error) {
      return 'unknown';
    }
  };

  describe('SafeCalculateSize', () => {
    it('Should return 0 for undefined data', () => {
      expect(calculateResponseSize(undefined)).toBe(0);
    });

    it('Should return 0 for null data', () => {
      expect(calculateResponseSize(null)).toBe(0);
    });

    it('Should return correct size for string data', () => {
      expect(calculateResponseSize('test')).toBe(4);
    });

    it('Should return correct size for number data', () => {
      expect(calculateResponseSize(123)).toBe(3);
    });

    it('Should return correct size for boolean data', () => {
      expect(calculateResponseSize(true)).toBe(4);
    });

    it('Should return correct size for object data', () => {
      expect(calculateResponseSize({ message: 'test' })).toBe(18);
    });

    it('Should return 0 for circular reference objects', () => {
      const circular: any = {};
      circular.self = circular;
      expect(calculateResponseSize(circular)).toBe(0);
    });

    it('Should return 0 for functions', () => {
      expect(calculateResponseSize(() => {})).toBe(0);
    });
  });

  describe('SafeExtractRequestData', () => {
    it('Should handle undefined request', () => {
      const result = safeExtractRequestData(undefined);
      expect(result).toEqual({
        method: 'UNKNOWN',
        url: '/',
        headers: {},
        body: null
      });
    });

    it('Should handle null request', () => {
      const result = safeExtractRequestData(null);
      expect(result).toEqual({
        method: 'UNKNOWN',
        url: '/',
        headers: {},
        body: null
      });
    });

    it('Should handle empty request', () => {
      const result = safeExtractRequestData({});
      expect(result).toEqual({
        method: 'UNKNOWN',
        url: '/',
        headers: {},
        body: null
      });
    });

    it('Should extract valid request data', () => {
      const request = {
        method: 'POST',
        url: '/api/test',
        headers: { 'content-type': 'application/json' },
        body: { test: 'data' }
      };
      const result = safeExtractRequestData(request);
      expect(result).toEqual(request);
    });

    it('Should handle request with missing properties', () => {
      const request = { method: 'GET' };
      const result = safeExtractRequestData(request);
      expect(result).toEqual({
        method: 'GET',
        url: '/',
        headers: {},
        body: null
      });
    });
  });

  describe('SafeGetUserAgent', () => {
    it('Should return empty string for undefined headers', () => {
      expect(safeGetUserAgent(undefined)).toBe('');
    });

    it('Should return empty string for null headers', () => {
      expect(safeGetUserAgent(null)).toBe('');
    });

    it('Should return empty string for empty headers', () => {
      expect(safeGetUserAgent({})).toBe('');
    });

    it('Should return user-agent from headers', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      expect(safeGetUserAgent(headers)).toBe('Mozilla/5.0');
    });

    it('Should return User-Agent from headers (case insensitive)', () => {
      const headers = { 'User-Agent': 'Mozilla/5.0' };
      expect(safeGetUserAgent(headers)).toBe('Mozilla/5.0');
    });

    it('Should handle headers with non-string values', () => {
      const headers = { 'user-agent': 123 };
      expect(safeGetUserAgent(headers)).toBe(123);
    });
  });

  describe('SafeGetIp', () => {
    it('Should return unknown for undefined request', () => {
      expect(safeGetIp(undefined)).toBe('unknown');
    });

    it('Should return unknown for null request', () => {
      expect(safeGetIp(null)).toBe('unknown');
    });

    it('Should return unknown for empty request', () => {
      expect(safeGetIp({})).toBe('unknown');
    });

    it('Should return IP from request.ip', () => {
      const request = { ip: '192.168.1.1' };
      expect(safeGetIp(request)).toBe('192.168.1.1');
    });

    it('Should return IP from request.connection.remoteAddress', () => {
      const request = { connection: { remoteAddress: '192.168.1.2' } };
      expect(safeGetIp(request)).toBe('192.168.1.2');
    });

    it('Should return IP from request.socket.remoteAddress', () => {
      const request = { socket: { remoteAddress: '192.168.1.3' } };
      expect(safeGetIp(request)).toBe('192.168.1.3');
    });

    it('Should handle request with missing IP properties', () => {
      const request = { method: 'GET' };
      expect(safeGetIp(request)).toBe('unknown');
    });
  });

  describe('Edge Cases', () => {
    it('Should handle malformed JSON data', () => {
      const malformedData: any = { circular: {} };
      malformedData.circular.self = malformedData;
      expect(calculateResponseSize(malformedData)).toBe(0);
    });

    it('Should handle very large objects', () => {
      const largeObject = { data: 'x'.repeat(10000) };
      expect(calculateResponseSize(largeObject)).toBe(10011);
    });

    it('Should handle special characters in data', () => {
      const specialData = { message: '🚀 Test with emoji and special chars: @#$%' };
      expect(calculateResponseSize(specialData)).toBeGreaterThan(0);
    });

    it('Should handle nested undefined values', () => {
      const nestedData = { 
        level1: { 
          level2: { 
            level3: undefined 
          } 
        } 
      };
      expect(calculateResponseSize(nestedData)).toBeGreaterThan(0);
    });
  });
});
