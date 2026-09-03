/**
 * The one handle shape in the product: 3-20 chars of a-z, 0-9, underscore.
 * Shared by onboarding (suggest/check/complete) and profile edits so the two
 * paths can never drift apart.
 */
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;