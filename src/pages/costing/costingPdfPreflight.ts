import type { PdfReportInput, PdfCostItem, PdfSection } from './CostingReportPdfDoc';

export type PreflightSeverity = 'error' | 'warning' | 'info';

export interface PreflightIssue {
  severity: PreflightSeverity;
  message: { en: string; el: string };
}

export interface PreflightResult {
  issues: PreflightIssue[];
  ok: boolean; // no errors
}

// A4 = 842pt tall, page padding top 88 + bottom 52 → ~702pt content height.
// Items use wrap={false}, so any single item taller than this gets visually clipped.
const CONTENT_HEIGHT = 702;
const SAFE_ITEM_HEIGHT = 650;

function estimateItemHeight(it: PdfCostItem): number {
  // base padding + top row
  let h = 24 + 18;
  // description lines: ~85 chars per line at fontSize 10.5/9.5
  const descChars = (it.description || '').length + (it.title ? it.title.length + 6 : 0);
  const descLines = Math.max(1, Math.ceil(descChars / 80));
  h += descLines * 13;
  if (it.title) h += 14;
  // meta row
  h += 14;
  // photos grid: PDF renders max 2 photos per item, 2 per row, each ~108pt tall.
  if (it.photos.length > 0) {
    const rows = Math.ceil(Math.min(it.photos.length, 2) / 2);
    h += rows * 110;
  }
  // bottom margin
  h += 10;
  return h;
}

function estimateAttBoxHeight(s: PdfSection): number {
  if (s.attachments.length === 0) return 0;
  return 24 + s.attachments.length * 13 + 10;
}

export interface PreflightInput {
  data: PdfReportInput;
  /** total number of sections returned from DB (before filtering empties) */
  rawSectionCount: number;
}

export function runPdfPreflight({ data, rawSectionCount }: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = [];

  // 1) Missing/empty sections
  const droppedSections = rawSectionCount - data.sections.length;
  if (droppedSections > 0) {
    issues.push({
      severity: 'warning',
      message: {
        en: `${droppedSections} empty section(s) will not appear in the PDF (no items or attachments).`,
        el: `${droppedSections} κενή/ές ενότητα/ες δεν θα εμφανιστούν στο PDF (χωρίς items ή συνημμένα).`,
      },
    });
  }
  if (data.sections.length === 0) {
    issues.push({
      severity: 'error',
      message: {
        en: 'The report has no sections with content.',
        el: 'Η αναφορά δεν έχει ενότητες με περιεχόμενο.',
      },
    });
  }

  // 2) Items that may be cut (too tall for one page)
  const oversizeItems: string[] = [];
  data.sections.forEach((s, sIdx) => {
    s.items.forEach((it, iIdx) => {
      const h = estimateItemHeight(it);
      if (h > CONTENT_HEIGHT) {
        oversizeItems.push(`${sIdx + 1}.${iIdx + 1}`);
      } else if (h > SAFE_ITEM_HEIGHT) {
        oversizeItems.push(`${sIdx + 1}.${iIdx + 1}`);
      }
    });
    // Attachments box uses wrap={false} as well
    const attH = estimateAttBoxHeight(s);
    if (attH > SAFE_ITEM_HEIGHT) {
      oversizeItems.push(`${sIdx + 1} (attachments)`);
    }
  });
  if (oversizeItems.length > 0) {
    issues.push({
      severity: 'warning',
      message: {
        en: `Item(s) ${oversizeItems.join(', ')} may not fit a single page (too many photos or long text) and could be clipped.`,
        el: `Το/Τα item ${oversizeItems.join(', ')} ίσως δεν χωρά/ούν σε μία σελίδα (πολλές φωτογραφίες ή μεγάλο κείμενο) και ενδέχεται να κοπεί/ούν.`,
      },
    });
  }

  // 3) Items with missing pricing
  const tooManyPhotos: string[] = [];
  data.sections.forEach((s, sIdx) => {
    s.items.forEach((it, iIdx) => {
      if (it.photos.length > 2) tooManyPhotos.push(`${sIdx + 1}.${iIdx + 1}`);
    });
  });
  if (tooManyPhotos.length > 0) {
    issues.push({
      severity: 'info',
      message: {
        en: `Item(s) ${tooManyPhotos.join(', ')} have more than 2 photos; only the first 2 will be shown in the PDF.`,
        el: `Το/Τα item ${tooManyPhotos.join(', ')} έχει/έχουν πάνω από 2 φωτογραφίες· στο PDF θα εμφανιστούν μόνο οι πρώτες 2.`,
      },
    });
  }

  // 4) Items with missing pricing
  const missingPrice: string[] = [];
  data.sections.forEach((s, sIdx) => {
    s.items.forEach((it, iIdx) => {
      if (it.unit_price === null) missingPrice.push(`${sIdx + 1}.${iIdx + 1}`);
      else if (it.calculation_type !== 'lumpsum' && it.quantity === null) {
        missingPrice.push(`${sIdx + 1}.${iIdx + 1}`);
      }
    });
  });
  if (missingPrice.length > 0) {
    issues.push({
      severity: 'info',
      message: {
        en: `Item(s) ${missingPrice.join(', ')} have no total (missing price or quantity).`,
        el: `Το/Τα item ${missingPrice.join(', ')} δεν έχει/έχουν σύνολο (λείπει τιμή ή ποσότητα).`,
      },
    });
  }

  // 5) Footer/pagination sanity — verify required identifiers exist (the footer
  //    renders `code v{n}`; without them the page numbering still works but the
  //    footer label would be incomplete).
  if (!data.code || data.version_number == null) {
    issues.push({
      severity: 'warning',
      message: {
        en: 'Report code or version is missing — footer label will be incomplete.',
        el: 'Λείπει κωδικός ή έκδοση — η ετικέτα footer θα είναι ελλιπής.',
      },
    });
  }
  if (!data.company) {
    issues.push({
      severity: 'info',
      message: {
        en: 'No issuing company linked — header will show a placeholder.',
        el: 'Δεν έχει συνδεθεί εταιρεία έκδοσης — η κεφαλίδα θα δείχνει placeholder.',
      },
    });
  }

  const ok = !issues.some((i) => i.severity === 'error');
  return { issues, ok };
}
