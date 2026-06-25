import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { pdf, PDFViewer } from '@react-pdf/renderer';
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
                    const { data: signed } = await supabase.storage
                      .from('cost-photos')
                      .createSignedUrls(paths, 60 * 60 * 24);
                    urls = (signed || []).map((u: any) => u.signedUrl).filter(Boolean);
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
              const { data: signed } = await supabase.storage
                .from('company-logos')
                .createSignedUrl(c.logo_url, 60 * 60 * 24);
              if (signed?.signedUrl) logoUrl = signed.signedUrl;
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
  const doc = <CostingReportPdfDoc data={data} />;

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
        <PDFDownloadLink document={doc} fileName={fileName}>
          {({ loading: l }) => (
            <Button size="sm" disabled={l}>
              {l ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {l ? t('Preparing…', 'Προετοιμασία…') : t('Download PDF', 'Λήψη PDF')}
            </Button>
          )}
        </PDFDownloadLink>
      </div>

      <div className="flex-1 p-4">
        <PDFViewer
          showToolbar={false}
          style={{ width: '100%', height: 'calc(100vh - 110px)', border: 'none' }}
        >
          {doc}
        </PDFViewer>
      </div>
    </div>
  );
}
