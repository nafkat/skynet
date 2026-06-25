import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Mic, MicOff, Camera, X, Plus,
  Save, Check, Loader2, Trash2,
} from 'lucide-react';
import { getDailyWallpaper } from '@/hooks/useWallpaper';

interface Section {
  id: string;
  title: string;
}

interface PhotoPreview {
  file: File;
  previewUrl: string;
}

interface ExistingPhoto {
  id: string;
  storage_path: string;
  signedUrl: string;
}

const CALC_TYPES = [
  { value: 'unit',    labelEn: 'Per Unit',    labelEl: 'Ανά Τεμάχιο' },
  { value: 'lumpsum', labelEn: 'Lump Sum',    labelEl: "Κατ' Αποκοπή" },
  { value: 'area',    labelEn: 'Area (m²)',   labelEl: 'Εμβαδόν (m²)' },
  { value: 'linear',  labelEn: 'Linear (m)',  labelEl: 'Γραμμικά (m)' },
  { value: 'weight',  labelEn: 'Weight (kg)', labelEl: 'Βάρος (kg)' },
];

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function CostingFieldEntry() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const editingItemId = searchParams.get('edit');
  const isEditMode = !!editingItemId;
  const navigate = useNavigate();
  const { user, hasElevatedRole, hasPermission } = useAuth();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);
  const wallpaperUrl = getDailyWallpaper();
  const canManageSections = hasElevatedRole || hasPermission('costing.reports.create') || hasPermission('costing.reports.edit');

  const [reportCode, setReportCode] = useState('');
  const [projectName, setProjectName] = useState('');

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [calcType, setCalcType] = useState('unit');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<{ id: string; storage_path: string }[]>([]);

  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Voice note (separate audio attachment, independent from transcription)
  const [voiceNoteBlob, setVoiceNoteBlob] = useState<Blob | null>(null);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string>('');
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [existingVoiceNotePath, setExistingVoiceNotePath] = useState<string | null>(null);
  const [existingVoiceNoteUrl, setExistingVoiceNoteUrl] = useState<string>('');
  const [voiceNoteToDelete, setVoiceNoteToDelete] = useState<string | null>(null);
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteChunksRef = useRef<Blob[]>([]);
  const noteStreamRef = useRef<MediaStream | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [savedItems, setSavedItems] = useState<{ id: string; description: string }[]>([]);
  const [lastSavedDesc, setLastSavedDesc] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  const hasUnsaved =
    !isEditMode &&
    (title.trim().length > 0 || description.trim().length > 0 || quantity.trim().length > 0 || photos.length > 0 || !!voiceNoteBlob);

  // Warn on browser/tab close while unsaved
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);


  useEffect(() => {
    setVoiceSupported(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined'
    );
  }, []);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('cost_reports')
      .select('code, deleted_at, projects(project_code, project_name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
      .then(({ data }) => {
        if (data) {
          setReportCode(data.code);
          const p = (data as any).projects;
          setProjectName(p ? `${p.project_code} — ${p.project_name}` : '');
        }
      });
    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load existing item in edit mode
  useEffect(() => {
    if (!editingItemId) return;
    (async () => {
      const { data: item } = await supabase
        .from('cost_items')
        .select('title, description, calculation_type, quantity, unit, section_id, voice_note_path')
        .eq('id', editingItemId)
        .single();
      if (item) {
        setTitle((item as any).title ?? '');
        setDescription(item.description ?? '');
        setCalcType(item.calculation_type ?? 'unit');
        setQuantity(item.quantity?.toString() ?? '');
        setUnit(item.unit ?? '');
        setSelectedSectionId(item.section_id);
        const vnp = (item as any).voice_note_path as string | null;
        if (vnp) {
          setExistingVoiceNotePath(vnp);
          const { data: signed } = await supabase.storage
            .from('cost-photos')
            .createSignedUrl(vnp, 3600);
          if (signed?.signedUrl) setExistingVoiceNoteUrl(signed.signedUrl);
        }
      }

      const { data: ph } = await supabase
        .from('cost_item_photos')
        .select('id, storage_path')
        .eq('item_id', editingItemId);

      if (ph && ph.length > 0) {
        const withUrls = await Promise.all(
          ph.map(async (p) => {
            const { data: signed } = await supabase.storage
              .from('cost-photos')
              .createSignedUrl(p.storage_path, 3600);
            return { id: p.id, storage_path: p.storage_path, signedUrl: signed?.signedUrl ?? '' };
          })
        );
        setExistingPhotos(withUrls);
      }
    })();
  }, [editingItemId]);

  const fetchSections = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('cost_sections')
      .select('id, title')
      .eq('report_id', id)
      .order('sort_order');
    setSections(data || []);
    if (data && data.length > 0 && !selectedSectionId && !editingItemId) {
      setSelectedSectionId(data[0].id);
    }
  };

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = mimeCandidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1024) {
          toast.error(t('Recording too short', 'Πολύ σύντομη ηχογράφηση'));
          return;
        }
        setTranscribing(true);
        try {
          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          const file = new File([blob], `recording.${ext}`, { type: blob.type });
          const form = new FormData();
          form.append('file', file);
          const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: form });
          if (error) throw error;
          const transcript = (data as any)?.text?.trim();
          if (transcript) {
            setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
            toast.success(t('Transcribed', 'Μεταγράφηκε'));
          } else {
            toast.error(t('No speech detected', 'Δεν εντοπίστηκε ομιλία'));
          }
        } catch (err: any) {
          toast.error(t('Transcription failed', 'Αποτυχία μεταγραφής') + (err?.message ? `: ${err.message}` : ''));
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setIsListening(true);
    } catch {
      toast.error(t('Microphone access denied', 'Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο'));
    }
  }, [language]);

  const stopListening = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    setIsListening(false);
  }, []);

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // ---- Voice Note (separate audio attachment) ----
  const startVoiceNote = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      noteStreamRef.current = stream;
      noteChunksRef.current = [];
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = mimeCandidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      noteRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) noteChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        noteStreamRef.current = null;
        const blob = new Blob(noteChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 512) {
          toast.error(t('Recording too short', 'Πολύ σύντομη ηχογράφηση'));
          return;
        }
        if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
        setVoiceNoteBlob(blob);
        setVoiceNoteUrl(URL.createObjectURL(blob));
        toast.success(t('Voice note recorded', 'Ηχητικό σημείωμα ηχογραφήθηκε'));
      };
      recorder.start();
      setIsRecordingNote(true);
    } catch {
      toast.error(t('Microphone access denied', 'Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο'));
    }
  }, [language, voiceNoteUrl]);

  const stopVoiceNote = useCallback(() => {
    try { noteRecorderRef.current?.stop(); } catch {}
    setIsRecordingNote(false);
  }, []);

  const toggleVoiceNote = () => {
    if (isRecordingNote) stopVoiceNote();
    else startVoiceNote();
  };

  const clearNewVoiceNote = () => {
    if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
    setVoiceNoteBlob(null);
    setVoiceNoteUrl('');
  };

  const removeExistingVoiceNote = () => {
    if (existingVoiceNotePath) setVoiceNoteToDelete(existingVoiceNotePath);
    setExistingVoiceNotePath(null);
    setExistingVoiceNoteUrl('');
  };




  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const removeExistingPhoto = (photoId: string) => {
    const p = existingPhotos.find(x => x.id === photoId);
    if (!p) return;
    setPhotosToDelete(prev => [...prev, { id: p.id, storage_path: p.storage_path }]);
    setExistingPhotos(prev => prev.filter(x => x.id !== photoId));
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim() || !id) return;
    const { data, error } = await supabase
      .from('cost_sections')
      .insert({
        report_id: id,
        title: newSectionTitle.trim(),
        sort_order: sections.length,
      })
      .select()
      .single();
    if (error) {
      toast.error(t('Error creating section', 'Σφάλμα δημιουργίας τμήματος'));
      return;
    }
    setNewSectionTitle('');
    setShowNewSection(false);
    await fetchSections();
    if (data) setSelectedSectionId(data.id);
    toast.success(t('Section created', 'Τμήμα δημιουργήθηκε'));
  };

  const uploadPhoto = async (itemId: string, photo: PhotoPreview): Promise<string | null> => {
    const ext = photo.file.name.split('.').pop() || 'jpg';
    const path = `${id}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('cost-photos')
      .upload(path, photo.file, { contentType: photo.file.type, upsert: false });
    if (error) {
      console.error('Photo upload error:', error);
      return null;
    }
    return path;
  };

  const handleSave = async () => {
    setSaveError('');
    if (!description.trim()) {
      setSaveError(t('Please enter a description', 'Εισάγετε περιγραφή εργασίας'));
      toast.error(t('Please enter a description', 'Εισάγετε περιγραφή εργασίας'));
      return;
    }
    if (!selectedSectionId) {
      setSaveError(t('Please select or create a section', 'Επιλέξτε ή δημιουργήστε τμήμα'));
      toast.error(t('Please select or create a section', 'Επιλέξτε ή δημιουργήστε τμήμα'));
      return;
    }

    setSaving(true);
    try {
      let itemId = editingItemId;
      const savedDescription = description.trim();

      const savedTitle = title.trim();
      if (isEditMode && editingItemId) {
        // UPDATE
        const { error: uErr } = await supabase
          .from('cost_items')
          .update({
            section_id: selectedSectionId,
            title: savedTitle || null,
            description: savedDescription,
            calculation_type: calcType,
            quantity: calcType !== 'lumpsum' && quantity ? parseFloat(quantity) : null,
            unit: unit || null,
          })
          .eq('id', editingItemId);
        if (uErr) throw new Error(uErr.message);

        if (photosToDelete.length > 0) {
          await supabase.storage.from('cost-photos').remove(photosToDelete.map(p => p.storage_path));
          await supabase.from('cost_item_photos').delete().in('id', photosToDelete.map(p => p.id));
        }
      } else {
        // INSERT
        const { data: item, error: iErr } = await supabase
          .from('cost_items')
          .insert({
            section_id: selectedSectionId,
            title: savedTitle || null,
            description: savedDescription,
            calculation_type: calcType,
            quantity: calcType !== 'lumpsum' && quantity ? parseFloat(quantity) : null,
            unit: unit || null,
            sort_order: 999,
            created_by: user?.id ?? null,
          })
          .select('id')
          .maybeSingle();

        if (iErr) throw new Error(iErr.message);

        if (item?.id) {
          itemId = item.id;
        } else {
          // Insert succeeded but returning blocked — fall back to fetching latest
          const { data: fallback } = await supabase
            .from('cost_items')
            .select('id')
            .eq('section_id', selectedSectionId)
            .eq('description', savedDescription)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          itemId = fallback?.id ?? null;
        }

        if (!itemId) {
          throw new Error(t('Item was not saved (no id returned)', 'Η εργασία δεν αποθηκεύτηκε (χωρίς id)'));
        }
      }

      // Upload photos — non-blocking for the item itself
      let photoFailures = 0;
      if (itemId) {
        for (const photo of photos) {
          const path = await uploadPhoto(itemId, photo);
          if (path) {
            const { error: pErr } = await supabase.from('cost_item_photos').insert({
              item_id: itemId,
              storage_path: path,
              caption: '',
              created_by: user?.id ?? null,
            });
            if (pErr) photoFailures++;
          } else {
            photoFailures++;
          }
        }
      }

      photos.forEach(p => URL.revokeObjectURL(p.previewUrl));

      // ---- Voice note handling ----
      // Delete removed existing voice note
      if (voiceNoteToDelete) {
        await supabase.storage.from('cost-photos').remove([voiceNoteToDelete]);
        if (itemId) {
          await supabase.from('cost_items').update({ voice_note_path: null }).eq('id', itemId);
        }
        setVoiceNoteToDelete(null);
      }
      // Upload new voice note
      if (itemId && voiceNoteBlob) {
        const ext = voiceNoteBlob.type.includes('mp4') ? 'm4a' : 'webm';
        const path = `${id}/${itemId}/voice-${Date.now()}.${ext}`;
        const { error: vErr } = await supabase.storage
          .from('cost-photos')
          .upload(path, voiceNoteBlob, { contentType: voiceNoteBlob.type, upsert: false });
        if (!vErr) {
          await supabase.from('cost_items').update({ voice_note_path: path }).eq('id', itemId);
        } else {
          toast.warning(t('Voice note upload failed', 'Αποτυχία ανεβάσματος ηχητικού'));
        }
      }

      if (photoFailures > 0) {
        toast.warning(
          t(
            `Item saved, but ${photoFailures} photo(s) failed to upload.`,
            `Η εργασία αποθηκεύτηκε, αλλά ${photoFailures} φωτογραφία(-ες) απέτυχαν.`,
          ),
        );
      }

      if (isEditMode) {
        toast.success(t('Item updated', 'Η εργασία ενημερώθηκε'));
        navigate(`/costing/reports/${id}`);
      } else {
        setLastSavedDesc(savedTitle || savedDescription);
        if (itemId) {
          setSavedItems((prev) => [...prev, { id: itemId!, description: savedTitle || savedDescription }]);
        }
        setTitle('');
        setDescription('');
        setQuantity('');
        setUnit('');
        setCalcType('unit');
        setPhotos([]);
        if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
        setVoiceNoteBlob(null);
        setVoiceNoteUrl('');
        setSavedCount(c => c + 1);
        toast.success(t('Item saved! Ready for next.', 'Αποθηκεύτηκε! Έτοιμο για επόμενο.'));
      }
    } catch (err: any) {
      console.error('Field Entry save error:', err);
      const msg = err?.message || t('Error saving item', 'Σφάλμα αποθήκευσης εργασίας');
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteItem = async () => {
    if (!editingItemId) return;
    setDeleting(true);
    try {
      // Delete photos & voice note from storage first
      if (existingPhotos.length > 0) {
        await supabase.storage.from('cost-photos').remove(existingPhotos.map(p => p.storage_path));
      }
      if (existingVoiceNotePath) {
        await supabase.storage.from('cost-photos').remove([existingVoiceNotePath]);
      }
      const { error } = await supabase.from('cost_items').delete().eq('id', editingItemId);
      if (error) throw error;
      toast.success(t('Item deleted', 'Η εργασία διαγράφηκε'));
      navigate(`/costing/reports/${id}`);
    } catch (err) {
      console.error(err);
      toast.error(t('Error deleting item', 'Σφάλμα διαγραφής'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDone = () => {
    if (hasUnsaved) {
      setConfirmLeave(true);
      return;
    }
    navigate(`/costing/reports/${id}`);
  };
  const confirmLeaveNow = () => {
    setConfirmLeave(false);
    navigate(`/costing/reports/${id}`);
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/60 z-0" />

      <div className="relative z-10 max-w-2xl mx-auto p-4 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDone}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">
              {reportCode} — {isEditMode ? t('Edit Item', 'Επεξεργασία Εργασίας') : t('Field Entry', 'Καταγραφή Επί Τόπου')}
            </div>
            <div className="text-white/70 text-xs truncate">{projectName}</div>
          </div>
          {savedCount > 0 && !isEditMode && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/90 text-white text-sm font-medium">
              <Check className="h-4 w-4" />
              {savedCount} {t('saved', 'αποθ.')}
            </div>
          )}
          {isEditMode && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              className="bg-white/10 border-white/20 text-white hover:bg-red-500/80"
              title={t('Delete Item', 'Διαγραφή Εργασίας')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Saved-this-session banner */}
        {!isEditMode && savedItems.length > 0 && (
          <div className="bg-green-500/15 backdrop-blur-sm border border-green-400/50 rounded-xl p-3 space-y-1">
            <div className="text-green-50 text-xs font-semibold uppercase tracking-wider">
              {t('Saved in this session', 'Αποθηκευμένα σε αυτή τη συνεδρία')} ({savedItems.length})
            </div>
            <ol className="text-green-50 text-sm space-y-0.5 list-decimal list-inside max-h-40 overflow-auto">
              {savedItems.map((it) => (
                <li key={it.id} className="truncate" title={it.description}>{it.description}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Section selector */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border p-4 space-y-3">
          <Label className="text-sm font-semibold">
            {t('Section', 'Τμήμα Εργασίας')} *
          </Label>

          {sections.length > 0 && (
            <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('Select section', 'Επιλέξτε τμήμα')} />
              </SelectTrigger>
              <SelectContent>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {canManageSections && (showNewSection ? (
            <div className="flex gap-2">
              <Input
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                placeholder={t('New section title...', 'Τίτλος νέου τμήματος...')}
                className="h-12 text-base flex-1"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddSection()}
              />
              <Button onClick={handleAddSection} className="h-12 px-3">
                <Check className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowNewSection(false)}
                className="h-12 px-3"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowNewSection(true)}
              className="w-full h-12"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('New Section', 'Νέο Τμήμα')}
            </Button>
          ))}
        </div>

        {/* Title + Description + Voice */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border p-4 space-y-3">
          <Label className="text-sm font-semibold">
            {t('Title', 'Τίτλος')}
          </Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('Short title (e.g. KATASKEVI)', 'Σύντομος τίτλος (π.χ. ΚΑΤΑΣΚΕΥΗ)')}
            className="h-11 text-base"
          />
          <Label className="text-sm font-semibold">
            {t('Work Description', 'Περιγραφή Εργασίας')} *
          </Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('Describe the work done...', 'Περιγράψτε την εργασία...')}
            rows={4}
            className="text-base resize-none"
          />

          {voiceSupported ? (
            <Button
              type="button"
              onClick={toggleListening}
              disabled={transcribing}
              className={`w-full h-14 text-base font-medium transition-all ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {transcribing ? (
                <>{t('Transcribing...', 'Μεταγραφή...')}</>
              ) : isListening ? (
                <>
                  <MicOff className="h-5 w-5 mr-2" />
                  {t('Stop & Transcribe', 'Διακοπή & Μεταγραφή')}
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  {t('Tap to Speak (EL/EN)', 'Πατήστε για Ομιλία (EL/EN)')}
                </>
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {t('Voice input not supported on this browser', 'Η φωνητική εισαγωγή δεν υποστηρίζεται σε αυτό το browser')}
            </p>
          )}
        </div>

        {/* Calculation */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border p-4 space-y-3">
          <Label className="text-sm font-semibold">{t('Measurement', 'Μέτρηση')}</Label>

          <Select value={calcType} onValueChange={setCalcType}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALC_TYPES.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  {language === 'el' ? c.labelEl : c.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {calcType !== 'lumpsum' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('Quantity', 'Ποσότητα')}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  className="h-12 text-base text-center"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('Unit', 'Μονάδα')}</Label>
                <Input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="m², kg..."
                  className="h-12 text-base"
                />
              </div>
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border p-4 space-y-3">
          <Label className="text-sm font-semibold">{t('Photos', 'Φωτογραφίες')}</Label>

          {(existingPhotos.length > 0 || photos.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {existingPhotos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={p.signedUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeExistingPhoto(p.id)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
              {photos.map((p, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="block">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handlePhotoCapture}
            />
            <div className="flex items-center justify-center gap-2 h-14 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {existingPhotos.length + photos.length > 0
                  ? t('Add more photos', 'Προσθήκη φωτογραφιών')
                  : t('Take photo', 'Τράβηξε φωτογραφία')}
              </span>
            </div>
          </label>
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="rounded-lg border border-red-400/60 bg-red-500/15 text-red-100 p-3 text-sm">
            <div className="font-semibold mb-0.5">{t('Save failed', 'Αποτυχία αποθήκευσης')}</div>
            <div className="break-words">{saveError}</div>
          </div>
        )}

        {/* Last saved confirmation */}
        {!isEditMode && lastSavedDesc && !saveError && (
          <div className="rounded-lg border border-green-400/60 bg-green-500/15 text-green-100 p-3 text-sm flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">{t('Last saved', 'Τελευταία αποθήκευση')}</div>
              <div className="truncate">{lastSavedDesc}</div>
            </div>
          </div>
        )}

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving || !description.trim() || !selectedSectionId}
          className="w-full h-16 text-lg font-semibold"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t('Saving...', 'Αποθήκευση...')}
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              {isEditMode
                ? t('Update', 'Ενημέρωση')
                : t('Save & Add Next', 'Αποθήκευση & Επόμενο')}
            </>
          )}
        </Button>


        <Button
          variant="outline"
          onClick={handleDone}
          className="w-full h-12 bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          {isEditMode ? t('Cancel', 'Άκυρο') : t('Done', 'Τέλος')}
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this item?', 'Διαγραφή αυτής της εργασίας;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This action cannot be undone. All photos will be deleted too.', 'Η ενέργεια δεν αναιρείται. Θα διαγραφούν και όλες οι φωτογραφίες.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('Cancel', 'Άκυρο')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground"
            >
              {deleting ? t('Deleting...', 'Διαγραφή...') : t('Delete', 'Διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Leave without saving?', 'Έξοδος χωρίς αποθήκευση;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'You have an unsaved item (description, quantity, or photos). If you leave now, it will be lost.',
                'Έχετε μη αποθηκευμένη εργασία (περιγραφή, ποσότητα ή φωτογραφίες). Αν φύγετε, θα χαθεί.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Stay & save', 'Παραμονή & αποθήκευση')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeaveNow}
              className="bg-destructive text-destructive-foreground"
            >
              {t('Leave anyway', 'Έξοδος ούτως ή άλλως')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
