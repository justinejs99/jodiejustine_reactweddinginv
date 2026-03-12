export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  useMockApi: (import.meta.env.VITE_USE_MOCK_API ?? 'true') !== 'false',
}
