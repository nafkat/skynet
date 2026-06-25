import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';

interface CostItem {
  id: string;
  title: string | null;
  description: string;
  calculation_type: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  sort_order: number;
  photos: string[];
}

interface SectionAttachment {
  file_name: string;
  url: string;
}

interface CostSection {
  id: string;
  title: string;
  sort_order: number;
  cost_items: CostItem[];
  attachments: SectionAttachment[];
}

interface Company {
  company_name: string;
  vat_number: string;
  tax_office: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string | null;
  logo_url: string | null;
}

interface ReportData {
  code: string;
  version_number: number;
  version_notes: string | null;
  created_at: string;
  status: string;
  cover_photo_path: string | null;
  projects: {
    project_code: string;
    project_name: string;
    customer_company_name: string;
    assigned_shipyard_company: string;
  } | null;
}

const CALC_LABEL: Record<string, { en: string; el: string }> = {
  unit: { en: 'Per Unit', el: 'Ανά Τεμάχιο' },
  lumpsum: { en: 'Lump Sum', el: "Κατ' Αποκοπή" },
  area: { en: 'Area (m²)', el: 'Εμβαδόν (m²)' },
  linear: { en: 'Linear (m)', el: 'Γραμμικά (m)' },
  weight: { en: 'Weight (kg)', el: 'Βάρος (kg)' },
};

