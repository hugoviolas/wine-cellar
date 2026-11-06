import type { Db } from '../../../db/client';
import type { AuthorizationRequest } from './authorization-request.interface';

export interface IssueAuthorizationCodeArgs {
  db: Db;
  request: AuthorizationRequest;
  userId: string;
}
