import type { Db } from '@/db/client';
import type { ApiUser } from '@/lib/interfaces/api-user.interface';

/**
 * Ce que reçoit chaque tool : la base et l'utilisateur au nom duquel le
 * jeton OAuth a été émis. Les droits sont ceux de l'app, cave par cave.
 */
export interface ToolContext {
  readonly db: Db;
  readonly user: ApiUser;
}
