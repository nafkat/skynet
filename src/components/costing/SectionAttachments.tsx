import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Paperclip, Upload, Trash2, FileText, FileSpreadsheet, FileImage, File as FileIcon, Loader2, ExternalLink } from 'lucide-react';

interface Attachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  signedUrl?: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB project standard

function iconFor(name: string, mime: string | null) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime?.startsWith('image/')) return FileImage;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return FileSpreadsheet;
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'pdf'].includes(ext)) return FileText;
  return FileIcon;
}

function formatSize(b: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SectionAttachments({ sectionId }: { sectionId: string }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cost_section_attachments')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });
    if (error) {
      setLoading(false);
      return;
    }
    const rows = (data || []) as Attachment[];
    if (rows.length > 0) {
      const { data: signed } = await supabase.storage
        .from('cost-attachments')
        .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
      const map = new Map<string, string>();
      (signed || []).forEach((s: any) => s.signedUrl && s.path && map.set(s.path, s.signedUrl));
      rows.forEach((r) => (r.signedUrl = map.get(r.storage_path)));
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(t(`"${file.name}" exceeds 10MB limit`, `Το "${file.name}" υπερβαίνει το όριο 10MB`));
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${sectionId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from('cost-attachments')
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { error: insErr } = await supabase.from('cost_section_attachments').insert({
          section_id: sectionId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          uploaded_by: user.id,
        });
        if (insErr) {
          await supabase.storage.from('cost-attachments').remove([path]);
          toast.error(`${file.name}: ${insErr.message}`);
          continue;
        }
      }
      toast.success(t('Files uploaded', 'Τα αρχεία ανέβηκαν'));
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(t(`Delete "${att.file_name}"?`, `Διαγραφή "${att.file_name}";`))) return;
    const { error } = await supabase.from('cost_section_attachments').delete().eq('id', att.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from('cost-attachments').remove([att.storage_path]);
    toast.success(t('File deleted', 'Το αρχείο διαγράφηκε'));
    setItems((xs) => xs.filter((x) => x.id !== att.id));
  };

  return (
    <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          {t('Attachments', 'Συνημμένα')} ({items.length})
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {t('Upload', 'Ανέβασμα')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">{t('Loading...', 'Φόρτωση...')}</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          {t('No files attached', 'Δεν υπάρχουν συνημμένα αρχεία')}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => {
            const Icon = iconFor(a.file_name, a.mime_type);
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 bg-background border rounded-md px-2.5 py-1.5"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={a.signedUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm hover:underline truncate"
                  title={a.file_name}
                >
                  {a.file_name}
                </a>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatSize(a.file_size)}</span>
                {a.signedUrl && (
                  <a
                    href={a.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    title={t('Open', 'Άνοιγμα')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  title={t('Delete', 'Διαγραφή')}
                  onClick={() => handleDelete(a)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
