export interface ReadClientCredentialsArgs {
  headers: Headers;
  /** Paramètres du corps, lus par `readOAuthParams`. */
  params: Record<string, string>;
}
