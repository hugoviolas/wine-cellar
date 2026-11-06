export interface BuildErrorRedirectArgs {
  redirectUri: string;
  state: string | null;
  error: string;
  description: string;
}
