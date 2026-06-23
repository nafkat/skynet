## Πρόβλημα

Όταν πατάς το μολυβάκι (edit) σε ένα item, ανοίγει ένα μικρό inline form μόνο με Description / Calc / Quantity / Unit. Δεν είναι η ίδια καρτέλα που χρησιμοποίησες για να καταχωρήσεις το item αρχικά (Field Entry) — άρα λείπουν φωτογραφίες, voice input, μεγάλα touch fields, κλπ. Επίσης δεν μπορείς να σβήσεις το item από εκεί.

## Λύση

Το pencil (edit) και το delete των items θα στέλνουν στην **ίδια Field Entry καρτέλα** που χρησιμοποιείται για την αρχική καταχώρηση, αλλά σε **edit mode** για το συγκεκριμένο item. Έτσι έχεις ενιαία εμπειρία — ίδιο UI για create και edit, με όλες τις δυνατότητες (περιγραφή, voice, μέτρηση, φωτογραφίες, διαγραφή).

## Τι θα αλλάξει

### 1. `CostingFieldEntry.tsx` — υποστήριξη edit mode
- Διαβάζει query param `?edit=<itemId>` από το URL.
- Αν υπάρχει `edit`:
  - Φορτώνει το item (description, calc_type, quantity, unit, section_id) και τις φωτογραφίες του (`cost_item_photos` + signed URLs από `cost-photos` bucket) και τα γεμίζει στη φόρμα.
  - Στον τίτλο γράφει "Edit Item" αντί "Field Entry".
  - Το κουμπί "Save & Add Next" γίνεται "Update" — κάνει `UPDATE` αντί `INSERT`, και ανεβάζει μόνο τις νέες φωτογραφίες (κρατά τις παλιές, διαγράφει αυτές που έβγαλε ο χρήστης από storage + table).
  - Εμφανίζεται κουμπί **Delete Item** (κόκκινο, με confirm) που σβήνει το item και επιστρέφει στο report.
  - Μετά το Update, επιστρέφει στο `/costing/reports/:id` (όχι "Add Next").

### 2. `CostingReportDetails.tsx` — ανακατεύθυνση edit
- Αφαιρούνται: το inline edit state (`inlineEditId`, `editForm`, `savingItem`, όλη η inline φόρμα και το `handleSaveItem`).
- Το pencil button κάθε item κάνει `navigate('/costing/reports/:id/field?edit=<itemId>')`.
- Το delete button παραμένει inline (γρήγορο) — οπότε ο χρήστης δεν είναι αναγκασμένος να μπει σε άλλη οθόνη για διαγραφή. (Εναλλακτικά μεταφέρεται κι αυτό μέσα στο Field Entry — πες μου τι προτιμάς.)

### 3. Δεν αλλάζει
- Καμία αλλαγή σε DB / RLS / permissions / buckets.
- Δεν αλλάζει το create flow ή ο τρόπος εμφάνισης των items στο details.

## Τεχνικές λεπτομέρειες

- Νέα state στο `CostingFieldEntry`: `editingItemId`, `existingPhotos: {id, storage_path, signedUrl}[]`, `photosToDelete: string[]`.
- Στο handlePhotoCapture: ίδιο. Σε νέο `removeExistingPhoto(id)`: αφαιρεί από `existingPhotos` και προσθέτει στο `photosToDelete`.
- Στο update: `update cost_items` → upload νέες φωτο → `insert cost_item_photos` για νέες → `delete from cost_item_photos where id in photosToDelete` + `supabase.storage.remove([paths])`.
- Header κουμπί ή footer κουμπί "Delete" → AlertDialog → `delete cost_items` → navigate back.
