import { Category, MediaType } from '@prisma/client';

/**
 * Category is derived from MediaType per the API contract:
 *  AUDIO, VOICE                  -> AUDIO
 *  VIDEO, VIDEO_NOTE, ANIMATION  -> VIDEO
 *  PHOTO, STICKER                -> IMAGE_STICKER
 */
export function categoryForMediaType(mediaType: MediaType): Category {
  switch (mediaType) {
    case MediaType.AUDIO:
    case MediaType.VOICE:
      return Category.AUDIO;
    case MediaType.VIDEO:
    case MediaType.VIDEO_NOTE:
    case MediaType.ANIMATION:
      return Category.VIDEO;
    case MediaType.PHOTO:
    case MediaType.STICKER:
      return Category.IMAGE_STICKER;
    default: {
      const exhaustiveCheck: never = mediaType;
      throw new Error(`Unhandled MediaType: ${exhaustiveCheck as string}`);
    }
  }
}

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+|(?<![@.\w])www\.[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[)\]}.,!?;:'"]+$/;

/**
 * Extracts all URLs found in a caption/text string, deduping and trimming
 * common trailing punctuation that tends to get swept up by the regex
 * (e.g. a link at the end of a sentence followed by a period).
 */
export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX) ?? [];
  const cleaned = matches.map((url) => url.replace(TRAILING_PUNCTUATION, ''));
  return Array.from(new Set(cleaned));
}
