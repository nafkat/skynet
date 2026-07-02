
INSERT INTO public.modules (key, name, is_active) VALUES ('costing', 'Costing', true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.module_actions (module_key, action_key, description) VALUES
  ('costing', 'costing.reports.view_own',     'View own cost reports'),
  ('costing', 'costing.reports.view_all',     'View all cost reports'),
  ('costing', 'costing.reports.create',       'Create cost reports'),
  ('costing', 'costing.reports.edit',         'Edit cost reports'),
  ('costing', 'costing.reports.delete',       'Delete cost reports'),
  ('costing', 'costing.reports.approve',      'Approve cost reports'),
  ('costing', 'costing.reports.change_status','Change report status'),
  ('costing', 'costing.field_entry',          'Access field entry (mobile)'),
  ('costing', 'costing.items.create',         'Create items'),
  ('costing', 'costing.items.edit',           'Edit any item'),
  ('costing', 'costing.items.edit_own',       'Edit own items'),
  ('costing', 'costing.items.delete',         'Delete any item'),
  ('costing', 'costing.items.delete_own',     'Delete own items'),
  ('costing', 'costing.costs.view',           'View costs / unit prices'),
  ('costing', 'costing.costs.edit',           'Edit costs / unit prices')
ON CONFLICT (action_key) DO UPDATE SET description = EXCLUDED.description, module_key = EXCLUDED.module_key;
