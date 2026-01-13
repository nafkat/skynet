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
import { Plus, Search, Edit2, ChevronDown, ChevronRight, Archive, Trash2, MoreHorizontal } from 'lucide-react';
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
  specialties?: Specialty;
}

interface EmployeeAllowedProject {
  employee_id: string;
  project_id: string;
}

export default function Employees() {
const { t, language } = useLanguage();
  const { hasElevatedRole, isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employeeProjects, setEmployeeProjects] = useState<EmployeeAllowedProject[]>([]);
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

  // Form state - Core
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  
  // Form state - Work Schedule
  const [regularStart, setRegularStart] = useState('07:00');
  const [regularEnd, setRegularEnd] = useState('14:00');
  
  // Form state - Pay Rates (Admin/HR only)
  const [regularRate, setRegularRate] = useState('0');
  const [overtimeRate, setOvertimeRate] = useState('0');
  
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [specialtiesRes, employeesRes, projectsRes, employeeProjectsRes] = await Promise.all([
        supabase.from('specialties').select('*').order('code'),
        supabase.from('employees').select(`*, specialties (id, name_en, name_el, code)`).order('employee_code'),
        supabase.from('projects').select('*').order('project_code'),
        supabase.from('employee_allowed_projects').select('employee_id, project_id'),
      ]);

      setSpecialties(specialtiesRes.data || []);
      setEmployees((employeesRes.data as Employee[]) || []);
      setProjects(projectsRes.data || []);
      setEmployeeProjects(employeeProjectsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setSpecialtyId('');
    setStatus('active');
    setRegularRate('0');
    setOvertimeRate('0');
    setRegularStart('07:00');
    setRegularEnd('14:00');
    setPhone('');
    setHireDate('');
    setNotes('');
    setAllowedProjects([]);
    setAfm('');
    setIdType('');
    setIdNumber('');
    setIban('');
    setBankName('');
    setEditingEmployee(null);
    setPayrollSectionOpen(false);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setFirstName(employee.first_name);
    setLastName(employee.last_name);
    setSpecialtyId(employee.specialty_id);
    setStatus(employee.status);
    setRegularRate(employee.regular_hourly_rate.toString());
    setOvertimeRate(employee.overtime_hourly_rate.toString());
    setRegularStart(employee.regular_start_time.slice(0, 5));
    setRegularEnd(employee.regular_end_time.slice(0, 5));
    setPhone(employee.phone || '');
    setHireDate(employee.hire_date || '');
    setNotes(employee.notes || '');
    setAfm(employee.afm || '');
    setIdType(employee.id_type || '');
    setIdNumber(employee.id_number || '');
    setIban(employee.iban || '');
    setBankName(employee.bank_name || '');
    
    // Load allowed projects for this employee
    const empProjects = employeeProjects
      .filter(ep => ep.employee_id === employee.id)
      .map(ep => ep.project_id);
    setAllowedProjects(empProjects);
    
    setPayrollSectionOpen(false);
    setIsDialogOpen(true);
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

    try {
      // Base employee data - always included
      const employeeData: any = {
        first_name: firstName,
        last_name: lastName,
        specialty_id: specialtyId,
        status,
        regular_start_time: regularStart,
        regular_end_time: regularEnd,
        phone: phone || null,
        hire_date: hireDate || null,
        notes: notes || null,
      };

      // Only include sensitive fields if user has elevated role
      if (hasElevatedRole) {
        employeeData.regular_hourly_rate = parseFloat(regularRate) || 0;
        employeeData.overtime_hourly_rate = parseFloat(overtimeRate) || 0;
        employeeData.afm = afm || null;
        employeeData.id_type = idType || null;
        employeeData.id_number = idNumber || null;
        employeeData.iban = iban || null;
        employeeData.bank_name = bankName || null;
      }

      let employeeId: string;

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        employeeId = editingEmployee.id;
        toast.success(t('employees.updateSuccess'));
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select('id')
          .single();

        if (error) throw error;
        employeeId = data.id;
        toast.success(t('employees.createSuccess'));
      }

      // Update allowed projects - only if Admin (project access is Admin-only)
      if (hasElevatedRole && employeeId) {
        // Delete existing project assignments
        await supabase
          .from('employee_allowed_projects')
          .delete()
          .eq('employee_id', employeeId);

        // Insert new project assignments if any selected
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

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || t('employees.saveError'));
    }
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('employees.regularRate')} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={regularRate}
                          onChange={(e) => setRegularRate(e.target.value)}
                          className="input-tablet"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('employees.overtimeRate')} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={overtimeRate}
                          onChange={(e) => setOvertimeRate(e.target.value)}
                          className="input-tablet"
                          required
                        />
                      </div>
                    </div>
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
                        type="date"
                        value={hireDate}
                        onChange={(e) => setHireDate(e.target.value)}
                        className="input-tablet"
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
                  <td className="table-cell">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                      employee.status === 'active' ? 'badge-active' : 'badge-inactive'
                    )}>
                      {employee.status === 'active' ? t('common.active') : t('common.inactive')}
                    </span>
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
    </MainLayout>
  );
}
