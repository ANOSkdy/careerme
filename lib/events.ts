export async function trackEvent(event: { type: string; correlationId?: string; payload?: Record<string, unknown> }) {
  console.info('event', event.type, { correlationId: event.correlationId, payload: event.payload })
}
