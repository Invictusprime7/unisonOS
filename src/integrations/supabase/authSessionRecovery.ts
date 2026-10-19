const AUTH_USER_PATH = '/auth/v1/user';
const AUTH_TOKEN_PATH = '/auth/v1/token';

type ResponseLike = Pick<Response, 'status'>;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Identify access-token rejections for callers that can refresh the session.
 * This alone is not grounds for clearing refresh credentials.
 */
export function isRejectedAuthUserRequest(
  input: RequestInfo | URL,
  response: ResponseLike,
): boolean {
  if (response.status !== 401 && response.status !== 403) return false;

  try {
    return new URL(requestUrl(input)).pathname.endsWith(AUTH_USER_PATH);
  } catch {
    return requestUrl(input).includes(AUTH_USER_PATH);
  }
}

export function isRejectedRefreshTokenRequest(
  input: RequestInfo | URL,
  response: ResponseLike,
): boolean {
  if (response.status !== 400 && response.status !== 401 && response.status !== 403) return false;

  try {
    const url = new URL(requestUrl(input));
    return url.pathname.endsWith(AUTH_TOKEN_PATH)
      && url.searchParams.get('grant_type') === 'refresh_token';
  } catch {
    const url = requestUrl(input);
    return url.includes(AUTH_TOKEN_PATH) && url.includes('grant_type=refresh_token');
  }
}

export function createAuthRecoveryFetch(
  _clearLocalSession: () => Promise<unknown>,
  nativeFetch: typeof fetch = fetch,
): typeof fetch {
  // Only the SDK may classify refresh failures and remove sessions under its
  // concurrency guards. A fetch-level sign-out can erase a newer session.
  // Retain the callback argument for compatibility with the managed client.
  return (input, init) => nativeFetch(input, init);
}
