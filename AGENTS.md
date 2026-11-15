# Architecture rules
- Projects Hub uses a dedicated elevated-only layout; invoice data and storage enforce the same permissions server-side so hiding navigation is not the security boundary.
- Invoice calculations and strict attachment validation live in a shared tested module; forms and totals use that module to prevent divergent amounts or file rules.
- Invoice attachments are private storage paths with one-hour signed download URLs; upload new files before saving metadata and remove new files if the save fails.