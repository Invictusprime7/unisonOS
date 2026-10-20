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
  clearLocalSession: () => Promise<unknown>,
  nativeFetch: typeof fetch = fetch,
): typeof fetch {
  let recoveryInFlight = false;

  return async (input, init) => {
    const response = await nativeFetch(input, init);
    // An access-token rejection can be recovered with the refresh token.
    // Signing out here races the caller's refresh and deletes that credential.
    const rejectedSession = isRejectedRefreshTokenRequest(input, response);
    if (rejectedSession && !recoveryInFlight) {
      recoveryInFlight = true;
      void clearLocalSession().catch(() => undefined).finally(() => {
        recoveryInFlight = false;
      });
    }
    return response;
  };
}
