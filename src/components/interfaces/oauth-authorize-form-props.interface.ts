export interface OAuthAuthorizeFormProps {
  /** Paramètres de la demande, renvoyés tels quels à l'envoi du formulaire. */
  params: Record<string, string>;
  clientName: string | null;
  /** Hôte vers lequel l'autorisation sera renvoyée (claude.ai, localhost...). */
  redirectHost: string;
}