export default function CostingReportPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [sections, setSections] = useState<CostSection[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLogoSigned, setCompanyLogoSigned] = useState<string | null>(null);
  const [coverPhotoSigned, setCoverPhotoSigned] = useState<string | null>(null);

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

        const { data: secs } = await supabase
          .from('cost_sections')
          .select(
            'id, title, sort_order, cost_items(id, title, description, calculation_type, quantity, unit, unit_price, sort_order, cost_item_photos(storage_path))',
          )
          .eq('report_id', id)
          .order('sort_order');

        const secsClean: CostSection[] = await Promise.all(
          ((secs as any[]) || []).map(async (s) => {
            const items: CostItem[] = await Promise.all(
              [...(s.cost_items || [])]
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map(async (i: any) => {
                  const paths = (i.cost_item_photos || []).map(
                    (p: any) => p.storage_path,
                  );
                  let urls: string[] = [];
                  if (paths.length > 0) {
                    const { data: signed } = await supabase.storage
                      .from('cost-photos')
                      .createSignedUrls(paths, 60 * 60);
                    urls = (signed || []).map((u) => u.signedUrl).filter(Boolean);
                  }
                  return {
                    id: i.id,
                    title: i.title ?? null,
                    description: i.description,
                    calculation_type: i.calculation_type,
                    quantity: i.quantity,
                    unit: i.unit,
                    unit_price: i.unit_price,
                    sort_order: i.sort_order,
                    photos: urls,
                  };
                }),
            );
            // Section-level attachments with long-lived signed URLs (1 year)
            const { data: atts } = await supabase
              .from('cost_section_attachments')
              .select('storage_path, file_name')
              .eq('section_id', s.id)
              .order('created_at', { ascending: true });
            let attachments: SectionAttachment[] = [];
            if (atts && atts.length > 0) {
              const { data: signed } = await supabase.storage
                .from('cost-attachments')
                .createSignedUrls(atts.map((a: any) => a.storage_path), 60 * 60 * 24 * 365);
              const map = new Map<string, string>();
              (signed || []).forEach((s: any) => s.signedUrl && s.path && map.set(s.path, s.signedUrl));
              attachments = atts.map((a: any) => ({
                file_name: a.file_name,
                url: map.get(a.storage_path) || '',
              })).filter((a) => a.url);
            }
            return {
              id: s.id,
              title: s.title,
              sort_order: s.sort_order,
              cost_items: items,
              attachments,
            };
          }),
        );

        setReport(r as unknown as ReportData);
        setSections(secsClean.filter((s) => s.cost_items.length > 0));

        const companyName = (r as any)?.projects?.assigned_shipyard_company;
        if (companyName) {
          const { data: c } = await supabase
            .from('companies')
            .select('*')
            .eq('company_name', companyName)
            .maybeSingle();
          if (c) {
            setCompany(c as Company);
            if (c.logo_url) {
              const { data: signed } = await supabase.storage
                .from('company-logos')
                .createSignedUrl(c.logo_url, 60 * 60);
              if (signed?.signedUrl) setCompanyLogoSigned(signed.signedUrl);
            }
          }
        }

        // Cover photo
        const coverPath = (r as any)?.cover_photo_path as string | null;
        if (coverPath) {
          const { data: cs } = await supabase.storage
            .from('cost-photos')
            .createSignedUrl(coverPath, 60 * 60);
          if (cs?.signedUrl) setCoverPhotoSigned(cs.signedUrl);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Auto-trigger print after render (unless ?noprint=1)
  useEffect(() => {
    if (loading) return;
    if (params.get('noprint') === '1') return;
    const tmr = setTimeout(() => window.print(), 800);
    return () => clearTimeout(tmr);
  }, [loading, params]);

  const calcTotal = (it: CostItem): number | null => {
    if (it.unit_price === null) return null;
    if (it.calculation_type === 'lumpsum') return it.unit_price;
    if (it.quantity === null) return null;
    return it.quantity * it.unit_price;
  };
  const sectionTotal = (sec: CostSection): number => {
    return sec.cost_items.reduce((acc, i) => acc + (calcTotal(i) ?? 0), 0);
  };
  const grandTotal = sections.reduce((acc, s) => acc + sectionTotal(s), 0);

  const fmt = (n: number | null) =>
    n === null
      ? '—'
      : new Intl.NumberFormat(language === 'el' ? 'el-GR' : 'en-US', {
          style: 'currency',
          currency: 'EUR',
        }).format(n);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">{t('Report not found', 'Η αναφορά δεν βρέθηκε')}</div>
    );
  }

  const dateStr = new Date(report.created_at).toLocaleDateString(
    language === 'el' ? 'el-GR' : 'en-GB',
  );

  return (
    <>
      {/* Toolbar — hidden on print */}
      <div className="no-print sticky top-0 z-50 bg-card border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/costing/reports/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('Back', 'Πίσω')}
        </Button>
        <div className="flex-1 text-sm text-muted-foreground">
          {t('Preview — use the Print button to save as PDF', 'Προεπισκόπηση — πάτα Εκτύπωση για αποθήκευση ως PDF')}
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          {t('Print / Save PDF', 'Εκτύπωση / Αποθήκευση PDF')}
        </Button>
      </div>

      {/* Print styles */}
      <style>{`
        @page {
          size: A4;
          margin: 36mm 16mm 22mm 16mm;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          .print-page-bg { background: white !important; }
          .running-header {
            position: fixed; top: -30mm; left: 0; right: 0;
            border-bottom: 1.5pt solid #0c4a6e;
          }
          .running-footer {
            position: fixed; bottom: -18mm; left: 0; right: 0;
            border-top: 1pt solid #d4d4d8;
            font-size: 8pt;
            color: #555;
            text-align: center;
            padding-top: 4pt;
          }
          .page-break { page-break-after: always; }
          .avoid-break { page-break-inside: avoid; }
        }
        @media screen {
          .print-page {
            max-width: 210mm;
            margin: 16px auto;
            background: white;
            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            padding: 24mm 16mm;
            min-height: 297mm;
          }
        }
      `}</style>

      <div className="print-page-bg bg-muted/30 min-h-screen">
        <div className="print-page text-[10.5pt] text-slate-900 leading-relaxed">

          {/* Running header (logo + company info) — repeats on every page when printed */}
          <div className="running-header bg-white">
            <div className="flex items-start justify-between gap-4 px-1 py-2">
              <div className="flex items-center gap-3">
                {companyLogoSigned ? (
                  <img
                    src={companyLogoSigned}
                    alt="logo"
                    style={{ maxHeight: '14mm', maxWidth: '32mm', objectFit: 'contain' }}
                  />
                ) : null}
                <div className="text-[9pt] leading-tight">
                  <div className="font-bold text-[11pt] text-sky-900">
                    {company?.company_name || report.projects?.assigned_shipyard_company || '—'}
                  </div>
                  {company && (
                    <>
                      <div>{company.address}, {company.postal_code} {company.city}, {company.country}</div>
                      <div>{t('VAT', 'ΑΦΜ')}: {company.vat_number} · {t('Tax Office', 'ΔΟΥ')}: {company.tax_office}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right text-[9pt] leading-tight text-slate-600">
                {company && (
                  <>
                    <div>{company.phone}</div>
                    <div>{company.email}</div>
                    {company.website && <div>{company.website}</div>}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Running footer */}
          <div className="running-footer bg-white">
            {company?.company_name || report.projects?.assigned_shipyard_company} — {report.code}-v{report.version_number}
          </div>

          {/* COVER */}
          <div className="page-break">
            <div className="mt-[40mm] text-center">
              <div className="uppercase tracking-[0.3em] text-[9pt] text-slate-500">
                {t('Cost Proposal', 'Πρόταση Κόστους')}
              </div>
              <h1 className="text-[28pt] font-bold mt-2 text-sky-900">
                {report.projects?.project_name || '—'}
              </h1>
              <div className="text-[12pt] text-slate-600 mt-1">
                {report.projects?.project_code}
              </div>

              <div className="mt-[20mm] grid grid-cols-2 gap-4 max-w-[140mm] mx-auto text-left">
                <CoverRow label={t('Client', 'Πελάτης')} value={report.projects?.customer_company_name || '—'} />
                <CoverRow label={t('Issued by', 'Εκδότης')} value={company?.company_name || report.projects?.assigned_shipyard_company || '—'} />
                <CoverRow label={t('Document', 'Έγγραφο')} value={`${report.code} — v${report.version_number}`} />
                <CoverRow label={t('Date', 'Ημερομηνία')} value={dateStr} />
              </div>

              {report.version_notes && (
                <div className="mt-8 max-w-[140mm] mx-auto text-left border-l-4 border-sky-500 pl-4 italic text-slate-700">
                  "{report.version_notes}"
                </div>
              )}

              <div className="mt-[30mm] inline-block border border-sky-200 bg-sky-50 px-8 py-4 rounded-md">
                <div className="text-[9pt] uppercase tracking-wider text-slate-500">
                  {t('Grand Total', 'Γενικό Σύνολο')}
                </div>
                <div className="text-[24pt] font-bold text-sky-900">{fmt(grandTotal)}</div>
              </div>
            </div>
          </div>

          {/* SECTIONS */}
          {sections.map((sec, sIdx) => (
            <div key={sec.id} className="mb-6">
              <div className="avoid-break">
                <h2 className="text-[14pt] font-bold text-sky-900 border-b-2 border-sky-200 pb-1 mb-3">
                  {sIdx + 1}. {sec.title}
                </h2>
              </div>

              {sec.cost_items.map((item, iIdx) => {
                const total = calcTotal(item);
                return (
                  <div key={item.id} className="avoid-break mb-4 border border-slate-200 rounded-md p-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        {item.title && (
                          <div className="text-[11pt] font-bold uppercase tracking-wide text-sky-900 [overflow-wrap:anywhere]">
                            <span className="mr-1">{sIdx + 1}.{iIdx + 1}</span>
                            {item.title}
                          </div>
                        )}
                        <div className={`${item.title ? 'text-[10pt] mt-0.5' : 'font-semibold text-[11pt]'} whitespace-pre-wrap [overflow-wrap:anywhere]`}>
                          {!item.title && <span className="mr-1">{sIdx + 1}.{iIdx + 1}</span>}
                          {item.description}
                        </div>
                        <div className="text-[9pt] text-slate-600 mt-1">
                          {item.calculation_type === 'lumpsum'
                            ? t('Lump Sum', "Κατ' Αποκοπή")
                            : `${item.quantity ?? '—'} ${item.unit ?? ''} · ${
                                CALC_LABEL[item.calculation_type]?.[language === 'el' ? 'el' : 'en'] ?? item.calculation_type
                              }`}
                        </div>
                      </div>
                      <div className="text-right">
                        {item.calculation_type !== 'lumpsum' && item.unit_price !== null && (
                          <div className="text-[9pt] text-slate-600">
                            {fmt(item.unit_price)} / {item.unit || 'unit'}
                          </div>
                        )}
                        <div className="text-[12pt] font-bold text-sky-900">{fmt(total)}</div>
                      </div>
                    </div>

                    {item.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {item.photos.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('Click to open photo', 'Κλικ για άνοιγμα φωτογραφίας')}
                            style={{ display: 'block', textDecoration: 'none' }}
                          >
                            <img
                              src={url}
                              alt=""
                              crossOrigin="anonymous"
                              style={{
                                width: '100%',
                                height: '38mm',
                                objectFit: 'cover',
                                borderRadius: '3px',
                                border: '1px solid #e5e7eb',
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {sec.attachments.length > 0 && (
                <div className="avoid-break mt-2 mb-3 border border-slate-200 rounded-md p-3 bg-slate-50">
                  <div className="text-[9pt] uppercase tracking-wider text-slate-600 mb-1.5">
                    {t('Attachments', 'Συνημμένα')}
                  </div>
                  <ul className="text-[10pt] space-y-1">
                    {sec.attachments.map((a, i) => (
                      <li key={i}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 underline [overflow-wrap:anywhere]"
                        >
                          📎 {a.file_name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}


              <div className="avoid-break flex justify-end mt-2 mb-4 pr-2">
                <div className="text-[10pt]">
                  <span className="text-slate-600 mr-2">
                    {t('Section Total', 'Σύνολο Τμήματος')}:
                  </span>
                  <span className="font-bold text-sky-900">{fmt(sectionTotal(sec))}</span>
                </div>
              </div>
            </div>
          ))}

          {/* GRAND TOTAL */}
          <div className="avoid-break mt-6 border-t-2 border-sky-300 pt-4 flex justify-between items-center">
            <div className="text-[14pt] font-bold uppercase tracking-wide text-slate-700">
              {t('Grand Total', 'Γενικό Σύνολο')}
            </div>
            <div className="text-[18pt] font-bold text-sky-900">{fmt(grandTotal)}</div>
          </div>

          {/* SIGNATURES */}
          <div className="avoid-break mt-[20mm] page-break">
            <h3 className="text-[12pt] font-semibold mb-6 text-slate-700">
              {t('Signatures', 'Υπογραφές')}
            </h3>
            <div className="grid grid-cols-2 gap-12 mt-[15mm]">
              <SignatureBlock
                label={t('Issued by', 'Εκδότης')}
                name={company?.company_name || report.projects?.assigned_shipyard_company || ''}
              />
              <SignatureBlock
                label={t('Client', 'Πελάτης')}
                name={report.projects?.customer_company_name || ''}
              />
            </div>
            <div className="mt-12 text-[9pt] text-slate-500 italic">
              {t(
                'This document was issued by the company listed above. Prices are valid for 30 days from the date of issue unless otherwise stated.',
                'Το παρόν έγγραφο εκδόθηκε από την παραπάνω εταιρεία. Οι τιμές ισχύουν για 30 ημέρες από την ημερομηνία έκδοσης, εκτός εάν αναφέρεται διαφορετικά.',
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 pb-2">
      <div className="text-[8pt] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[11pt] font-medium">{value}</div>
    </div>
  );
}

function SignatureBlock({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <div className="text-[9pt] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="font-medium mb-[18mm]">{name}</div>
      <div className="border-t border-slate-400 pt-1 text-[9pt] text-slate-600">
        Name / Signature / Date
      </div>
    </div>
  );
}
