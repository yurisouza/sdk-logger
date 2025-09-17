describe('HEAD Endpoint Data Handling', () => {
  const calculateResponseSize = (data: any): number => {
    return data ? JSON.stringify(data).length : 0;
  };

  it('Should return 0 when data is undefined', () => {
    const result = calculateResponseSize(undefined);
    expect(result).toBe(0);
  });

  it('Should return 0 when data is null', () => {
    const result = calculateResponseSize(null);
    expect(result).toBe(0);
  });

  it('Should return correct size for empty string', () => {
    const result = calculateResponseSize('');
    expect(result).toBe(0); // Empty string is falsy, so returns 0
  });

  it('Should return correct size for empty object', () => {
    const result = calculateResponseSize({});
    expect(result).toBe(2); // JSON.stringify({}) returns '{}'
  });

  it('Should return correct size for string data', () => {
    const result = calculateResponseSize('test');
    expect(result).toBe(6); // JSON.stringify('test') returns '"test"'
  });

  it('Should return correct size for object data', () => {
    const result = calculateResponseSize({ message: 'test' });
    expect(result).toBe(18); // JSON.stringify({ message: 'test' }) returns '{"message":"test"}'
  });
});
