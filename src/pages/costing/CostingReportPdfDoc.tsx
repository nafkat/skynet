import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register the app font for Greek + Latin PDF output.
Font.register({
  family: 'NotoSansPdf',
  fonts: [
    {
      src: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
      fontWeight: 'bold',
    },
  ],
});

// Keep normal words intact, but allow very long unspaced text to wrap instead of overflowing cells.
Font.registerHyphenationCallback((word) => {
  if (word.length <= 18) return [word];
  const chunks: string[] = [];
  for (let i = 0; i < word.length; i += 18) chunks.push(word.slice(i, i + 18));
  return chunks;
});

export interface PdfPhoto {
  displayUrl: string; // Base64 data URI for embedding
  linkUrl: string;    // HTTPS signed URL for clicking
}

export interface PdfCostItem {
  id: string;
  title: string | null;
  description: string;
  calculation_type: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  photos: PdfPhoto[];
}

export interface PdfAttachment {
  file_name: string;
  url: string;
}

export interface PdfSection {
  id: string;
  title: string;
  items: PdfCostItem[];
  attachments: PdfAttachment[];
}

export interface PdfCompany {
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
  logoUrl: string | null;
}

export interface PdfReportInput {
  language: 'en' | 'el';
  code: string;
  version_number: number;
  version_notes: string | null;
  dateStr: string;
  project: {
    project_code: string;
    project_name: string;
    customer_company_name: string;
  };
  company: PdfCompany | null;
  coverPhotoUrl: string | null;
  sections: PdfSection[];
}

const SKY_900 = '#0c4a6e';
const SKY_700 = '#0369a1';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_200 = '#e2e8f0';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansPdf',
    fontSize: 9.5,
    color: '#0f172a',
    paddingTop: 88, // room for running header
    paddingBottom: 52, // room for running footer
    paddingHorizontal: 38,
    lineHeight: 1.35,
  },
  header: {
    position: 'absolute',
    top: 18,
    left: 38,
    right: 38,
    borderBottomWidth: 1.2,
    borderBottomColor: SKY_900,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 60, height: 40, objectFit: 'contain', marginRight: 8 },
  headerInfo: { fontSize: 8, color: SLATE_600, lineHeight: 1.3 },
  headerCompany: { fontSize: 10, fontWeight: 'bold', color: SKY_900, marginBottom: 1 },
  headerRight: { fontSize: 8, color: SLATE_600, textAlign: 'right', lineHeight: 1.3 },
  footer: {
    position: 'absolute',
    top: 812,
    left: 38,
    right: 38,
    borderTopWidth: 0.8,
    borderTopColor: SLATE_300,
    paddingTop: 4,
    fontSize: 8,
    color: SLATE_500,
    textAlign: 'center',
  },
  // Cover
  coverWrap: { marginTop: 46, alignItems: 'center' },
  coverEyebrow: { fontSize: 9, letterSpacing: 0, color: SLATE_500, textTransform: 'uppercase' },
  coverTitle: { width: '86%', fontSize: 20, lineHeight: 1.25, fontWeight: 'bold', color: SKY_900, marginTop: 10, textAlign: 'center' },
  coverCode: { fontSize: 11, color: SLATE_600, marginTop: 10 },
  coverGrid: { marginTop: 32, width: '85%', flexDirection: 'row', flexWrap: 'wrap' },
  coverCell: { width: '50%', paddingVertical: 6, paddingRight: 8, borderBottomWidth: 0.6, borderBottomColor: SLATE_200 },
  coverLabel: { fontSize: 7.5, letterSpacing: 0, color: SLATE_500, textTransform: 'uppercase', marginBottom: 2 },
  coverValue: { fontSize: 10.5 },
  coverNotes: {
    marginTop: 18, width: '85%', paddingLeft: 10,
    borderLeftWidth: 3, borderLeftColor: SKY_700,
    color: SLATE_700, fontSize: 10,
  },
  coverPhoto: { marginTop: 28, maxWidth: 360, maxHeight: 220, objectFit: 'contain', borderWidth: 0.5, borderColor: SLATE_200 },
  // Sections
  sectionTitle: {
    fontSize: 13, fontWeight: 'bold', color: SKY_900,
    borderBottomWidth: 1.5, borderBottomColor: '#bae6fd',
    paddingBottom: 3, marginBottom: 8, marginTop: 4,
  },
  item: {
    borderWidth: 0.6, borderColor: SLATE_200, borderRadius: 3,
    padding: 8, marginBottom: 10,
  },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemLeft: { flex: 1, paddingRight: 8 },
  itemRight: { width: 110, alignItems: 'flex-end' },
  itemTitle: { fontSize: 10.5, fontWeight: 'bold', color: SKY_900 },
  itemDescTitled: { fontSize: 9.5, marginTop: 2 },
  itemDescNoTitle: { fontSize: 10.5, fontWeight: 'bold' },
  itemMeta: { fontSize: 8.5, color: SLATE_600, marginTop: 3 },
  itemUnit: { fontSize: 8.5, color: SLATE_600 },
  itemTotal: { fontSize: 11.5, fontWeight: 'bold', color: SKY_900, marginTop: 1 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginHorizontal: -2 },
  photoCell: { width: '50%', padding: 2 },
  photo: { width: '100%', height: 104, objectFit: 'cover', borderWidth: 0.5, borderColor: SLATE_200, borderRadius: 2 },
  // Attachments
  attBox: {
    marginTop: 4, marginBottom: 10, padding: 8,
    borderWidth: 0.6, borderColor: SLATE_200, borderRadius: 3,
    backgroundColor: SLATE_50,
  },
  attHeader: { fontSize: 8, letterSpacing: 0, color: SLATE_600, textTransform: 'uppercase', marginBottom: 4 },
  attLink: { fontSize: 9.5, color: SKY_700, textDecoration: 'underline', marginBottom: 2 },
  // Totals
  grandRow: {
    marginTop: 14, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: '#7dd3fc',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  grandLabel: { fontSize: 13, fontWeight: 'bold', color: SLATE_700, textTransform: 'uppercase', letterSpacing: 0 },
  grandValue: { fontSize: 17, fontWeight: 'bold', color: SKY_900 },
  breakdownBox: {
    marginTop: 14, padding: 10,
    borderWidth: 0.6, borderColor: SLATE_200, borderRadius: 3, backgroundColor: SLATE_50,
  },
  breakdownTitle: { fontSize: 10, fontWeight: 'bold', color: SLATE_700, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 6 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.4, borderBottomColor: SLATE_200 },
  breakdownLabel: { fontSize: 9.5, color: SLATE_700, flex: 1, paddingRight: 8 },
  breakdownValue: { fontSize: 9.5, fontWeight: 'bold', color: SKY_900 },
});

