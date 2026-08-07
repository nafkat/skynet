# File Upload Validation — Costing Module (Phase 1)

Add a single shared validation gate for every upload path in Costing: allowed file types, real content checks for images, and size limits — with bilingual EN/EL error messages.

## What changes

**1. New shared utility `src/lib/fileValidation.ts`**
- Three categories: `image` (10MB — JPG/PNG/WebP/GIF), `attachment` (10MB — PDF, Word, Excel, TXT, CSV, images), `audio` (25MB — WebM/M4A/MP3/OGG/WAV).
- `validateFile()` checks extension whitelist, MIME whitelist, size limit; returns EN + EL error text.
- `validateImageContent()` reads the first bytes of the file to confirm it really is a JPEG/PNG/GIF/WebP — this catches an `.exe` or `.txt` renamed to `.png`.
- `acceptAttr()` builds the file picker filter string.
- Explicitly excluded: SVG and HTML (they can carry scripts).

**2. Section attachments (`SectionAttachments.tsx`)**
- Replace the size-only check with `validateFile(file, 'attachment')`; drop the old `MAX_BYTES` constant.
- Add `accept` to the file input so the picker only offers allowed types.

**3. Item photos (`CostingReportCreate.tsx`)**
- Validate each picked file (type + real image content) before the preview is created; invalid files are skipped with a bilingual toast.
- Replace `accept="image/*"` with the whitelist.
- Re-validate inside `uploadItemPhoto` right before upload (defense in depth).

**4. Field Entry (`CostingFieldEntry.tsx`)**
- Same photo validation in the photo picker (keeps the existing 2-photo limit untouched) and the same `accept` change.
- Voice note: store the MIME type chosen by the recorder in a ref at recorder-creation time (both recorder setups at lines ~221 and ~280), then validate the recorded blob as `audio` before upload; abort with a bilingual toast if invalid.

## Server-side bucket limits — caveat

The prompt asks for a migration that does `update storage.buckets set allowed_mime_types / file_size_limit`. On this hosting, SQL writes to `storage.buckets` are rejected by the migration tooling, and the bucket-update tool available here only toggles public/private — it cannot set MIME lists or size limits. So the plan is:

- Attempt the bucket-level hardening; if the platform rejects it (expected), report that back rather than working around it.
- Client-side validation in `fileValidation.ts` still applies on every path in the app, and RLS on both buckets (already in place from the earlier security phases) keeps upload access restricted to authorized users.
- True server-side enforcement would need an edge-function upload proxy — out of scope for Phase 1; can be Phase 2 alongside antivirus scanning.

## Out of scope
No antivirus scanning, no new edge functions, no RLS changes. Valid files keep working exactly as before.

## Verification after implementation
- Normal `.jpg` item photo uploads unchanged.
- `.txt`/`.exe` renamed to `.png` → rejected by the content check.
- 11MB PDF attachment → rejected; normal PDF → accepted.
- `.svg` / `.html` → rejected everywhere.
- Voice note record + save → unchanged.
- Typecheck clean.
