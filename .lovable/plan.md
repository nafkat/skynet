# Διόρθωση ρόλων Costing

## Αλλαγές

### 1. Καταργείται το template "Costing – Admin"
Ο global **Admin** ρόλος είναι ήδη god-mode (έχει πρόσβαση παντού μέσω `has_role(admin)` στα RLS και bypass στο `has_permission`). Άρα το ξεχωριστό Costing-Admin template είναι περιττό.

**Migration:**
- Διαγραφή των rows του template `77777777-…` από `permission_template_permissions`
- Διαγραφή του ίδιου template από `permission_templates`
- Αν κάποιος user το έχει assigned, αυτόματα θα ξανυπολογιστεί ο ρόλος του (υπάρχει trigger `sync_user_role_from_templates`)

**Τελικά templates Costing:**
- **Costing – Manager** — πλήρης διαχείριση reports/items/κοστών, delete reports, change status
- **Costing – Field User** — δες παρακάτω (#2)

---

### 2. Field User: όχι μόνο mobile — και από desktop
Καμία αλλαγή στη βάση χρειάζεται (τα permissions είναι ήδη device-agnostic). Η αλλαγή είναι μόνο στο UI gating:

**Τι αλλάζει στις σελίδες του Costing module:**
- Ο Field User θα έχει πλήρες desktop UI (όχι redirect στο mobile field entry)
- Στο **CostingReportsList**: βλέπει μόνο τα own reports — όπως ορίζει το RLS — και δεν εμφανίζονται κουμπιά Delete/Status change
- Στο **CostingReportDetails**: μπορεί να ανοίξει & εργαστεί από desktop, αλλά:
  - Δεν βλέπει στήλες/πεδία **Unit Price**, **Total Cost** (κρύβονται με `has_permission('costing.costs.view')`)
  - Add Item form: το πεδίο τιμής είναι κρυμμένο
  - Edit/Delete κουμπιά εμφανίζονται μόνο για items όπου `item.created_by === user.id`
  - Δεν εμφανίζεται κουμπί **Delete Report** / **Change Status**
- Το **CostingFieldEntry** (mobile-optimized) παραμένει ως εναλλακτικό για χρήση από κινητό — όχι ως υποχρεωτικό

---

### 3. created_by writes
Στα forms που εισάγουν `cost_items` και `cost_item_photos` (από `CostingReportDetails.tsx` και `CostingFieldEntry.tsx`) θα συμπληρώνεται αυτόματα `created_by = user.id`. Χωρίς αυτό, η ownership-based RLS του Field User δεν λειτουργεί.

---

## Τεχνικές λεπτομέρειες

### Migration (1 αρχείο)
```sql
DELETE FROM permission_template_permissions WHERE template_id = '77777777-…';
-- Καθαρισμός τυχόν user assignments
DELETE FROM user_permission_templates WHERE template_id = '77777777-…';
DELETE FROM permission_templates WHERE id = '77777777-…';
```
Ο υπάρχων trigger θα συγχρονίσει τα `user_roles` αυτόματα για όποιον είχε το template.

### Frontend changes
- `src/contexts/AuthContext.tsx` ή `PermissionsContext.tsx` — εκθέτει helpers `canViewCosts`, `canDeleteReport`, `canChangeStatus` βάσει `has_permission`
- `src/pages/costing/CostingReportsList.tsx` — gating Delete button
- `src/pages/costing/CostingReportDetails.tsx`:
  - Conditional rendering των στηλών price/total
  - Add `created_by: user.id` στο insert των items/photos
  - Gating Delete Report + Status change buttons
  - Edit/Delete per-item gating
- `src/pages/costing/CostingFieldEntry.tsx` — add `created_by: user.id` στα inserts
- `src/pages/Home.tsx` — δεν αλλάζει (η ορατότητα του Costing tile τρέχει ήδη μέσω `module.costing`)

---

## Τι ΔΕΝ αλλάζει
- RLS policies (παραμένουν όπως ορίστηκαν)
- Δομή πινάκων cost_*
- Mobile Field Entry σελίδα — διατηρείται ως optional shortcut
- Permission keys

---

Συμφωνείς να προχωρήσω;
