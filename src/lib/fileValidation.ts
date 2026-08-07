// src/lib/fileValidation.ts
// Centralized file upload validation — Phase 1 security gate.
// Used by every upload path in the app. No upload feature ships without it.

export type FileCategory = 'image' | 'attachment' | 'audio';

interface CategoryRule {
  maxBytes: number;
  mimeTypes: readonly string[];
  extensions: readonly string[];
  labelEn: string;
  labelEl: string;
}

const MB = 1024 * 1024;

export const FILE_RULES: Record<FileCategory, CategoryRule> = {
  image: {
    maxBytes: 10 * MB,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    labelEn: 'image (JPG, PNG, WebP, GIF)',
    labelEl: 'εικόνα (JPG, PNG, WebP, GIF)',
  },
  attachment: {
    maxBytes: 10 * MB,
    mimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'],
    labelEn: 'document (PDF, Word, Excel, TXT, CSV) or image',
    labelEl: 'έγγραφο (PDF, Word, Excel, TXT, CSV) ή εικόνα',
  },
  audio: {
    maxBytes: 25 * MB,
    mimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a'],
    extensions: ['.webm', '.m4a', '.mp3', '.ogg', '.wav'],
    labelEn: 'audio (WebM, M4A, MP3, OGG, WAV)',
    labelEl: 'ήχος (WebM, M4A, MP3, OGG, WAV)',
  },
};

export interface FileValidationResult {
  ok: boolean;
  errorEn?: string;
  errorEl?: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

/** Strips codec parameters, e.g. "audio/webm;codecs=opus" -> "audio/webm". */
function baseMime(type: string): string {
  return type.split(';')[0].trim().toLowerCase();
}

/**
 * Validates a file against the rules of a category:
 * 1. Extension whitelist
 * 2. MIME type whitelist
 * 3. Size limit
 * Returns bilingual error messages for toast display.
 */
export function validateFile(file: File, category: FileCategory): FileValidationResult {
  const rule = FILE_RULES[category];
  const ext = extOf(file.name);

  if (!rule.extensions.includes(ext)) {
    return {
      ok: false,
      errorEn: `"${file.name}": file type not allowed. Allowed: ${rule.extensions.join(' ')}`,
      errorEl: `"${file.name}": ο τύπος αρχείου δεν επιτρέπεται. Επιτρεπόμενοι: ${rule.extensions.join(' ')}`,
    };
  }

  if (file.type && !rule.mimeTypes.includes(baseMime(file.type))) {
    return {
      ok: false,
      errorEn: `"${file.name}": invalid file format. Expected ${rule.labelEn}.`,
      errorEl: `"${file.name}": μη έγκυρη μορφή αρχείου. Αναμενόμενο: ${rule.labelEl}.`,
    };
  }

  if (file.size > rule.maxBytes) {
    const limitMB = Math.round(rule.maxBytes / MB);
    return {
      ok: false,
      errorEn: `"${file.name}" exceeds the ${limitMB}MB limit.`,
      errorEl: `Το "${file.name}" υπερβαίνει το όριο των ${limitMB}MB.`,
    };
  }

  return { ok: true };
}

/**
 * Magic-byte sniffing for images: verifies the actual file content
 * matches an allowed image format (catches renamed .exe/.svg files).
 * Returns true if the content is a genuine JPEG, PNG, WebP or GIF.
 */
export async function validateImageContent(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return true;
  return false;
}

/** Builds an `accept` attribute string from a category's extensions. */
export function acceptAttr(category: FileCategory): string {
  return FILE_RULES[category].extensions.join(',');
}
