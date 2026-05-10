import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

export const http = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent':
      'UAP-Aggregator/0.1 (+https://github.com/ufo-aggregator; public research)',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err: AxiosError) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.response?.status === 429 ||
    (err.response?.status !== undefined && err.response.status >= 500),
});

export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
