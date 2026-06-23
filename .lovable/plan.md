## Πρόβλημα 1 — "Error saving report" (infinite recursion στο RLS)

Η `cost_reports_select` policy ψάχνει αν ο user έχει items μέσα στο report (joining `cost_items` + `cost_sections`). Αλλά οι policies των `cost_items`/`cost_sections` με τη σειρά τους κάνουν join πίσω στο `cost_reports`. Αυτό προκαλεί `infinite recursion (42P17)` και αποτυγχάνει **κάθε** SELECT/INSERT στο `cost_reports` — γι' αυτό σκάει το Save as Draft (αλλά και η λίστα reports για όσους δεν είναι Admin).

### Διόρθωση (migration, χωρίς αλλαγή schema)

1. Νέα SECURITY DEFINER function `public.user_has_items_in_report(_user_id, _report_id)` που τρέχει με δικαιώματα owner και bypass-άρει RLS:

```sql
CREATE OR REPLACE FUNCTION public.user_has_items_in_report(_user_id uuid, _report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM cost_items ci
    JOIN cost_sections cs ON cs.id = ci.section_id
    WHERE cs.report_id = _report_id AND ci.created_by = _user_id
  )
$$;
```

2. Replace τις τρεις προβληματικές policies ώστε να καλούν τη function αντί για inline EXISTS:
   - `cost_reports_select` → χρησιμοποιεί `user_has_items_in_report(auth.uid(), id)` στο view_own clause.
   - `cost_items_select` → απλοποιείται: ένας Field User βλέπει είτε τα δικά του items είτε αν είναι `can_view_all_cost_reports`. Δεν χρειάζεται να ψάχνει αν ο user είναι creator του report (αυτοί ούτως ή άλλως πιάνονται από `can_view_all_cost_reports` ως Manager/Admin).
   - `cost_sections_select` → ξαναγράφεται με SECURITY DEFINER helper `can_view_cost_report(_user_id, _report_id)` που δεν επιστρέφει στα `cost_items`.

Αποτέλεσμα: σπάει ο κύκλος, save λειτουργεί, και κάθε ρόλος βλέπει σωστά:
- Admin/Manager: όλα τα reports
- Field User: μόνο reports στα οποία έχει βάλει items (μέσω της SECURITY DEFINER function).

## Πρόβλημα 2 — Δεν μπορείς να βάλεις φωτογραφίες όταν δημιουργείς item

Στην οθόνη `CostingReportCreate` (New Report) δεν υπάρχει καθόλου UI για φωτογραφίες — υπάρχει μόνο στο **Field Entry** (mobile-optimized οθόνη). Αυτό ήταν αρχικός σχεδιασμός: γρήγορη δημιουργία template στο desktop, φωτογραφίες στο πεδίο. 

### Διόρθωση στο `CostingReportCreate.tsx`

Προσθήκη photo picker σε κάθε item, με την ίδια λογική του Field Entry:
- Hidden `<input type="file" accept="image/*" multiple>` ανά item.
- Preview thumbnails (grid 3 cols) με κουμπί ✕ για αφαίρεση.
- State: επεκτείνεται το `CostItem` interface με `photos: { file: File; previewUrl: string }[]`.
- Στο `handleSave`, μετά το insert του cost_item: upload κάθε αρχείο στο bucket `cost-photos` με path `{report.id}/{item.id}/...` και insert row στο `cost_item_photos` με `created_by = user.id`.
- Cleanup των `URL.createObjectURL` blobs.

Δεν αλλάζει το backend — το bucket και οι RLS policies είναι ήδη έτοιμα.

## Αρχεία που αλλάζουν

- **Νέο migration**: SECURITY DEFINER function + αναδιατύπωση 3 policies (cost_reports_select, cost_items_select, cost_sections_select). Καμία αλλαγή schema, καμία αλλαγή δεδομένων.
- **`src/pages/costing/CostingReportCreate.tsx`**: προσθήκη photo picker + upload στο save.

## Τι δεν αλλάζει

- Δομή πινάκων, grants, υπόλοιπες policies.
- `CostingFieldEntry.tsx` (συνεχίζει να δουλεύει όπως είναι).
- Permissions/ρόλοι (Φάση 1 & 2 παραμένουν).