const CALC_LABEL: Record<string, { en: string; el: string }> = {
  unit: { en: 'Per Unit', el: 'Ανά Τεμάχιο' },
  lumpsum: { en: 'Lump Sum', el: "Κατ' Αποκοπή" },
  area: { en: 'Area (m²)', el: 'Εμβαδόν (m²)' },
  linear: { en: 'Linear (m)', el: 'Γραμμικά (m)' },
  weight: { en: 'Weight (kg)', el: 'Βάρος (kg)' },
};

function calcTotal(it: PdfCostItem): number | null {
  if (it.unit_price === null) return null;
  if (it.calculation_type === 'lumpsum') return it.unit_price;
  if (it.quantity === null) return null;
  return it.quantity * it.unit_price;
}

function sectionSum(s: PdfSection): number {
  return s.items.reduce((a, i) => a + (calcTotal(i) ?? 0), 0);
}

function makeFmt(language: 'en' | 'el') {
  const nf = new Intl.NumberFormat(language === 'el' ? 'el-GR' : 'en-US', {
    style: 'currency', currency: 'EUR',
  });
  return (n: number | null) => (n === null ? '—' : nf.format(n));
}

const t = (lang: 'en' | 'el') => (en: string, el: string) => (lang === 'el' ? el : en);

export function CostingReportPdfDoc({ data }: { data: PdfReportInput }) {
  const fmt = makeFmt(data.language);
  const tr = t(data.language);
  const grand = data.sections.reduce((a, s) => a + sectionSum(s), 0);
  const headerCompany = data.company?.company_name || '';
  const footerLabel = `${headerCompany ? headerCompany + ' · ' : ''}${data.code} v${data.version_number}`;

  const Header = () => (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        {data.company?.logoUrl ? (
          <Image src={data.company.logoUrl} style={styles.headerLogo} />
        ) : null}
        <View>
          <Text style={styles.headerCompany}>
            {data.company?.company_name || '—'}
          </Text>
          {data.company && (
            <>
              <Text style={styles.headerInfo}>
                {data.company.address}, {data.company.postal_code} {data.company.city}, {data.company.country}
              </Text>
              <Text style={styles.headerInfo}>
                {tr('VAT', 'ΑΦΜ')}: {data.company.vat_number} · {tr('Tax Office', 'ΔΟΥ')}: {data.company.tax_office}
              </Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.headerRight}>
        {data.company && (
          <>
            <Text>{data.company.phone}</Text>
            <Text>{data.company.email}</Text>
            {data.company.website ? <Text>{data.company.website}</Text> : null}
          </>
        )}
      </View>
    </View>
  );

  const Footer = () => (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `${tr('Page', 'Σελίδα')} ${pageNumber} / ${totalPages}  ·  ${footerLabel}`
      }
    />
  );

  return (
    <Document
      title={`${data.code}-v${data.version_number}`}
      author={headerCompany}
      subject={data.project.project_name}
    >
      {/* COVER PAGE */}
      <Page size="A4" style={styles.page}>
        <Header />
        <Footer />
        <View style={styles.coverWrap}>
          <Text style={styles.coverEyebrow}>{tr('Cost Proposal', 'Πρόταση Κόστους')}</Text>
          <Text style={styles.coverTitle}>{data.project.project_name || '—'}</Text>
          <Text style={styles.coverCode}>{data.project.project_code}</Text>

          <View style={styles.coverGrid}>
            <CoverCell label={tr('Client', 'Πελάτης')} value={data.project.customer_company_name || '—'} />
            <CoverCell label={tr('Issued by', 'Εκδότης')} value={headerCompany || '—'} />
            <CoverCell label={tr('Document', 'Έγγραφο')} value={`${data.code} — v${data.version_number}`} />
            <CoverCell label={tr('Date', 'Ημερομηνία')} value={data.dateStr} />
          </View>

          {data.version_notes ? (
            <Text style={styles.coverNotes}>"${data.version_notes}"</Text>
          ) : null}

          {data.coverPhotoUrl ? (
            <Image src={data.coverPhotoUrl} style={styles.coverPhoto} />
          ) : null}
        </View>
      </Page>

      {/* CONTENT */}
      <Page size="A4" style={styles.page}>
        <Header />
        <Footer />

        {data.sections.map((sec, sIdx) => {
          const renderItem = (item: PdfCostItem, iIdx: number) => {
              const total = calcTotal(item);
              const isLump = item.calculation_type === 'lumpsum';
              const calcLabel = CALC_LABEL[item.calculation_type]?.[data.language] ?? item.calculation_type;
              return (
                <View key={item.id} style={styles.item} wrap={false}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemLeft}>
                      {item.title ? (
                        <Text style={styles.itemTitle}>
                          {sIdx + 1}.{iIdx + 1} {item.title}
                        </Text>
                      ) : null}
                      <Text style={item.title ? styles.itemDescTitled : styles.itemDescNoTitle}>
                        {!item.title ? `${sIdx + 1}.${iIdx + 1} ` : ''}
                        {item.description}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {isLump
                          ? tr('Lump Sum', "Κατ' Αποκοπή")
                          : `${item.quantity ?? '—'} ${item.unit ?? ''} · ${calcLabel}`}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      {!isLump && item.unit_price !== null ? (
                        <Text style={styles.itemUnit}>
                          {fmt(item.unit_price)} / {item.unit || 'unit'}
                        </Text>
                      ) : null}
                      <Text style={styles.itemTotal}>{fmt(total)}</Text>
                    </View>
                  </View>

                  {item.photos.length > 0 ? (
                    <View style={styles.photosGrid}>
                      {item.photos.slice(0, 2).map((photo, i) => (
                        <View key={i} style={styles.photoCell}>
                          <Link key={i} src={photo.linkUrl}>
                            <Image src={photo.displayUrl} style={styles.photo} />
                          </Link>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            };

          const [firstItem, ...restItems] = sec.items;

          return (
          <View key={sec.id}>
            {firstItem ? (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>
                  {sIdx + 1}. {sec.title}
                </Text>
                {renderItem(firstItem, 0)}
              </View>
            ) : (
              <Text style={styles.sectionTitle}>
                {sIdx + 1}. {sec.title}
              </Text>
            )}

            {restItems.map((item, idx) => renderItem(item, idx + 1))}

            {sec.attachments.length > 0 ? (
              <View style={styles.attBox} wrap={false}>
                <Text style={styles.attHeader}>{tr('Attachments', 'Συνημμένα')}</Text>
                {sec.attachments.map((a, i) => (
                  <Link key={i} src={a.url} style={styles.attLink}>
                    {`${i + 1}. ${a.file_name}`}
                  </Link>
                ))}
              </View>
            ) : null}
          </View>
          );
        })}

        {/* GRAND TOTAL */}
        <View style={styles.grandRow} wrap={false}>
          <Text style={styles.grandLabel}>{tr('Grand Total', 'Γενικό Σύνολο')}</Text>
          <Text style={styles.grandValue}>{fmt(grand)}</Text>
        </View>

        {/* BREAKDOWN */}
        {data.sections.length > 0 ? (
          <View style={styles.breakdownBox} wrap={false}>
            <Text style={styles.breakdownTitle}>
              {tr('Breakdown by Section', 'Ανάλυση ανά Τμήμα')}
            </Text>
            {data.sections.map((s, i) => (
              <View key={s.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {i + 1}. {s.title}
                </Text>
                <Text style={styles.breakdownValue}>{fmt(sectionSum(s))}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function CoverCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.coverCell}>
      <Text style={styles.coverLabel}>{label}</Text>
      <Text style={styles.coverValue}>{value}</Text>
    </View>
  );
}
