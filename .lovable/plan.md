# Fix Costing PDF photos and file size

## Changes
- Convert every PDF photo in the browser to a standard compressed JPEG before PDF generation, with a fixed maximum resolution so unusual camera JPEG formats render reliably and the PDF remains email-friendly.
- Keep two separate values per item photo: the compressed embedded image for display and a temporary secure HTTPS link for clicking/opening the original.
- Use the HTTPS link in the PDF click action instead of the embedded `data:` image, which Adobe Acrobat blocks.
- Apply lighter, size-appropriate conversion to the cover photo and company logo as well.

## Verification
- Run the existing checks and confirm the app builds without errors.
- Generate the currently open report through the browser, inspect console errors, download the PDF, check its size, render its pages for visual inspection, and verify photo links are HTTPS rather than `data:` URLs.
