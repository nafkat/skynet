import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import {
  CostingReportPdfDoc,
  type PdfReportInput,
  type PdfSection,
  type PdfCompany,
} from './CostingReportPdfDoc';
import { runPdfPreflight, type PreflightIssue } from './costingPdfPreflight';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * Downloads a storage object through the Supabase client (session-aware, RLS respected)
 * and returns it as a base64 data URI. react-pdf v4 fails silently on remote signed URLs,
 * so images must be embedded as data URIs.
 */
async function downloadAsDataUri(bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(data);
    });
  } catch {
    return null;
  }
}

export default function CostingReportPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PdfReportInput | null>(null);
  const [rawSectionCount, setRawSectionCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [issues, setIssues] = useState<PreflightIssue[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const { data: r } = await supabase
          .from('cost_reports')
          .select(
            'code, version_number, status, version_notes, created_at, cover_photo_path, projects(project_code, project_name, customer_company_name, assigned_shipyard_company)',
          )
          .eq('id', id)
          .single();

        if (!r) return;

        const { data: secs } = await supabase
          .from('cost_sections')
          .select(
            'id, title, sort_order, cost_items(id, title, description, calculation_type, quantity, unit, unit_price, sort_order, cost_item_photos(storage_path))',
          )
          .eq('report_id', id)
          .order('sort_order');

        const pdfSections: PdfSection[] = await Promise.all(
          ((secs as any[]) || []).map(async (s: any) => {
            const items = await Promise.all(
              [...(s.cost_items || [])]
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map(async (i: any) => {
                  const paths: string[] = (i.cost_item_photos || []).map(
                    (p: any) => p.storage_path,
                  );
                  let urls: string[] = [];
                  if (paths.length > 0) {
                    const results = await Promise.all(
                      paths.map((p) => downloadAsDataUri('cost-photos', p)),
                    );
                    urls = results.filter((u): u is string => !!u);
                  }
                  return {
                    id: i.id,
                    title: i.title ?? null,
                    description: i.description,
                    calculation_type: i.calculation_type,
                    quantity: i.quantity,
                    unit: i.unit,
                    unit_price: i.unit_price,
                    photos: urls,
                  };
                }),
            );

            const { data: atts } = await supabase
              .from('cost_section_attachments')
              .select('storage_path, file_name')
              .eq('section_id', s.id)
              .order('created_at', { ascending: true });

            let attachments: { file_name: string; url: string }[] = [];
            if (atts && atts.length > 0) {
              const { data: signed } = await supabase.storage
                .from('cost-attachments')
                .createSignedUrls(
                  atts.map((a: any) => a.storage_path),
                  60 * 60 * 24 * 365,
                );
              const map = new Map<string, string>();
              (signed || []).forEach(
                (sg: any) => sg.signedUrl && sg.path && map.set(sg.path, sg.signedUrl),
              );
              attachments = atts
                .map((a: any) => ({
                  file_name: a.file_name,
                  url: map.get(a.storage_path) || '',
                }))
                .filter((a) => a.url);
            }

            return {
              id: s.id,
              title: s.title,
              items,
              attachments,
            };
          }),
        );

        // Company
        let company: PdfCompany | null = null;
        const companyName = (r as any)?.projects?.assigned_shipyard_company;
        if (companyName) {
          const { data: c } = await supabase
            .from('companies')
            .select('*')
            .eq('company_name', companyName)
            .maybeSingle();
          if (c) {
            let logoUrl: string | null = null;
            if (c.logo_url) {
              logoUrl = await downloadAsDataUri('company-logos', c.logo_url);
            }
            company = {
              company_name: c.company_name,
              vat_number: c.vat_number,
              tax_office: c.tax_office,
              address: c.address,
              city: c.city,
              postal_code: c.postal_code,
              country: c.country,
              phone: c.phone,
              email: c.email,
              website: c.website,
              logoUrl,
            };
          }
        }

        // Cover photo
        let coverPhotoUrl: string | null = null;
        const coverPath = (r as any)?.cover_photo_path as string | null;
        if (coverPath) {
          const { data: cs } = await supabase.storage
            .from('cost-photos')
            .createSignedUrl(coverPath, 60 * 60 * 24);
          if (cs?.signedUrl) coverPhotoUrl = cs.signedUrl;
        }

        const dateStr = new Date(r.created_at as string).toLocaleDateString(
          language === 'el' ? 'el-GR' : 'en-GB',
        );

        // Keep sections that have content (items or attachments)
        const filtered = pdfSections.filter(
          (s) => s.items.length > 0 || s.attachments.length > 0,
        );
        setRawSectionCount(pdfSections.length);

        setData({
          language: language === 'el' ? 'el' : 'en',
          code: r.code as string,
          version_number: r.version_number as number,
          version_notes: (r.version_notes as string | null) ?? null,
          dateStr,
          project: {
            project_code: (r as any).projects?.project_code || '',
            project_name: (r as any).projects?.project_name || '',
            customer_company_name: (r as any).projects?.customer_company_name || '',
          },
          company,
          coverPhotoUrl,
          sections: filtered,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, language]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const fileName = `${data.code}-v${data.version_number}.pdf`;

  const triggerDownload = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const blob = await pdf(<CostingReportPdfDoc data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(t('Failed to generate PDF', 'Αποτυχία δημιουργίας PDF'));
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenPreview = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const blob = await pdf(<CostingReportPdfDoc data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(t('Failed to generate PDF preview', 'Αποτυχία δημιουργίας προεπισκόπησης PDF'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadClick = () => {
    if (!data) return;
    const result = runPdfPreflight({ data, rawSectionCount });
    if (result.issues.length === 0) {
      triggerDownload();
      return;
    }
    setIssues(result.issues);
    setPreflightOpen(true);
    if (!result.ok) {
      // contains an error → block automatic download; user must close.
    }
  };

  const hasErrors = issues.some((i) => i.severity === 'error');

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/costing/reports/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('Back', 'Πίσω')}
        </Button>
        <div className="flex-1 text-sm text-muted-foreground">
          {t(
            'Preview of the final PDF — click Download to save the file',
            'Προεπισκόπηση του τελικού PDF — πάτα Λήψη για αποθήκευση',
          )}
        </div>
        <Button size="sm" disabled={downloading} onClick={handleDownloadClick}>
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {downloading ? t('Preparing…', 'Προετοιμασία…') : t('Download PDF', 'Λήψη PDF')}
        </Button>
      </div>

      <div className="flex-1 p-4">
        <div className="h-[calc(100vh-110px)] rounded-md border bg-card flex flex-col items-center justify-center gap-4 text-center px-6">
          <Info className="h-8 w-8 text-sky-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t('PDF export is ready.', 'Το PDF export είναι έτοιμο.')}
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              {t(
                'Chrome sometimes blocks embedded PDF viewers inside the live preview sandbox. Use Open preview or Download PDF instead.',
                'Ο Chrome μερικές φορές μπλοκάρει ενσωματωμένους PDF viewers μέσα στο sandbox του live preview. Χρησιμοποίησε Άνοιγμα προεπισκόπησης ή Λήψη PDF.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={downloading} onClick={handleOpenPreview}>
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('Open preview', 'Άνοιγμα προεπισκόπησης')}
            </Button>
            <Button size="sm" disabled={downloading} onClick={handleDownloadClick}>
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {t('Download PDF', 'Λήψη PDF')}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={preflightOpen} onOpenChange={setPreflightOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('Pre-download check', 'Έλεγχος πριν τη λήψη')}
            </DialogTitle>
            <DialogDescription>
              {hasErrors
                ? t(
                    'The PDF cannot be generated due to the following issues:',
                    'Το PDF δεν μπορεί να δημιουργηθεί λόγω των παρακάτω ζητημάτων:',
                  )
                : t(
                    'We found some issues. You can still download, but please review:',
                    'Βρέθηκαν κάποια ζητήματα. Μπορείς να κατεβάσεις, αλλά κάνε έναν έλεγχο:',
                  )}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {issues.map((it, idx) => {
              const Icon =
                it.severity === 'error'
                  ? XCircle
                  : it.severity === 'warning'
                    ? AlertTriangle
                    : Info;
              const color =
                it.severity === 'error'
                  ? 'text-destructive'
                  : it.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-sky-600';
              return (
                <li key={idx} className="flex gap-2 text-sm">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
                  <span>{language === 'el' ? it.message.el : it.message.en}</span>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreflightOpen(false)}>
              {t('Cancel', 'Άκυρο')}
            </Button>
            {!hasErrors && (
              <Button
                onClick={() => {
                  setPreflightOpen(false);
                  triggerDownload();
                }}
                disabled={downloading}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('Download anyway', 'Λήψη πάραυτα')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
