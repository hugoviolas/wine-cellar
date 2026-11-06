export interface JsonRpcErrorArgs {
  status: number;
  /** Code d'erreur JSON-RPC (-32700 : JSON illisible, -32600 : requête invalide…). */
  code: number;
  message: string;
  /** En-tête `Allow`, pour un 405. */
  allow?: string;
}
