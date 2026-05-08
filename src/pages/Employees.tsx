import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Search, Edit2, ChevronDown, ChevronRight, Archive, Trash2, MoreHorizontal, AlertCircle, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { TelegramLinkCard } from '@/components/TelegramLinkCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Specialty {
  id: string;
  name_en: string;
  name_el: string;
  code: string;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
}

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty_id: string;
  status: 'active' | 'inactive';
  regular_hourly_rate: number;
  regular_rate_all_in: number;
  overtime_hourly_rate: number;
  regular_start_time: string;
  regular_end_time: string;
  phone: string | null;
  hire_date: string | null;
  notes: string | null;
  afm: string | null;
  id_type: string | null;
  id_number: string | null;
  iban: string | null;
  bank_name: string | null;
  assigned_user_id: string | null;
  specialties?: Specialty;
}

interface EmployeeAllowedProject {
  employee_id: string;
  project_id: string;
}

interface AppUser {
  user_id: string;
  full_name: string | null;
  role: string;
}

export default function Employees() {
const { t, language } = useLanguage();
  const { hasElevatedRole, isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employeeProjects, setEmployeeProjects] = useState<EmployeeAllowedProject[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  
  // Delete/Archive state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [canHardDelete, setCanHardDelete] = useState(false);
  const [checkingDeletability, setCheckingDeletability] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [payrollSectionOpen, setPayrollSectionOpen] = useState(false);

  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any[]>([]);
  const [pendingEmployeeData, setPendingEmployeeData] = useState<any>(null);

  // Form state - Core
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  
  // Form state - Work Schedule
  const [regularStart, setRegularStart] = useState('07:00');
  const [regularEnd, setRegularEnd] = useState('14:00');
  
  // Form state - Pay Rates (Admin/HR only)
  const [regularRate, setRegularRate] = useState('');
  const [regularRateAllIn, setRegularRateAllIn] = useState('');
  const [overtimeRate, setOvertimeRate] = useState('');
  
  // Form state - HR Details
  const [phone, setPhone] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Form state - Project Access
  const [allowedProjects, setAllowedProjects] = useState<string[]>([]);
  
  // Form state - Payroll & Legal (Admin/HR only)
  const [afm, setAfm] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [selectedRecorderIds, setSelectedRecorderIds] = useState<string[]>([]);
  const [recordersByEmployee, setRecordersByEmployee] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [specialtiesRes, employeesRes, projectsRes, employeeProjectsRes, usersRes] = await Promise.all([
        supabase.from('specialties').select('*').order('code'),
        supabase.from('employees').select(`*, specialties (id, name_en, name_el, code)`).order('employee_code'),
        supabase.from('projects').select('*').eq('status', 'OPEN').order('project_code'),
        supabase.from('employee_allowed_projects').select('employee_id, project_id'),
        // Fetch users with roles (admin, hr, timekeeper)
        supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'hr', 'timekeeper']),
      ]);

      // Fetch profiles for users with roles
      const userIds = (usersRes.data || []).map(u => u.user_id);
      let profilesData: { user_id: string; full_name: string | null }[] = [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        profilesData = profiles || [];
      }

      // Combine user roles with profile names
      const usersWithNames: AppUser[] = (usersRes.data || []).map(ur => {
        const profile = profilesData.find(p => p.user_id === ur.user_id);
        return {
          user_id: ur.user_id,
          full_name: profile?.full_name || null,
          role: ur.role,
        };
      });

      setSpecialties(specialtiesRes.data || []);
      setEmployees((employeesRes.data as Employee[]) || []);
      setProjects(projectsRes.data || []);
      setEmployeeProjects(employeeProjectsRes.data || []);
      setAppUsers(usersWithNames);

      // Build recorders-by-employee map for list display
      const { data: allRecorders } = await supabase
        .from('employee_recorders')
        .select('employee_id, user_id');
      if (allRecorders) {
        const map: Record<string, string[]> = {};
        allRecorders.forEach((r: any) => {
          const u = usersWithNames.find(x => x.user_id === r.user_id);
          if (!map[r.employee_id]) map[r.employee_id] = [];
          map[r.employee_id].push(u?.full_name || r.user_id.slice(0, 8));
        });
        setRecordersByEmployee(map);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateToDDMMYYYY = (isoDate: string): string => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDateToISO = (ddmmyyyy: string): string | null => {
    if (!ddmmyyyy) return null;
    const parts = ddmmyyyy.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const getTodayDDMMYYYY = (): string => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const validateHireDate = (dateString: string): boolean => {
    if (!dateString) return true;
    const parts = dateString.split('/');
    if (parts.length !== 3) {
      toast.error(language === 'el' ? 'Μη έγκυρη μορφή ημερομηνίας (ΗΗ/ΜΜ/ΕΕΕΕ)' : 'Invalid date format (DD/MM/YYYY)');
      return false;
    }
    const [day, month, year] = parts.map(Number);
    const hireDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(hireDate.getTime())) {
      toast.error(language === 'el' ? 'Μη έγκυρη ημερομηνία' : 'Invalid date');
      return false;
    }
    if (hireDate > today) {
      toast.error(language === 'el' ? 'Η ημερομηνία πρόσληψης δεν μπορεί να είναι στο μέλλον' : 'Hire date cannot be in the future');
      return false;
    }
    return true;
  };

  const checkDuplicates = async (formData: { afm: string; idNumber: string; iban: string }) => {
    const duplicates: any[] = [];
    const excludeId = editingEmployee?.id;

    if (formData.afm) {
      const { data } = await supabase
        .from('employees')
        .select('employee_code, first_name, last_name, status')
        .eq('afm', formData.afm.trim())
        .maybeSingle();
      if (data && (!excludeId || data.employee_code !== editingEmployee?.employee_code)) {
        duplicates.push({ field: language === 'el' ? 'ΑΦΜ' : 'Tax Number (AFM)', value: formData.afm, employee: data });
      }
    }

    if (formData.idNumber) {
      const { data } = await supabase
        .from('employees')
        .select('employee_code, first_name, last_name, status')
        .eq('id_number', formData.idNumber.trim())
        .maybeSingle();
      if (data && (!excludeId || data.employee_code !== editingEmployee?.employee_code)) {
        duplicates.push({ field: language === 'el' ? 'Αρ. Ταυτότητας' : 'ID Number', value: formData.idNumber, employee: data });
      }
    }

    if (formData.iban) {
      const { data } = await supabase
        .from('employees')
        .select('employee_code, first_name, last_name, status')
        .eq('iban', formData.iban.trim())
        .maybeSingle();
      if (data && (!excludeId || data.employee_code !== editingEmployee?.employee_code)) {
        duplicates.push({ field: 'IBAN', value: formData.iban, employee: data });
      }
    }

    return { hasDuplicates: duplicates.length > 0, duplicates };
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setSpecialtyId('');
    setStatus('active');
    setRegularRate('');
    setRegularRateAllIn('');
    setOvertimeRate('');
    setRegularStart('07:00');
    setRegularEnd('14:00');
    setPhone('');
    setHireDate(getTodayDDMMYYYY());
    setNotes('');
    setAllowedProjects([]);
    setAfm('');
    setIdType('');
    setIdNumber('');
    setIban('');
    setBankName('');
    setSelectedRecorderIds([]);
    setEditingEmployee(null);
    setPayrollSectionOpen(false);
  };

  const openEditDialog = async (employee: Employee) => {
    setEditingEmployee(employee);
    setFirstName(employee.first_name);
    setLastName(employee.last_name);
    setSpecialtyId(employee.specialty_id);
    setStatus(employee.status);
    setRegularRate(employee.regular_hourly_rate.toString());
    setRegularRateAllIn(employee.regular_rate_all_in?.toString() || '');
    setOvertimeRate(employee.overtime_hourly_rate.toString());
    setRegularStart(employee.regular_start_time.slice(0, 5));
    setRegularEnd(employee.regular_end_time.slice(0, 5));
    setPhone(employee.phone || '');
    setHireDate(employee.hire_date ? formatDateToDDMMYYYY(employee.hire_date) : '');
    setNotes(employee.notes || '');
    setAfm(employee.afm || '');
    setIdType(employee.id_type || '');
    setIdNumber(employee.id_number || '');
    setIban(employee.iban || '');
    setBankName(employee.bank_name || '');

    // Fetch current recorders for this employee
    const { data: recorderData } = await supabase
      .from('employee_recorders')
      .select('user_id')
      .eq('employee_id', employee.id);
    setSelectedRecorderIds(recorderData?.map(r => r.user_id) || []);

    // Load allowed projects for this employee
    const empProjects = employeeProjects
      .filter(ep => ep.employee_id === employee.id)
      .map(ep => ep.project_id);
    setAllowedProjects(empProjects);
    
    setPayrollSectionOpen(false);
    setIsDialogOpen(true);
  };

  // Pay rate validation
  const payRatesValid = () => {
    if (!hasElevatedRole) return true;
    const regRate = parseFloat(regularRate);
    const allInRate = parseFloat(regularRateAllIn);
    const otRate = parseFloat(overtimeRate);
    return regRate > 0 && allInRate > 0 && otRate > 0;
  };

  const buildEmployeeData = () => {
    const employeeData: any = {
      first_name: firstName,
      last_name: lastName,
      specialty_id: specialtyId,
      status,
      regular_start_time: regularStart,
      regular_end_time: regularEnd,
      phone: phone || null,
      hire_date: formatDateToISO(hireDate) || null,
      notes: notes || null,
    };

    if (hasElevatedRole) {
      employeeData.regular_hourly_rate = parseFloat(regularRate) || 0;
      employeeData.regular_rate_all_in = parseFloat(regularRateAllIn) || 0;
      employeeData.overtime_hourly_rate = parseFloat(overtimeRate) || 0;
      employeeData.afm = afm || null;
      employeeData.id_type = idType || null;
      employeeData.id_number = idNumber || null;
      employeeData.iban = iban || null;
      employeeData.bank_name = bankName || null;
    }
    return employeeData;
  };

  const insertEmployee = async (employeeData?: any) => {
    const data_to_save = employeeData || buildEmployeeData();
    try {
      let employeeId: string;

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(data_to_save)
          .eq('id', editingEmployee.id);
        if (error) throw error;
        employeeId = editingEmployee.id;
        toast.success(t('employees.updateSuccess'));
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert([data_to_save])
          .select('id')
          .single();
        if (error) throw error;
        employeeId = data.id;
        toast.success(t('employees.createSuccess'));
      }

      if (hasElevatedRole && employeeId) {
        await supabase
          .from('employee_allowed_projects')
          .delete()
          .eq('employee_id', employeeId);

        if (allowedProjects.length > 0) {
          const projectAssignments = allowedProjects.map(projectId => ({
            employee_id: employeeId,
            project_id: projectId,
          }));
          await supabase
            .from('employee_allowed_projects')
            .insert(projectAssignments);
        }
      }

      // Save recorder assignments
      if (employeeId) {
        await supabase
          .from('employee_recorders')
          .delete()
          .eq('employee_id', employeeId);

        if (selectedRecorderIds.length > 0) {
          await supabase.from('employee_recorders').insert(
            selectedRecorderIds.map(userId => ({
              employee_id: employeeId,
              user_id: userId,
            }))
          );
        }
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || t('employees.saveError'));
    }
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateDialogOpen(false);
    if (pendingEmployeeData) {
      await insertEmployee(pendingEmployeeData);
    }
    setDuplicateInfo([]);
    setPendingEmployeeData(null);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setDuplicateInfo([]);
    setPendingEmployeeData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !specialtyId) {
      toast.error(t('employees.requiredFields'));
      return;
    }

    if (!regularStart || !regularEnd) {
      toast.error(t('employees.scheduleRequired'));
      return;
    }

    if (selectedRecorderIds.length === 0) {
      toast.error(language === 'el' ? 'Επιλέξτε τουλάχιστον έναν υπεύθυνο καταγραφής' : 'Select at least one daily recorder');
      return;
    }

    if (hasElevatedRole && !payRatesValid()) {
      toast.error(t('employees.payRatesRequired'));
      return;
    }

    if (!validateHireDate(hireDate)) {
      return;
    }

    const employeeData = buildEmployeeData();

    // Check for duplicates
    const duplicateCheck = await checkDuplicates({ afm, idNumber, iban });

    if (duplicateCheck.hasDuplicates) {
      const hasInactiveDuplicate = duplicateCheck.duplicates.some(
        d => d.employee.status === 'inactive' &&
          (d.field === 'ΑΦΜ' || d.field === 'Tax Number (AFM)' || d.field === 'Αρ. Ταυτότητας' || d.field === 'ID Number')
      );

      if (hasInactiveDuplicate) {
        toast.error(
          language === 'el'
            ? 'Το ΑΦΜ ή η Ταυτότητα υπάρχει ήδη σε ανενεργό εργαζόμενο. Δεν επιτρέπεται η επαναχρησιμοποίηση.'
            : 'Tax Number or ID already exists in an inactive employee. Reuse is not allowed.'
        );
        return;
      }

      setDuplicateInfo(duplicateCheck.duplicates);
      setPendingEmployeeData(employeeData);
      setDuplicateDialogOpen(true);
      return;
    }

    await insertEmployee(employeeData);
  };

  const toggleProject = (projectId: string) => {
    setAllowedProjects(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getSpecialtyName = (specialty: Specialty | undefined) => {
    if (!specialty) return '';
    return language === 'el' ? specialty.name_el : specialty.name_en;
  };

  const getRecorderName = (userId: string | null): string => {
    if (!userId) return '-';
    const user = appUsers.find(u => u.user_id === userId);
    if (!user) return '-';
    return user.full_name || user.user_id.slice(0, 8);
  };

  const checkCanDelete = async (employeeId: string): Promise<boolean> => {
    try {
      setCheckingDeletability(true);
      
      // Check for time entries
      const { count: timeEntriesCount } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', employeeId);
      
      if (timeEntriesCount && timeEntriesCount > 0) {
        return false;
      }

      // Check for correction requests (via time entries - already handled above)
      // But also check if employee requested any corrections
      const { count: correctionsCount } = await supabase
        .from('correction_requests')
        .select('*', { count: 'exact', head: true })
        .eq('requested_by', employeeId);

      return (correctionsCount ?? 0) === 0;
    } catch (error) {
      console.error('Error checking deletability:', error);
      return false;
    } finally {
      setCheckingDeletability(false);
    }
  };

  const handleArchiveClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setArchiveDialogOpen(true);
  };

  const handleQuickStatusToggle = (employee: Employee) => {
    setSelectedEmployee(employee);
    setArchiveDialogOpen(true);
  };

  const handleDeleteClick = async (employee: Employee) => {
    setSelectedEmployee(employee);
    const canDelete = await checkCanDelete(employee.id);
    setCanHardDelete(canDelete);
    setDeleteDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!selectedEmployee) return;
    
    try {
      const newStatus = selectedEmployee.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('employees')
        .update({ status: newStatus })
        .eq('id', selectedEmployee.id);
      
      if (error) throw error;
      
      toast.success(
        newStatus === 'inactive' 
          ? t('employees.archiveSuccess') 
          : t('employees.restoreSuccess')
      );
      fetchData();
    } catch (error: any) {
      console.error('Error archiving employee:', error);
      toast.error(error.message || t('employees.archiveError'));
    } finally {
      setArchiveDialogOpen(false);
      setSelectedEmployee(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedEmployee || !canHardDelete) return;
    
    try {
      // First delete allowed projects
      await supabase
        .from('employee_allowed_projects')
        .delete()
        .eq('employee_id', selectedEmployee.id);
      
      // Then delete employee
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', selectedEmployee.id);
      
      if (error) throw error;
      
      toast.success(t('employees.deleteSuccess'));
      fetchData();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast.error(error.message || t('employees.deleteError'));
    } finally {
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      setCanHardDelete(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{t('employees.title')}</h1>
            <p className="page-subtitle">
              {filteredEmployees.length} {t('employees.title').toLowerCase()}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-tablet">
                <Plus className="h-5 w-5 mr-2" />
                {t('employees.addNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? t('common.edit') : t('employees.addNew')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                {/* Employee Core Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {t('employees.coreInfo')}
                  </h3>
                  
                  {editingEmployee && (
                    <div className="space-y-2">
                      <Label>{t('employees.code')}</Label>
                      <Input
                        value={editingEmployee.employee_code}
                        disabled
                        className="input-tablet bg-muted font-mono"
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('employees.firstName')} *</Label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="input-tablet"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('employees.lastName')} *</Label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="input-tablet"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('employees.specialty')} *</Label>
                      <Select value={specialtyId} onValueChange={setSpecialtyId} disabled={!!editingEmployee}>
                        <SelectTrigger className="input-tablet">
                          <SelectValue placeholder={t('employees.specialty')} />
                        </SelectTrigger>
                        <SelectContent>
                          {specialties.map((spec) => (
                            <SelectItem key={spec.id} value={spec.id}>
                              {spec.code} - {getSpecialtyName(spec)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.status')}</Label>
                      <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
                        <SelectTrigger className="input-tablet">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t('common.active')}</SelectItem>
                          <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Daily Recorders - multi-select */}
                  <div className="space-y-2">
                    <Label>
                      {language === 'el' ? 'Υπεύθυνοι Καταγραφής' : 'Daily Recorders'} *
                    </Label>
                    <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                      {appUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {language === 'el' ? 'Δεν υπάρχουν διαθέσιμοι χρήστες' : 'No users available'}
                        </p>
                      ) : (
                        appUsers.map((user) => (
                          <label
                            key={user.user_id}
                            className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded p-1"
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded"
                              checked={selectedRecorderIds.includes(user.user_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecorderIds(prev => [...prev, user.user_id]);
                                } else {
                                  setSelectedRecorderIds(prev => prev.filter(id => id !== user.user_id));
                                }
                              }}
                            />
                            <span className="text-sm">
                              {user.full_name || user.user_id.slice(0, 8)}
                              <span className="text-muted-foreground ml-1">
                                ({t(`role.${user.role}`)})
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedRecorderIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedRecorderIds.length} {language === 'el' ? 'επιλεγμένοι' : 'selected'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Work Schedule Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {t('employees.workSchedule')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('employees.startTime')} *</Label>
                      <Input
                        type="time"
                        value={regularStart}
                        onChange={(e) => setRegularStart(e.target.value)}
                        className="input-tablet"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('employees.endTime')} *</Label>
                      <Input
                        type="time"
                        value={regularEnd}
                        onChange={(e) => setRegularEnd(e.target.value)}
                        className="input-tablet"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Pay Rates Section - Admin/HR Only */}
                {hasElevatedRole && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {t('employees.payRates')}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t('employees.allRatesRequired')}
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t('employees.regularRate')} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={regularRate}
                          onChange={(e) => setRegularRate(e.target.value)}
                          className={`input-tablet ${parseFloat(regularRate) <= 0 ? 'border-destructive' : ''}`}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('employees.regularRateAllIn')} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={regularRateAllIn}
                          onChange={(e) => setRegularRateAllIn(e.target.value)}
                          className={`input-tablet ${parseFloat(regularRateAllIn) <= 0 ? 'border-destructive' : ''}`}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('employees.overtimeRate')} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={overtimeRate}
                          onChange={(e) => setOvertimeRate(e.target.value)}
                          className={`input-tablet ${parseFloat(overtimeRate) <= 0 ? 'border-destructive' : ''}`}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    {!payRatesValid() && (regularRate || regularRateAllIn || overtimeRate) && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t('employees.payRatesInvalid')}
                      </p>
                    )}
                  </div>
                )}

                {/* HR Details Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {t('employees.hrDetails')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('employees.phone')}</Label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input-tablet"
                        placeholder="+30 6XX XXX XXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('employees.hireDate')}</Label>
                      <Input
                        type="text"
                        value={hireDate}
                        onChange={(e) => setHireDate(e.target.value)}
                        className="input-tablet"
                        placeholder="DD/MM/YYYY"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('employees.notes')}</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="input-tablet min-h-[80px]"
                      placeholder={t('employees.notesPlaceholder')}
                    />
                  </div>
                </div>

                {/* Project Access Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {t('employees.projectAccess')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('employees.projectAccessHelp')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                    {projects.filter(p => p.status === 'OPEN').map((project) => (
                      <label
                        key={project.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                          allowedProjects.includes(project.id) 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-muted"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={allowedProjects.includes(project.id)}
                          onChange={() => toggleProject(project.id)}
                          className="rounded"
                        />
                        <span className="text-sm font-mono">{project.project_code}</span>
                        <span className="text-sm truncate">{project.project_name}</span>
                      </label>
                    ))}
                  </div>
                  {allowedProjects.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      {t('employees.allProjectsAllowed')}
                    </p>
                  )}
                </div>

                {/* Payroll & Legal Section - Admin/HR Only, Collapsible */}
                {hasElevatedRole && (
                  <Collapsible 
                    open={payrollSectionOpen} 
                    onOpenChange={setPayrollSectionOpen}
                    className="border-t pt-4"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full text-left"
                      >
                        {payrollSectionOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          {t('employees.payrollLegal')}
                        </h3>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('employees.afm')}</Label>
                          <Input
                            value={afm}
                            onChange={(e) => setAfm(e.target.value)}
                            className="input-tablet"
                            placeholder="123456789"
                            maxLength={9}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('employees.idType')}</Label>
                          <Select value={idType} onValueChange={setIdType}>
                            <SelectTrigger className="input-tablet">
                              <SelectValue placeholder={t('employees.selectIdType')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="id_card">{t('employees.idCard')}</SelectItem>
                              <SelectItem value="passport">{t('employees.passport')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('employees.idNumber')}</Label>
                        <Input
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="input-tablet"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('employees.iban')}</Label>
                          <Input
                            value={iban}
                            onChange={(e) => setIban(e.target.value.toUpperCase())}
                            className="input-tablet font-mono"
                            placeholder="GR12 3456 7890 1234 5678 9012 345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('employees.bankName')}</Label>
                          <Input
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="input-tablet"
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Telegram Link Section - Admin/HR Only, only when editing */}
                {hasElevatedRole && editingEmployee && (
                  <TelegramLinkCard 
                    employeeId={editingEmployee.id} 
                    hasElevatedRole={hasElevatedRole} 
                  />
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1">
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-tablet pl-12"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 input-tablet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="active">{t('common.active')}</SelectItem>
            <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employees Table */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell text-left">{t('employees.code')}</th>
                <th className="table-cell text-left">{t('employees.firstName')}</th>
                <th className="table-cell text-left">{t('employees.lastName')}</th>
                <th className="table-cell text-left">{t('employees.specialty')}</th>
                <th className="table-cell text-left">{t('employees.workSchedule')}</th>
                <th className="table-cell text-left">{t('employees.assignedRecorder')}</th>
                <th className="table-cell text-left">{t('common.status')}</th>
                <th className="table-cell text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="table-row">
                  <td className="table-cell font-mono">{employee.employee_code}</td>
                  <td className="table-cell">{employee.first_name}</td>
                  <td className="table-cell">{employee.last_name}</td>
                  <td className="table-cell">{getSpecialtyName(employee.specialties)}</td>
                  <td className="table-cell font-mono text-sm">
                    {employee.regular_start_time.slice(0, 5)} - {employee.regular_end_time.slice(0, 5)}
                  </td>
                  <td className="table-cell text-sm">{getRecorderName(employee.assigned_user_id)}</td>
                  <td className="table-cell">
                    <button
                      onClick={() => handleQuickStatusToggle(employee)}
                      disabled={!hasElevatedRole}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        'transition-all duration-200',
                        hasElevatedRole && 'cursor-pointer hover:shadow-sm',
                        !hasElevatedRole && 'cursor-not-allowed opacity-70',
                        employee.status === 'active'
                          ? hasElevatedRole 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-green-100 text-green-700'
                          : hasElevatedRole
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-red-100 text-red-700'
                      )}
                      title={hasElevatedRole 
                        ? (language === 'el' 
                            ? `Πατήστε για ${employee.status === 'active' ? 'απενεργοποίηση' : 'ενεργοποίηση'}` 
                            : `Click to ${employee.status === 'active' ? 'deactivate' : 'activate'}`)
                        : (language === 'el' ? 'Δεν έχετε δικαίωμα' : 'No permission')
                      }
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', employee.status === 'active' ? 'bg-green-500' : 'bg-red-500')} />
                      {employee.status === 'active' ? t('common.active') : t('common.inactive')}
                      {hasElevatedRole && <ArrowLeftRight className="h-3 w-3 opacity-60" />}
                    </button>
                  </td>
                  <td className="table-cell text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleArchiveClick(employee)}>
                          <Archive className="h-4 w-4 mr-2" />
                          {employee.status === 'active' 
                            ? t('employees.archive') 
                            : t('employees.restore')
                          }
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(employee)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('employees.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {t('common.noData')}
          </div>
        )}
      </div>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedEmployee?.status === 'active' 
                ? t('employees.archiveConfirmTitle')
                : t('employees.restoreConfirmTitle')
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee?.status === 'active'
                ? `${t('employees.archiveConfirmMessage')} ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}?`
                : `${t('employees.restoreConfirmMessage')} ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm}>
              {selectedEmployee?.status === 'active' 
                ? t('employees.archive') 
                : t('employees.restore')
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('employees.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {checkingDeletability ? (
                <span className="text-muted-foreground">{t('common.loading')}</span>
              ) : canHardDelete ? (
                `${t('employees.deleteConfirmMessage')} ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}?`
              ) : (
                <span className="text-destructive">
                  {t('employees.cannotDeleteMessage')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={!canHardDelete || checkingDeletability}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('employees.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Employee Detection Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'el' ? 'Πιθανό Διπλότυπο Εργαζομένου' : 'Potential Duplicate Employee'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {language === 'el'
                    ? 'Τα παρακάτω στοιχεία ταυτίζονται με υπάρχοντα εργαζόμενο:'
                    : 'The following information matches an existing employee:'}
                </p>
                {duplicateInfo.map((dup: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">{dup.field}: {dup.value}</p>
                      <p className="text-muted-foreground">
                        {language === 'el' ? 'Υπάρχει στον εργαζόμενο' : 'Exists in employee'}:{' '}
                        <span className="font-semibold text-foreground">{dup.employee.first_name} {dup.employee.last_name}</span>{' '}
                        ({dup.employee.employee_code})
                      </p>
                      <p className="text-xs">
                        Status: {dup.employee.status === 'active'
                          ? (language === 'el' ? 'Ενεργός' : 'Active')
                          : (language === 'el' ? 'Ανενεργός' : 'Inactive')}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="text-sm font-medium text-foreground">
                  {language === 'el'
                    ? 'Είστε σίγουροι ότι θέλετε να συνεχίσετε;'
                    : 'Are you sure you want to continue?'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDuplicateCancel}>
              {language === 'el' ? 'Άκυρο' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicateConfirm}>
              {language === 'el' ? 'Ναι, Συνέχεια' : 'Yes, Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
