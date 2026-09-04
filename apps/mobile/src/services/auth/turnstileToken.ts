/**
 * Shared token slot between the Turnstile widget (`TurnstileWidget.tsx`) and the
 * imperative `acquireTurnstileToken()` calls in the auth hooks. The widget writes a
 * freshly-minted token here; the auth flow reads it and, on consume, tells the widget
 * to execute again for the next attempt.
 */

let currentToken: string | undefined;
let consumeHandler: ((consume: boolean) => void) | undefined;
const waiters = new Set<(token: string | undefined) => void>();

export function setTurnstileTokenHandler(handler: ((consume: boolean) => void) | undefined) {
  consumeHandler = handler;
}

/** Called by the widget on a real `turnstile-callback` token. */
export function setToken(token: string) {
  currentToken = token;
  flushWaiters(token);
}

/** Called by the widget when the challenge errored or expired. */
export function clearToken() {
  currentToken = undefined;
  flushWaiters(undefined);
}

function flushWaiters(token: string | undefined) {
  for (const resolve of [...waiters]) {
    waiters.delete(resolve);
    resolve(token);
  }
}

function consume(): string | undefined {
  const token = currentToken;
  currentToken = undefined;
  if (consumeHandler) consumeHandler(true);
  return token;
}

/**
 * Returns the current widget token, waiting up to `timeoutMs` for the widget to mint one
 * on first submission. Consuming clears it (Turnstile tokens are single-use + short-lived)
 * and nudges the widget to execute again for the next attempt.
 */
export function takeTurnstileToken(timeoutMs = 5000): Promise<string | undefined> {
  const ready = consume();
  if (ready !== undefined) return Promise.resolve(ready);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(waiter);
      if (consumeHandler) consumeHandler(true);
      resolve(undefined);
    }, timeoutMs);

    const waiter = (token?: string) => {
      clearTimeout(timer);
      waiters.delete(waiter);
      if (consumeHandler) consumeHandler(true);
      resolve(token);
    };

    waiters.add(waiter);
  });
}
