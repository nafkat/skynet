import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Megaphone, 
  ArrowLeft, 
  Upload, 
  X, 
  Users, 
  Send, 
  Save,
  Loader2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
  specialty_id: string;
}

interface Specialty {
  id: string;
  code: string;
  name_en: string;
  name_el: string;
}

interface UploadedFile {
  file: File;
  preview?: string;
}

export default function AnnouncementCreate() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectAllActive, setSelectAllActive] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Confirmation dialog states
  const [showAllActiveConfirm, setShowAllActiveConfirm] = useState(false);
  const [showEmployeeConfirm, setShowEmployeeConfirm] = useState<Employee | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesRes, specialtiesRes] = await Promise.all([
        supabase.from('employees').select('id, employee_code, first_name, last_name, status, specialty_id').eq('status', 'active').order('last_name'),
        supabase.from('specialties').select('id, code, name_en, name_el').order('code'),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (specialtiesRes.error) throw specialtiesRes.error;

      setEmployees(employeesRes.data || []);
      setSpecialties(specialtiesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('Failed to load data', 'Αποτυχία φόρτωσης δεδομένων'));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEmployees = () => {
    return employees.filter(e => {
      if (specialtyFilter !== 'all' && e.specialty_id !== specialtyFilter) {
        return false;
      }
      return true;
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      newFiles.push({ file: files[i] });
    }
    setUploadedFiles(prev => [...prev, ...newFiles]);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Employee toggle with confirmation popup
  const handleEmployeeToggle = (employeeId: string) => {
    const isCurrentlySelected = selectedEmployees.includes(employeeId);
    
    if (isCurrentlySelected) {
      // Deselecting — no confirmation needed
      setSelectAllActive(false);
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));
    } else {
      // Selecting — show confirmation
      const employee = employees.find(e => e.id === employeeId);
      if (employee) {
        setShowEmployeeConfirm(employee);
      }
    }
  };

  const confirmEmployeeSelect = () => {
    if (showEmployeeConfirm) {
      setSelectedEmployees(prev => [...prev, showEmployeeConfirm.id]);
      setShowEmployeeConfirm(null);
    }
  };

  // All Active toggle with confirmation
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setShowAllActiveConfirm(true);
    } else {
      setSelectAllActive(false);
      setSelectedEmployees([]);
    }
  };

  const confirmSelectAll = () => {
    setSelectAllActive(true);
    const filteredIds = getFilteredEmployees().map(e => e.id);
    setSelectedEmployees(filteredIds);
    setShowAllActiveConfirm(false);
  };

  // Keep selected in sync when filter changes and selectAll is on
  useEffect(() => {
    if (selectAllActive) {
      const filteredIds = getFilteredEmployees().map(e => e.id);
      setSelectedEmployees(filteredIds);
    }
  }, [specialtyFilter, employees, selectAllActive]);

  const handleSpecialtyChange = (value: string) => {
    setSpecialtyFilter(value);
  };

  const uploadFiles = async (announcementId: string): Promise<{ fileName: string; filePath: string; fileSize: number; mimeType: string }[]> => {
    const uploadedAttachments = [];

    for (const { file } of uploadedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${announcementId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('announcements')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      uploadedAttachments.push({
        fileName: file.name,
        filePath: fileName,
        fileSize: file.size,
        mimeType: file.type,
      });
    }

    return uploadedAttachments;
  };

  const handleSendClick = () => {
    // Validation first
    if (!title.trim()) {
      toast.error(t('Title is required', 'Ο τίτλος είναι υποχρεωτικός'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('Message is required', 'Το μήνυμα είναι υποχρεωτικό'));
      return;
    }
    if (selectedEmployees.length === 0) {
      toast.error(t('Select at least one recipient', 'Επιλέξτε τουλάχιστον έναν παραλήπτη'));
      return;
    }
    setShowSendConfirm(true);
  };

  const saveAnnouncement = async (shouldSend: boolean) => {
    if (!title.trim()) {
      toast.error(t('Title is required', 'Ο τίτλος είναι υποχρεωτικός'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('Message is required', 'Το μήνυμα είναι υποχρεωτικό'));
      return;
    }
    if (selectedEmployees.length === 0) {
      toast.error(t('Select at least one recipient', 'Επιλέξτε τουλάχιστον έναν παραλήπτη'));
      return;
    }

    setSaving(true);

    try {
      const { data: announcement, error: announcementError } = await supabase
        .from('announcements')
        .insert({
          title: title.trim(),
          message: message.trim(),
          status: shouldSend ? 'pending' : 'draft',
          created_by: user?.id,
          sent_at: shouldSend ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (announcementError) throw announcementError;

      if (uploadedFiles.length > 0) {
        const attachments = await uploadFiles(announcement.id);
        
        for (const att of attachments) {
          await supabase.from('announcement_attachments').insert({
            announcement_id: announcement.id,
            file_name: att.fileName,
            file_path: att.filePath,
            file_size: att.fileSize,
            mime_type: att.mimeType,
          });
        }
      }

      const recipientInserts = selectedEmployees.map(employeeId => ({
        announcement_id: announcement.id,
        employee_id: employeeId,
      }));

      const { data: recipients, error: recipientsError } = await supabase
        .from('announcement_recipients')
        .insert(recipientInserts)
        .select();

      if (recipientsError) throw recipientsError;

      if (shouldSend && recipients) {
        const deliveryInserts = recipients.map(r => ({
          announcement_id: announcement.id,
          recipient_id: r.id,
          channel: 'telegram',
          status: 'pending' as const,
        }));

        await supabase.from('announcement_deliveries').insert(deliveryInserts);
      }

      toast.success(
        shouldSend 
          ? t('Queued for sending', 'Τοποθετήθηκε στην ουρά αποστολής')
          : t('Draft saved', 'Το πρόχειρο αποθηκεύτηκε')
      );

      navigate(`/announcements/${announcement.id}`);
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast.error(t('Failed to save announcement', 'Αποτυχία αποθήκευσης ανακοίνωσης'));
    } finally {
      setSaving(false);
    }
  };

  const getSpecialtyName = (id: string) => {
    const specialty = specialties.find(s => s.id === id);
    if (!specialty) return '';
    return language === 'el' ? specialty.name_el : specialty.name_en;
  };

  const getSelectedEmployeeNames = () => {
    return employees
      .filter(e => selectedEmployees.includes(e.id))
      .map(e => `${e.last_name} ${e.first_name} (${e.employee_code})`);
  };

  const filteredEmployees = getFilteredEmployees();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/announcements')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('New Announcement', 'Νέα Ανακοίνωση')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('Create and send announcements via Telegram', 'Δημιουργία και αποστολή ανακοινώσεων μέσω Telegram')}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Announcement Details', 'Λεπτομέρειες Ανακοίνωσης')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t('Title', 'Τίτλος')} *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('Enter announcement title...', 'Εισάγετε τίτλο ανακοίνωσης...')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t('Message', 'Μήνυμα')} *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('Enter your message...', 'Εισάγετε το μήνυμά σας...')}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('Attachments', 'Συνημμένα')}</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center cursor-pointer py-4"
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {t('Click to upload files', 'Κάντε κλικ για να ανεβάσετε αρχεία')}
                  </span>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-4">
                  {uploadedFiles.map((uf, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{uf.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uf.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('Recipients', 'Παραλήπτες')}
            </CardTitle>
            <CardDescription>
              {t('Select employees who will receive this announcement', 'Επιλέξτε υπαλλήλους που θα λάβουν αυτή την ανακοίνωση')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">{t('All Active Employees', 'Όλοι οι Ενεργοί Υπάλληλοι')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('Send to all active employees', 'Αποστολή σε όλους τους ενεργούς υπαλλήλους')}
                </p>
              </div>
              <Switch
                checked={selectAllActive}
                onCheckedChange={handleSelectAll}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('Filter by Specialty', 'Φίλτρο ανά Ειδικότητα')}</Label>
              <Select value={specialtyFilter} onValueChange={handleSpecialtyChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('All Specialties', 'Όλες οι Ειδικότητες')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Specialties', 'Όλες οι Ειδικότητες')}</SelectItem>
                  {specialties.map((spec) => (
                    <SelectItem key={spec.id} value={spec.id}>
                      {spec.code} - {language === 'el' ? spec.name_el : spec.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t('No employees found', 'Δεν βρέθηκαν υπάλληλοι')}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleEmployeeToggle(employee.id)}
                    >
                      <Checkbox
                        checked={selectedEmployees.includes(employee.id)}
                        onCheckedChange={() => handleEmployeeToggle(employee.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {employee.last_name} {employee.first_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {employee.employee_code} • {getSpecialtyName(employee.specialty_id)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                {selectedEmployees.length} {t('selected', 'επιλεγμένοι')}
              </Badge>
              {!selectAllActive && selectedEmployees.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEmployees([])}
                >
                  {t('Clear selection', 'Εκκαθάριση επιλογής')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => saveAnnouncement(false)}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('Save Draft', 'Αποθήκευση Πρόχειρου')}
          </Button>
          <Button
            onClick={handleSendClick}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t('Send', 'Αποστολή')}
          </Button>
        </div>
      </div>

      {/* Confirmation: Select All Active */}
      <AlertDialog open={showAllActiveConfirm} onOpenChange={setShowAllActiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Select All Active Employees?', 'Επιλογή Όλων των Ενεργών Υπαλλήλων;')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `This will select all ${getFilteredEmployees().length} active employees as recipients. Are you sure?`,
                `Αυτό θα επιλέξει και τους ${getFilteredEmployees().length} ενεργούς υπαλλήλους ως παραλήπτες. Είστε σίγουροι;`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSelectAll}>
              {t('Yes, select all', 'Ναι, επιλογή όλων')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Individual Employee */}
      <AlertDialog open={!!showEmployeeConfirm} onOpenChange={(open) => !open && setShowEmployeeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Add Recipient?', 'Προσθήκη Παραλήπτη;')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showEmployeeConfirm && t(
                `Are you sure you want to add "${showEmployeeConfirm.last_name} ${showEmployeeConfirm.first_name}" (${showEmployeeConfirm.employee_code}) as a recipient?`,
                `Είστε σίγουροι ότι θέλετε να προσθέσετε τον/την "${showEmployeeConfirm.last_name} ${showEmployeeConfirm.first_name}" (${showEmployeeConfirm.employee_code}) ως παραλήπτη;`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEmployeeSelect}>
              {t('Yes, add', 'Ναι, προσθήκη')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Send */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Confirm Send Announcement', 'Επιβεβαίωση Αποστολής Ανακοίνωσης')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {t(
                    `You are about to send this announcement to ${selectedEmployees.length} recipient(s):`,
                    `Πρόκειται να στείλετε αυτή την ανακοίνωση σε ${selectedEmployees.length} παραλήπτη(-ες):`
                  )}
                </p>
                <div className="max-h-[200px] overflow-y-auto border rounded-md p-3 bg-muted/30 text-sm space-y-1">
                  {getSelectedEmployeeNames().map((name, i) => (
                    <p key={i}>• {name}</p>
                  ))}
                </div>
                <p className="font-medium text-destructive">
                  {t('This action cannot be undone.', 'Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSendConfirm(false); saveAnnouncement(true); }}>
              {t('Yes, Send Now', 'Ναι, Αποστολή Τώρα')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
