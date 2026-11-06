import { describe, it, expect } from 'vitest';
import { isAllowedRedirectUri } from './redirectUris';

describe('isAllowedRedirectUri', () => {
  it.each([
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback',
    'http://localhost:6274/oauth/callback',
    'http://127.0.0.1:33418/callback',
    'http://[::1]:8080/callback',
  ])('accepte %s', (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(true);
  });

  it.each([
    ['un autre site', 'https://evil.example.com/callback'],
    ['un sous-domaine imité', 'https://claude.ai.evil.example.com/callback'],
    ['claude.ai en http', 'http://claude.ai/api/mcp/auth_callback'],
    ['claude.ai sur un autre port', 'https://claude.ai:8443/api/mcp/auth_callback'],
    ['localhost en https sur un faux hôte', 'https://localhost.evil.example.com/callback'],
    ['un fragment', 'https://claude.ai/api/mcp/auth_callback#x'],
    ['des identifiants', 'https://user:pass@claude.ai/api/mcp/auth_callback'],
    ['un schéma javascript', 'javascript:alert(1)'],
    ['une chaîne qui n’est pas une adresse', 'pas une url'],
  ])('refuse %s', (_label, uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(false);
  });
});
