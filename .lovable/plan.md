## Στόχος
Προσθήκη inline search στο Costing Dashboard. Όταν ο χρήστης πληκτρολογεί, η ενότητα "Recent Reports" αντικαθίσταται από λίστα αποτελεσμάτων που ταιριάζουν. Όταν το πεδίο αδειάζει, επιστρέφουν τα Recent.

## Πεδία αναζήτησης
Single search input με debounce (~250ms), case-insensitive, που ψάχνει σε:
- Κωδικό αναφοράς (`cost_reports.code`, π.χ. CR-0004)
- Κωδικό & όνομα έργου (`projects.project_code`, `projects.project_name`)
- Όνομα εταιρείας (`companies.name` μέσω project)
- Status (draft/sent/agreed/invoiced — και στα Ελληνικά)
- Ημερομηνία δημιουργίας (αν το query ταιριάζει σε DD/MM/YYYY ή YYYY-MM-DD)

## Συμπεριφορά UI
- Πεδίο search στο header της κάρτας "Recent Reports" (με icon 🔍 και clear button).
- Χωρίς query → εμφανίζονται τα 5 πιο πρόσφατα (όπως τώρα).
- Με query → τίτλος αλλάζει σε "Search Results / Αποτελέσματα" και δείχνει έως 50 matches, ταξινομημένα κατά `created_at desc`.
- Empty state: "No matching reports / Δεν βρέθηκαν αναφορές".
- Τα stat cards πάνω παραμένουν αμετάβλητα.

## Τεχνική προσέγγιση
- Στο `CostingDashboard.tsx`: φόρτωση όλων των reports μία φορά με join σε `projects` και `companies` (`projects(project_code, project_name, companies(name))`). Το dataset είναι μικρό (όσα reports έχει η εταιρεία) — το φιλτράρισμα γίνεται client-side για ταχύτητα και ευελιξία (συμπεριλαμβανομένης της αναζήτησης σε ημερομηνία DD/MM/YYYY).
- Νέο state: `searchQuery: string`. `useMemo` υπολογίζει `filtered` από το πλήρες array.
- Helper για date matching: αν το query ταιριάζει με regex ημερομηνίας, σύγκριση με formatted `created_at` σε `el-GR`.
- Δίγλωσσα placeholders: "Search by code, project, company, date…" / "Αναζήτηση με κωδικό, έργο, εταιρεία, ημερομηνία…".

## Εκτός scope
- Η συζήτηση για το κουμπί "New Version" παραμένει ανοιχτή — δεν αλλάζει τίποτα σε αυτό.
- Καμία αλλαγή στη σελίδα `CostingReportsList`.
- Καμία αλλαγή σε DB ή RLS.

## Αρχεία που αλλάζουν
- `src/pages/costing/CostingDashboard.tsx` (μόνο).
