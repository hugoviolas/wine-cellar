import type { z } from 'zod';
import type { AiMessageContent } from '../client';

export interface ClaudeJsonCallParams<T> {
  system: string;
  content: AiMessageContent;
  schema: z.ZodType<T>;
}
