## Διάγνωση του τρέχοντος PDF

Ανοίγοντας το `SKYNET _ Lovable.pdf` που μου έστειλες είδα **τέσσερα ξεκάθαρα προβλήματα**:

1. **Browser headers/footers (Date, "SKYNET — Shipyard Operations Platform", URL, page numbers)** εμφανίζονται πάνω-κάτω σε κάθε σελίδα. Αυτά τα προσθέτει ο **Chrome print dialog**, και δεν αφαιρούνται από CSS — αφαιρούνται μόνο αν ο κάθε χρήστης τσεκάρει "Headers and footers: off". Δεν είναι αξιόπιστο.

2. **Το running header (OPTIMUS PRIME logo block) και το running footer (OPTIMUS PRIME — CR-0004-v1) εμφανίζονται στη μέση των σελίδων**, όχι στο πάνω/κάτω άκρο. Αιτία: η τεχνική `position: fixed; top: -38mm` δουλεύει στον browser viewport, όχι ανά printed page — οπότε ο Chrome τα τοποθετεί όπου τύχει αφού γίνει pagination. Είναι θεμελιωδώς λάθος προσέγγιση.

3. **Section headings κόβονται στην κορυφή κάθε σελίδας** (το "1. KAPAKI" και "2. πορτα" φαίνονται μισά πίσω από το running footer που πέφτει εκεί).

4. **Κάποιες φωτογραφίες εμφανίζονται κενές** (λευκά πλαίσια). Πιθανότατα CORS ή timing — το `crossOrigin="anonymous"` με signed URLs αποτυγχάνει σιωπηλά.

Δηλαδή το θέμα δεν είναι «λίγο tuning στα margins» — η όλη προσέγγιση `window.print()` δεν μπορεί να δώσει σταθερό αποτέλεσμα σε όλους τους πελάτες.

## Πρόταση: αντικατάσταση του PDF export

Να εγκαταλείψουμε το `window.print()` και να φτιάξουμε **πραγματικό downloadable PDF** μέσω της βιβλιοθήκης `@react-pdf/renderer` (programmatic PDF generation, full control, ίδια έξοδος σε όλους τους πελάτες, χωρίς Chrome dialog).

### Τι αλλάζει για τον χρήστη
- Στη σελίδα Report Details, το κουμπί **"Export PDF"** δεν θα ανοίγει `/print` με print dialog. Θα κατεβάζει απευθείας ένα αρχείο `CR-0004-v1.pdf`.
- Καμία γραμμή του browser (date/URL/skynet title) δεν θα εμφανίζεται ποτέ.
- Ο header (logo + company info) και ο footer (page X of Y + report code) θα μπαίνουν σωστά σε **κάθε** σελίδα.

### Τι θα περιέχει το PDF (διατηρώντας τις πρόσφατες αποφάσεις)
- **Cover page**: τίτλος έργου, project code, Client / Issued by / Document / Date, version notes, και cover photo αν υπάρχει. **Χωρίς** Grand Total στο εξώφυλλο.
- **Sections με items**: τίτλος item (bold), περιγραφή, ποσότητα/μονάδα/τύπος, unit price, total, και photos σε grid 3 στηλών. Items με `wrap=false` ώστε να μη σπάνε στη μέση (επιλογή α που είχες διαλέξει). Photos clickable (link στο signed URL).
- **Section attachments** με clickable links στο όνομα αρχείου (θα δουλεύουν αξιόπιστα στο react-pdf).
- **Χωρίς** per-section totals μέσα στα sections.
- **Στο τέλος**: Grand Total και από κάτω "Breakdown by Section / Ανάλυση ανά Τμήμα".
- **Χωρίς** signatures, χωρίς legal statement.
- **Running header**: σε κάθε σελίδα, logo + company name + address + VAT/Tax office + contact info (αριστερά-δεξιά layout).
- **Running footer**: σε κάθε σελίδα, στο κέντρο `Page X / Y · CR-0004 v1 · OPTIMUS PRIME`.

### Τι θα γίνει στον κώδικα (τεχνικά)
- Προσθήκη dependency: `@react-pdf/renderer`.
- Νέο component `src/pages/costing/CostingReportPdfDoc.tsx` που χτίζει το `<Document>` με `<Page>`, `<View>`, `<Text>`, `<Image>` και `<Link>` του react-pdf.
- Φόρτωση Greek-capable font (Noto Sans) ώστε να αποδίδονται σωστά Ελληνικά (το default Helvetica δεν τα έχει).
- `CostingReportPrint.tsx`: το αντικαθιστούμε με ένα μικρό wrapper σελίδα (`/print`) που τραβά τα data ίδια όπως τώρα και έχει κουμπί "Download PDF" — `PDFDownloadLink` του react-pdf. Καμία αλλαγή στο DB ή στο data fetching.
- Στο `CostingReportDetails.tsx`, το υπάρχον κουμπί Export PDF να οδηγεί στο νέο flow (auto-download ή redirect στη `/print` που έχει το νέο κουμπί).
- Φωτογραφίες & cover photo: prefetch των signed URLs σε `Uint8Array` πριν το render για να μπουν αξιόπιστα ως `<Image>` (χωρίς CORS issues).

### Εκτός σκοπού (για να μη μεγαλώσει το PR)
- Δεν αλλάζουμε τίποτα στο UI του report (Details/Field Entry).
- Δεν αλλάζουμε το DB schema, RLS, ή buckets.
- Δεν αλλάζουμε το θέμα attachments link logic — απλά θα δουλέψει σωστά μέσα στο νέο PDF.

### Παραδοτέο
- Πιστό, σταθερό PDF που μοιάζει ίδιο σε κάθε πελάτη/browser.
- Headers/footers στη σωστή θέση παντού.
- Section headings ποτέ κομμένα.
- Όλες οι φωτογραφίες εμφανίζονται σωστά.
- Καμία γραμμή του browser με date/URL/skynet/page count.

---

Αν συμφωνείς να προχωρήσω με αυτή τη μετάβαση σε `@react-pdf/renderer`, πάτα **Implement plan**. Αν προτιμάς να επιμείνουμε στο `window.print()` και απλά να ξανατυλίξουμε CSS (με τα όρια που εξήγησα — δεν φεύγουν τα browser headers, και τα running headers θα συνεχίσουν να είναι ασταθή), πες μου να φτιάξω εναλλακτικό πλάνο.