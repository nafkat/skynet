## Στόχος
Να μπορούν οι HR users να κάνουν hard delete εργαζόμενο, με την ίδια ασφαλιστική λογική που ισχύει για τον Admin: επιτρέπεται μόνο αν δεν υπάρχει κανένα time entry για τον εργαζόμενο. Αλλιώς, μόνο archive.

## Αλλαγές

### 1. Frontend — `src/pages/Employees.tsx`
- Στο dropdown ενεργειών της λίστας εργαζομένων, το στοιχείο **Delete** εμφανίζεται σήμερα μόνο αν `isAdmin`. Θα αλλάξει σε `hasElevatedRole` (Admin **ή** HR).
- Η υπάρχουσα συνάρτηση `checkCanDelete` (που μπλοκάρει το delete όταν υπάρχουν time entries) παραμένει ως έχει — άρα και για τον HR το κουμπί θα γίνεται disabled με το μήνυμα "cannot delete" όταν υπάρχει ιστορικό.

### 2. Database — RLS policy στον πίνακα `employees`
- Σήμερα η DELETE policy επιτρέπει διαγραφή μόνο σε admins.
- Θα προστεθεί/αντικατασταθεί ώστε να επιτρέπει DELETE και σε χρήστες με `has_elevated_role(auth.uid())` (Admin + HR).
- Η προστασία από διαγραφή εργαζομένου που έχει time entries εξακολουθεί να καλύπτεται από το foreign key constraint του `time_entries.employee_id` (η Postgres θα μπλοκάρει τη διαγραφή), επιπλέον του frontend ελέγχου.

## Τι ΔΕΝ αλλάζει
- Η λογική του Archive (παραμένει διαθέσιμη σε Admin + HR).
- Timekeepers δεν αποκτούν κανένα δικαίωμα διαγραφής.
- Τα audit logs καταγράφουν κανονικά τη διαγραφή μέσω του υπάρχοντος `audit_employees` trigger.

## Επαλήθευση
1. Login ως HR → άνοιγμα Employees → στο μενού ενός εργαζομένου χωρίς time entries εμφανίζεται **Delete** και λειτουργεί.
2. Σε εργαζόμενο **με** time entries → το Delete είναι disabled με το αντίστοιχο μήνυμα.
3. Login ως Timekeeper → καμία επιλογή Delete.
