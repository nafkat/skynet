# Διόρθωση Resend Invite (RASINT & γενικά)

## Πρόβλημα
Η `resend_invite` edge function καλεί `auth.admin.inviteUserByEmail`, που στέλνει email μέσω του built-in SMTP του Supabase — το οποίο έχει σκληρό όριο ~4 emails/ώρα. Έτσι σκάει με `over_email_send_rate_limit` (429) και ο παραλήπτης (RASINT) δεν παίρνει ποτέ έγκυρο link για να μπει πρώτη φορά.

Το κύριο `invite_user` δεν έχει το πρόβλημα γιατί χρησιμοποιεί `generateLink` + Resend. Θα εφαρμόσω το ίδιο pattern και στο `resend_invite`.

## Αλλαγές

**1. `supabase/functions/resend_invite/index.ts`**
- Αφαίρεση των κλήσεων `inviteUserByEmail` και του fallback `magiclink` flow (τα δύο σημεία που χτυπάνε το SMTP rate limit).
- Χρήση μόνο του `adminClient.auth.admin.generateLink({ type: 'invite', ... })` για να πάρω `properties.action_link` (invalidates παλιά tokens αυτόματα).
- Αποστολή του email μέσω Resend API (`RESEND_API_KEY`, `FROM_EMAIL`) με το ίδιο branded HTML template που ήδη έχει το `invite_user` (κουμπί "Accept invitation" + fallback link).
- Διατήρηση όλων των υπόλοιπων ελέγχων: admin auth, `email_confirmed_at` guard, `permission_audit_logs` INVITE_RESENT entry.
- Επαναφορά προτεραιότητας redirect: `origin → SITE_URL → https://skynetshipyard.app` (αντί για το ξεπερασμένο `skynet.lovable.app`).

**2. Επανα-invite για τον RASINT**
Μετά το deploy, θα ξαναπατήσεις "Resend Invite" από το UI για τον michalisrasint@gmail.com — αυτή τη φορά θα φτάσει κανονικά μέσω Resend και θα μπορεί να ολοκληρώσει τη σύνδεση.

## Τι ΔΕΝ αλλάζει
- Καμία αλλαγή σε permissions, roles, templates, DB schema.
- Καμία αλλαγή στο `invite_user` (ήδη δουλεύει σωστά).
- Καμία αλλαγή στο UI ή στη διαδικασία assignment templates.

## Επαλήθευση μετά το build
1. Έλεγχος logs της `resend_invite`: να μην εμφανίζεται πλέον `over_email_send_rate_limit`.
2. Επιβεβαίωση ότι ο RASINT λαμβάνει το email και μπορεί να ολοκληρώσει signup/login πρώτη φορά.
