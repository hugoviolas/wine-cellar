/**
 * Codes d'erreur OAuth renvoyés tels quels au client (RFC 6749 §5.2,
 * RFC 7591 §3.2.2, RFC 8707 §2). Ce sont des identifiants de protocole, lus
 * par une machine : ils restent en anglais.
 */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unsupported_grant_type'
  | 'invalid_target'
  | 'invalid_client_metadata'
  | 'invalid_redirect_uri';

/**
 * Refus prévu par le protocole, à renvoyer au client sous la forme
 * `{ error, error_description }`. Toute autre exception est un bug, et
 * remonte comme tel.
 */
export class OAuthError extends Error {
  readonly code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, description: string) {
    super(description);
    this.name = 'OAuthError';
    this.code = code;
  }
}
