## Costing Approval Workflow

### Statuses (διπλό μοντέλο)

**Internal (review_status):**
- `draft` → Field user γράφει
- `submitted_for_review` → submitted από field user
- `changes_requested` → Manager/Admin ζήτησε αλλαγές με σχόλιο
- `approved` → Manager/Admin ενέκρινε

**External (status — υπάρχει ήδη):**
- `sent`, `agreed`, `invoiced` → ξεκλειδώνουν ΜΟΝΟ όταν `review_status = approved`

### Database

1. `cost_reports`: νέες στήλες
   - `review_status` text default `'draft'`
   - `submitted_at`, `submitted_by`
   - `reviewed_at`, `reviewed_by`
2. Νέος πίνακας `cost_report_review_comments` (id, report_id, author_id, comment, created_at) — για το «changes requested» thread + GRANTs + RLS.
3. Νέος πίνακας `cost_report_notifications` (id, report_id, user_id, type, read_at, created_at) — in-app bell για Admin/Manager.
4. RLS: external status transitions επιτρέπονται μόνο όταν `review_status='approved'`.

### Permissions
- `costing.reports.submit` → field users (auto από template)
- `costing.reports.approve` → Admin + Manager
- Approve/Reject επιτρέπεται σε Admin **και** Manager

### UI

**CostingReportDetails / CostingFieldEntry:**
- Field user σε `draft` ή `changes_requested`: κουμπί **"Submit for Review"**
- Σε `submitted_for_review` / `approved`: read-only για field user (lock editing)
- Manager/Admin σε `submitted_for_review`: κουμπιά **"Approve"** & **"Request Changes"** (με υποχρεωτικό σχόλιο σε modal)
- Comments thread ορατό σε όλους τους εμπλεκόμενους
- External status dropdown (sent/agreed/invoiced) disabled μέχρι `approved`

**CostingDashboard:**
- Νέο φίλτρο: review_status badge (Draft / Pending Review / Changes Requested / Approved)
- Χρωματιστά badges
- Tab «Pending my review» για Admin/Manager

**Bell notification (in-app μόνο, χωρίς email):**
- Στο `CostingLayout` header, καμπανάκι με unread count
- Trigger όταν: field user κάνει submit → notify όλους Admin/Manager. Manager κάνει request changes/approve → notify creator.
- Realtime via Supabase subscription στο `cost_report_notifications`.

### Bilingual labels
EL/EN strings για όλα τα νέα statuses, κουμπιά, και notifications.

### Files to touch
- Migration: schema + RLS + trigger για auto-notification on status change
- `src/pages/costing/CostingReportDetails.tsx` — workflow actions, comments thread, lock states
- `src/pages/costing/CostingFieldEntry.tsx` — submit button, lock όταν not editable
- `src/pages/costing/CostingDashboard.tsx` — review_status filter + badges
- `src/components/costing/CostingLayout.tsx` — notification bell
- Νέο: `src/components/costing/ReviewActions.tsx`, `ReviewCommentsThread.tsx`, `CostingNotificationsBell.tsx`
- Permission templates seed (admin/manager get approve, field gets submit)

Έτοιμος να το χτίσω.