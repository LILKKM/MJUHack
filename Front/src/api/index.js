import { mockApi } from './mock';
// Operation URLs must be supplied after Spring DTO/path agreement; no guessed endpoints.
export function createHttpApi({ baseUrl, operations, fetcher = fetch }) {
  return Object.fromEntries(Object.keys(mockApi).map(operation => [operation, async input => {
    if (!operations[operation]) throw new Error('API_OPERATION_NOT_CONFIGURED');
    const response = await fetcher(`${baseUrl}${operations[operation]}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('API_REQUEST_FAILED');
    const result = await response.json();
    if (result.contractVersion !== '0.1.0' || !['ok', 'empty', 'error'].includes(result.status)) throw new Error('API_CONTRACT_MISMATCH');
    return result;
  }]));
}
export const api = mockApi;
