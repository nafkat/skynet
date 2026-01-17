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
  const [selectAllActive, setSelectAllActive] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // When "All Active" is toggled, select/deselect all filtered employees
    if (selectAllActive) {
      const filteredEmployeeIds = getFilteredEmployees().map(e => e.id);
      setSelectedEmployees(filteredEmployeeIds);
    }
  }, [selectAllActive, specialtyFilter, employees]);

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
      
      // Select all active employees by default
      setSelectedEmployees((employeesRes.data || []).map(e => e.id));
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

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectAllActive(false);
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAllActive(checked);
    if (checked) {
      const filteredIds = getFilteredEmployees().map(e => e.id);
      setSelectedEmployees(filteredIds);
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSpecialtyChange = (value: string) => {
    setSpecialtyFilter(value);
    if (selectAllActive) {
      // Reselect based on new filter
      const filtered = employees.filter(e => 
        value === 'all' || e.specialty_id === value
      );
      setSelectedEmployees(filtered.map(e => e.id));
    }
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

  const saveAnnouncement = async (shouldSend: boolean) => {
    // Validation
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
      // Create announcement
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

      // Upload attachments
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

      // Create recipients
      const recipientInserts = selectedEmployees.map(employeeId => ({
        announcement_id: announcement.id,
        employee_id: employeeId,
      }));

      const { data: recipients, error: recipientsError } = await supabase
        .from('announcement_recipients')
        .insert(recipientInserts)
        .select();

      if (recipientsError) throw recipientsError;

      // If sending, create deliveries
      if (shouldSend && recipients) {
        const deliveryInserts = recipients.map(r => ({
          announcement_id: announcement.id,
          recipient_id: r.id,
          channel: 'viber',
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
                {t('Create and send announcements via Viber', 'Δημιουργία και αποστολή ανακοινώσεων μέσω Viber')}
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
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('Title', 'Τίτλος')} *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('Enter announcement title...', 'Εισάγετε τίτλο ανακοίνωσης...')}
              />
            </div>

            {/* Message */}
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

            {/* Attachments */}
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
            {/* All Active Toggle */}
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

            {/* Specialty Filter */}
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

            {/* Employee List */}
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

            {/* Selected Count */}
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
            onClick={() => saveAnnouncement(true)}
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
    </MainLayout>
  );
}
