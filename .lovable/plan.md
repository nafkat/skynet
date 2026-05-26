# Permissions Architecture: Templates ως Single Source of Truth

## Στόχος
Ένα ενιαίο σύστημα δικαιωμάτων για ΟΛΟΥΣ τους users, όπου το **Permission Template** που ανατίθεται καθορίζει αυτόματα και:
- το `user_roles.role` (που χρησιμοποιεί το RLS στη βάση)
- τα `user_permissions` (που χρησιμοποιεί το frontend για `hasPermission`, `isHR`, `hasElevatedRole`)
- το Access tab (γίνεται read-only προβολή)

Έτσι λύνεται και η περίπτωση Maria Serveta (template=HR αλλά role=timekeeper → ασυμφωνία) και κάθε μελλοντικός user.

---

## 1. Database Changes (migration)

### 1a. Επέκταση `permission_templates`
Νέα στήλη `base_role app_role NOT NULL DEFAULT 'timekeeper'` που δηλώνει σε ποιο RLS role αντιστοιχεί κάθε template:
- "Timekeeping – HR" → `hr`
- "Timekeeping – Employee" → `timekeeper`
- "Administrator / Full Access" → `admin`

Backfill των υπαρχόντων templates με σωστή τιμή.

### 1b. Trigger σε `user_permission_templates`
Σε κάθε `INSERT`/`UPDATE`/`DELETE`:
1. Καλεί `recompute_user_permissions(user_id)` (υπάρχει ήδη).
2. Συγχρονίζει το `user_roles.role` = το πιο "δυνατό" `base_role` από τα assigned templates του user (admin > hr > timekeeper).
3. Καλεί επίσης `initialize_user_permissions(user_id, role, granted_by)` για να συγχρονιστούν τα `user_module_access` / `user_module_actions` (Access tab visualization).

### 1c. One-time backfill
Για κάθε user που έχει assigned templates: τρέχουμε το ίδιο sync μία φορά, ώστε όλοι οι υπάρχοντες users (Maria + οι υπόλοιποι) να έρθουν σε συμφωνία.

---

## 2. Frontend Changes

### 2a. `AdminUsers` — Access tab
Γίνεται **read-only**: εμφανίζει τα effective permissions / modules που προκύπτουν από τα assigned templates, με badge "Διαχειρίζεται από το Template". Χωρίς toggles. Κουμπί "Άνοιγμα Templates" για όποιον θέλει να αλλάξει.

### 2b. `AdminUsers` — Templates tab
Παραμένει το βασικό σημείο διαχείρισης. Όταν αλλάζεις template, ο trigger φροντίζει role + permissions + access toggles αυτόματα.

### 2c. AuthContext
**Καμία αλλαγή λογικής** — ήδη διαβάζει `user_roles.role` + `user_permissions`. Απλώς τώρα θα είναι πάντα συγχρονισμένα.

### 2d. PermissionsContext (Access tab data)
Παραμένει για να εμφανίζει την read-only προβολή — δεν χρησιμοποιείται για authorization στην εφαρμογή.

---

## 3. Τι ΔΕΝ αλλάζει
- RLS policies (συνεχίζουν με `has_role` / `has_elevated_role` / `is_timekeeper_only` πάνω στο `user_roles`)
- TimeEntry / Employees / Projects pages
- Invite flow (απλά μετά το invite ο admin αναθέτει template και όλα συγχρονίζονται)
- Login / Logout

---

## 4. Έλεγχος μετά την εφαρμογή
1. Maria Serveta: template=HR → role γίνεται `hr` → βλέπει σωστά employees στο TimeEntry.
2. Νέος Employee: ανάθεση "Timekeeping – Employee" → role=`timekeeper`, βλέπει μόνο assigned employees.
3. Admin user: ανάθεση Admin template → role=`admin`, πλήρης πρόσβαση.
4. Αφαίρεση template → role πέφτει στο default `timekeeper` με μηδέν permissions.

---

## Τεχνικές λεπτομέρειες (για reference)

```sql
ALTER TABLE permission_templates 
  ADD COLUMN base_role app_role NOT NULL DEFAULT 'timekeeper';

-- Trigger function: sync_user_role_from_templates()
-- Επιλέγει max priority role από τα assigned templates και κάνει UPSERT στο user_roles.
-- Priority: admin=3, hr=2, timekeeper=1.

CREATE TRIGGER trg_sync_role_on_template_assign
  AFTER INSERT OR UPDATE OR DELETE ON user_permission_templates
  FOR EACH ROW EXECUTE FUNCTION sync_user_role_from_templates();
```

Αν συμφωνείς, ξεκινώ με τη migration.