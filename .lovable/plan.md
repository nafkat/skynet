# Mobile fixes — Costing module

Στο mobile (≤640px) το Costing module έχει οριζόντιο scroll και «κομμένα» στοιχεία. Η αιτία είναι: padding 6 στο main, fixed `min-w-[260px]` στο search, τίτλος `text-3xl` χωρίς wrap, flex rows χωρίς `min-w-0`, και πίνακες/grids που δεν συμπτύσσονται σωστά.

## Αλλαγές (μόνο presentation, καμία αλλαγή σε logic/δεδομένα)

### 1) `src/pages/costing/CostingLayout.tsx`
- Μειωμένο padding στο `<main>` για mobile: `p-3 sm:p-6 pt-16 md:pt-6`.
- Wrapper με `min-w-0 overflow-x-hidden` ώστε τα παιδιά να μην προκαλούν page-level scroll.

### 2) `src/pages/costing/CostingDashboard.tsx`
- Τίτλος: `text-2xl sm:text-3xl break-words` αντί για σκέτο `text-3xl`.
- Header row: `min-w-0` στο left block ώστε να μην σπρώχνει.
- Action buttons row: γίνεται `flex-wrap` σε mobile.
- Search row: αφαιρείται το `min-w-[260px]` σε mobile (γίνεται `w-full sm:min-w-[260px]`), έτσι το search πέφτει κάτω από τον τίτλο αντί να ξεχειλώνει.
- Stat cards grid: παραμένει `grid-cols-2`, αλλά προστίθεται `min-w-0` και `truncate` στα labels για να μην βγαίνουν εκτός.
- Κάθε γραμμή report: `min-w-0` στο flex container και `truncate` στα project info (ήδη υπάρχει truncate, λείπει min-w-0 στον parent).

### 3) `src/pages/costing/CostingReportsList.tsx`
- Ίδια λογική: τίτλος `text-2xl sm:text-3xl`, search wrapper `w-full sm:min-w-[200px]`, header row `flex-wrap` με `min-w-0`.

### 4) `src/pages/costing/CostingReportDetails.tsx`
- Top header/action row: `flex-wrap gap-2`, με `min-w-0` στον τίτλο.
- Tables / sections: wrapper `overflow-x-auto` όπου υπάρχουν πίνακες με unit price columns, ώστε να scrollάρει μόνο ο πίνακας, όχι όλη η σελίδα.
- Cover photo / thumbnails grid: ήδη responsive, μόνο προσθήκη `min-w-0`.

### 5) `src/pages/costing/CostingFieldEntry.tsx` & `CostingReportCreate.tsx`
- Έλεγχος ότι τα buttons rows (record / photo / STT) γίνονται `flex-wrap` σε mobile και τα labels truncate. Καμία αλλαγή σε λειτουργικότητα — μόνο classes.

### 6) `src/pages/costing/CostingTrash.tsx`
- Ίδιες προσαρμογές header/title για συνέπεια.

## Τι ΔΕΝ αλλάζει
- Καμία αλλαγή σε queries, RLS, PDF, permissions, ή business logic.
- Καμία αλλαγή στο desktop layout (όλες οι αλλαγές είναι responsive με `sm:`/`md:` breakpoints).

## Verification
Μετά την εφαρμογή, θα ανοίξω το preview σε viewport 390×844 με Playwright και θα τραβήξω screenshots από:
- `/costing` (dashboard)
- `/costing/reports`
- `/costing/reports/:id`
για να επιβεβαιώσω ότι δεν υπάρχει horizontal scroll και ότι όλα τα στοιχεία είναι ορατά.
