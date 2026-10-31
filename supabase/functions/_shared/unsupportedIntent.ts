/** No configured writer means no success: never silently discard an action. */
export function unsupportedIntentResult(intentId: string) {
  return {
    ok: false as const,
    result: { error: 'This action is not connected for this site.', intentId },
    clientActions: [{ type: 'TOAST' as const, message: 'This action is not connected for this site.', level: 'error' }],
  };
}