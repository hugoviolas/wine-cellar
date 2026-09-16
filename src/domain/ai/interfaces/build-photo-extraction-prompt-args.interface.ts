import type { AiImageMediaType } from '../schemas';

export interface BuildPhotoExtractionPromptArgs {
  readonly imageBase64: string;
  readonly mediaType: AiImageMediaType;
}
