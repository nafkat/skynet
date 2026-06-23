## 1) Inline edit για items (αντί για modal)

Πρόβλημα: όταν πατάς το μολυβάκι σε ένα item, ανοίγει pop-up dialog που "βγάζει" από το context της αναφοράς.

Αλλαγή στο `src/pages/costing/CostingReportDetails.tsx`:
- Αφαιρώ τελείως το `Dialog` "Edit Item".
- Προσθέτω τοπικό state `inlineEditId` αντί για `editItem`. Όταν είναι ίσο με `item.id`, η ίδια η κάρτα του item μεταμορφώνεται σε φόρμα (Description / Calc Type / Quantity / Unit + Save/Cancel) στην **ίδια θέση** μέσα στο section, χωρίς overlay.
- Save/Cancel αποθηκεύει inline, ενημερώνει το state μόνο για το συγκεκριμένο item (χωρίς full refetch ώστε να μην "κλείσει" το section).

## 2) Άδεια sections (τίτλοι χωρίς items) στο PRJ-0009

Πρόβλημα: στο CR-0001 του PRJ-0009 βλέπεις 3 τίτλους (`kapaki`, `gfgf`, `φφφφφ`) χωρίς items γιατί διέγραψες όλα τα items αλλά τα sections παρέμειναν.

Αλλαγή 2α — UI (`CostingReportDetails.tsx`):
- Στο render των sections φιλτράρω τα sections με `cost_items.length === 0` ώστε να μην εμφανίζονται κενοί τίτλοι. Αν δεν υπάρχει κανένα section με items, δείχνω placeholder "No items yet — go to Field Entry to add some".

Αλλαγή 2β — αυτόματο cleanup όταν διαγράφεται το τελευταίο item ενός section:
- Στο `handleDeleteItem` μετά την επιτυχή διαγραφή, ελέγχω αν το section του διαγραμμένου item έχει 0 items και αν ναι κάνω `delete` και το section. Έτσι δεν αφήνουμε ορφανούς τίτλους.
- Επίσης κουμπί 🗑 δίπλα στον τίτλο του section (μόνο για όσους έχουν `costing.items.delete` ή elevated), που διαγράφει το section και τα items του.

Καμία αλλαγή στη βάση/RLS — μόνο frontend logic + ένα cascade delete μέσω του υπάρχοντος client.

## 3) Διαφορά «Field Entry» vs «New Version»

Αυτό είναι μόνο εξήγηση — δεν χρειάζεται αλλαγή κώδικα, αλλά προτείνω και ένα μικρό UX fix.

- **Field Entry (μπλε κουμπί)** → ανοίγει το mobile-optimized interface (`/costing/reports/:id/field`) για να προσθέσεις γρήγορα items + φωτογραφίες στην **ίδια έκδοση** της αναφοράς, ενώ είσαι στο πεδίο. Δεν δημιουργεί νέα αναφορά.
- **New Version (outline κουμπί)** → υποτίθεται ότι δημιουργεί καινούρια έκδοση (π.χ. CR-0001-v2) της ίδιας αναφοράς για να αλλάξεις/προσθέσεις χωρίς να χαλάσεις την προηγούμενη έκδοση που μπορεί ήδη να έχει σταλεί στον πελάτη.

**Bug που εντόπισα:** σήμερα το «New Version» απλώς κάνει `navigate('/costing/new')` δηλαδή πάει στη φόρμα νέας αναφοράς χωρίς να προ-συμπληρώνει project ή να αυξάνει το version_number — οπότε δεν δημιουργεί πραγματική νέα έκδοση, δημιουργεί ξεχωριστή αναφορά v1.

Προτεινόμενο μικρό fix (προαιρετικό, πες μου αν το θες τώρα ή σε επόμενη φάση):
- Το «New Version» να ανοίγει modal που ρωτάει «Version notes», και να καλεί νέα RPC/insert που: παίρνει το ίδιο `code`, βάζει `version_number = max+1` για αυτό το code, αντιγράφει sections + items (χωρίς τιμές) από την προηγούμενη έκδοση. Έτσι έχει νόημα το versioning.
- Εναλλακτικά, αν δεν θες versioning τώρα, να αφαιρέσουμε εντελώς το κουμπί για να μην μπερδεύει.

## Αρχεία που θα αλλάξουν στη Φάση 3
- `src/pages/costing/CostingReportDetails.tsx` — inline edit, hide empty sections, cascade delete section όταν αδειάζει, (προαιρετικά) trash icon σε sections, (προαιρετικά) σωστό New Version flow.

## Τι ΔΕΝ αγγίζω
- Βάση / RLS / migrations
- `CostingFieldEntry.tsx`, `CostingReportCreate.tsx`
- permissions/roles

Πες μου: να προχωρήσω και με το New Version proper versioning (#3 fix) ή το αφήνουμε για άλλη φάση και τώρα κάνουμε μόνο #1 και #2;