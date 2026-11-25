/**
 * Where AI Mode sends requests. The ONLY place this is configured.
 *
 * The API key is sent to this host and nowhere else. The manifest host permission and the privacy note
 * in Settings are derived from it, so changing this one constant (and rebuilding) is all that is needed
 * to use an Anthropic-compatible router instead of Anthropic directly.
 *
 * Defaults to Anthropic. To use an Anthropic-compatible router for a local demo, change it and rebuild;
 * revert before sharing the extension with other people or publishing it.
 */
export const API_BASE_URL = 'https://api.anthropic.com';

/** Manifest `host_permissions` entry for the API host. */
export const API_HOST_PERMISSION = `${API_BASE_URL}/*`;

/** Host name shown to the user (e.g. in the privacy note). */
export const API_HOST = new URL(API_BASE_URL).host;
