import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'el';

interface Translations {
  [key: string]: {
    en: string;
    el: string;
  };
}

export const translations: Translations = {
  // Auth
  'auth.login': { en: 'Sign In', el: 'Σύνδεση' },
  'auth.logout': { en: 'Sign Out', el: 'Αποσύνδεση' },
  'auth.email': { en: 'Email', el: 'Email' },
  'auth.password': { en: 'Password', el: 'Κωδικός' },
  'auth.signIn': { en: 'Sign In', el: 'Είσοδος' },
  'auth.signUp': { en: 'Sign Up', el: 'Εγγραφή' },
  'auth.signingIn': { en: 'Signing in...', el: 'Σύνδεση...' },
  'auth.invalidCredentials': { en: 'Invalid credentials', el: 'Λάθος στοιχεία' },
  'auth.welcome': { en: 'Welcome back', el: 'Καλώς ήρθατε' },
  'auth.accountCreated': { en: 'Account created! You can now sign in.', el: 'Ο λογαριασμός δημιουργήθηκε! Μπορείτε να συνδεθείτε.' },
  'auth.shipyardSystem': { en: 'Shipyard Time Tracking', el: 'Ναυπηγείο - Καταγραφή Χρόνου' },
  
  // Navigation
  'nav.dashboard': { en: 'Dashboard', el: 'Πίνακας' },
  'nav.timeEntry': { en: 'Time Entry', el: 'Καταγραφή Χρόνου' },
  'nav.employees': { en: 'Employees', el: 'Εργαζόμενοι' },
  'nav.projects': { en: 'Projects', el: 'Έργα' },
  'nav.specialties': { en: 'Specialties', el: 'Ειδικότητες' },
  'nav.reports': { en: 'Reports', el: 'Αναφορές' },
  'nav.settings': { en: 'Settings', el: 'Ρυθμίσεις' },
  'nav.corrections': { en: 'Corrections', el: 'Διορθώσεις' },
  
  // Common
  'common.save': { en: 'Save', el: 'Αποθήκευση' },
  'common.cancel': { en: 'Cancel', el: 'Ακύρωση' },
  'common.delete': { en: 'Delete', el: 'Διαγραφή' },
  'common.edit': { en: 'Edit', el: 'Επεξεργασία' },
  'common.add': { en: 'Add', el: 'Προσθήκη' },
  'common.search': { en: 'Search', el: 'Αναζήτηση' },
  'common.filter': { en: 'Filter', el: 'Φίλτρο' },
  'common.export': { en: 'Export', el: 'Εξαγωγή' },
  'common.loading': { en: 'Loading...', el: 'Φόρτωση...' },
  'common.noData': { en: 'No data', el: 'Δεν υπάρχουν δεδομένα' },
  'common.status': { en: 'Status', el: 'Κατάσταση' },
  'common.actions': { en: 'Actions', el: 'Ενέργειες' },
  'common.active': { en: 'Active', el: 'Ενεργός' },
  'common.inactive': { en: 'Inactive', el: 'Ανενεργός' },
  'common.open': { en: 'Open', el: 'Ανοιχτό' },
  'common.closed': { en: 'Closed', el: 'Κλειστό' },
  'common.all': { en: 'All', el: 'Όλα' },
  'common.from': { en: 'From', el: 'Από' },
  'common.to': { en: 'To', el: 'Έως' },
  'common.date': { en: 'Date', el: 'Ημερομηνία' },
  'common.time': { en: 'Time', el: 'Ώρα' },
  'common.hours': { en: 'Hours', el: 'Ώρες' },
  'common.minutes': { en: 'Minutes', el: 'Λεπτά' },
  'common.total': { en: 'Total', el: 'Σύνολο' },
  'common.today': { en: 'Today', el: 'Σήμερα' },
  'common.thisWeek': { en: 'This Week', el: 'Αυτή την Εβδομάδα' },
  'common.thisMonth': { en: 'This Month', el: 'Αυτό τον Μήνα' },
  'common.fillRequired': { en: 'Please fill in all required fields', el: 'Συμπληρώστε όλα τα υποχρεωτικά πεδία' },
  'common.error': { en: 'An error occurred', el: 'Προέκυψε σφάλμα' },
  'common.refresh': { en: 'Refresh', el: 'Ανανέωση' },
  'common.lastRefresh': { en: 'Last refresh', el: 'Τελευταία ανανέωση' },
  'common.refreshFailed': { en: 'Refresh failed. Please try again.', el: 'Η ανανέωση απέτυχε. Παρακαλώ δοκιμάστε ξανά.' },
  
  // Time Entry
  'timeEntry.title': { en: 'Time Registration', el: 'Καταγραφή Χρόνου' },
  'timeEntry.selectEmployee': { en: 'Select Employee', el: 'Επιλογή Εργαζομένου' },
  'timeEntry.selectProject': { en: 'Select Project', el: 'Επιλογή Έργου' },
  'timeEntry.startTime': { en: 'Start Time', el: 'Ώρα Έναρξης' },
  'timeEntry.endTime': { en: 'End Time', el: 'Ώρα Λήξης' },
  'timeEntry.register': { en: 'Register Time', el: 'Καταχώρηση' },
  'timeEntry.success': { en: 'Time registered successfully', el: 'Επιτυχής καταχώρηση' },
  'timeEntry.recentEntries': { en: 'Recent Entries', el: 'Πρόσφατες Καταχωρήσεις' },
  'timeEntry.regular': { en: 'Regular', el: 'Κανονικές' },
  'timeEntry.overtime': { en: 'Overtime', el: 'Υπερωρίες' },
  'timeEntry.requestCorrection': { en: 'Request Correction', el: 'Αίτηση Διόρθωσης' },
  'timeEntry.editEntry': { en: 'Edit Entry', el: 'Επεξεργασία Καταχώρησης' },
  'timeEntry.editingEntry': { en: 'Editing entry', el: 'Επεξεργασία καταχώρησης' },
  'timeEntry.entryLoadedForEditing': { en: 'Entry loaded for editing', el: 'Η καταχώρηση φορτώθηκε για επεξεργασία' },
  'timeEntry.saveChanges': { en: 'Save Changes', el: 'Αποθήκευση Αλλαγών' },
  'timeEntry.cancelEdit': { en: 'Cancel Edit', el: 'Ακύρωση Επεξεργασίας' },
  'timeEntry.changesSaved': { en: 'Changes saved successfully', el: 'Οι αλλαγές αποθηκεύτηκαν' },
  'timeEntry.correctionSubmitted': { en: 'Correction request submitted', el: 'Η αίτηση διόρθωσης υποβλήθηκε' },
  'timeEntry.correctionReason': { en: 'Reason for correction', el: 'Λόγος διόρθωσης' },
  'timeEntry.correctionReasonPlaceholder': { en: 'Explain why this entry needs to be corrected...', el: 'Εξηγήστε γιατί χρειάζεται διόρθωση αυτή η καταχώρηση...' },
  'timeEntry.reasonRequired': { en: 'Please provide a reason for the correction', el: 'Παρακαλώ δώστε αιτιολογία για τη διόρθωση' },
  'timeEntry.employeeReadOnly': { en: 'Employee cannot be changed when editing', el: 'Ο εργαζόμενος δεν μπορεί να αλλάξει κατά την επεξεργασία' },
  'timeEntry.endAfterStart': { en: 'End time must be after start time', el: 'Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης' },
  
  // Employees
  'employees.title': { en: 'Employees', el: 'Εργαζόμενοι' },
  'employees.addNew': { en: 'Add Employee', el: 'Νέος Εργαζόμενος' },
  'employees.code': { en: 'Code', el: 'Κωδικός' },
  'employees.firstName': { en: 'First Name', el: 'Όνομα' },
  'employees.lastName': { en: 'Last Name', el: 'Επώνυμο' },
  'employees.specialty': { en: 'Specialty', el: 'Ειδικότητα' },
  'employees.regularRate': { en: 'Regular Rate (€/hr)', el: 'Κανονική Αμοιβή (€/ώρα)' },
  'employees.overtimeRate': { en: 'Overtime Rate (€/hr)', el: 'Αμοιβή Υπερωρίας (€/ώρα)' },
  'employees.workSchedule': { en: 'Work Schedule', el: 'Ωράριο Εργασίας' },
  'employees.coreInfo': { en: 'Employee Information', el: 'Στοιχεία Εργαζομένου' },
  'employees.startTime': { en: 'Start Time', el: 'Ώρα Έναρξης' },
  'employees.endTime': { en: 'End Time', el: 'Ώρα Λήξης' },
  'employees.payRates': { en: 'Pay Rates', el: 'Αμοιβές' },
  'employees.hrDetails': { en: 'HR Details', el: 'Στοιχεία HR' },
  'employees.phone': { en: 'Phone', el: 'Τηλέφωνο' },
  'employees.hireDate': { en: 'Hire Date', el: 'Ημ/νία Πρόσληψης' },
  'employees.notes': { en: 'Notes', el: 'Σημειώσεις' },
  'employees.notesPlaceholder': { en: 'Additional notes about this employee...', el: 'Επιπλέον σημειώσεις για τον εργαζόμενο...' },
  'employees.projectAccess': { en: 'Project Access Control', el: 'Έλεγχος Πρόσβασης Έργων' },
  'employees.projectAccessHelp': { en: 'Select projects this employee can log time to. Leave empty to allow all projects.', el: 'Επιλέξτε έργα στα οποία μπορεί να καταχωρεί χρόνο ο εργαζόμενος. Αφήστε κενό για όλα.' },
  'employees.allProjectsAllowed': { en: 'No restrictions - employee can log time to all projects', el: 'Χωρίς περιορισμούς - ο εργαζόμενος μπορεί να καταχωρεί σε όλα τα έργα' },
  'employees.payrollLegal': { en: 'Payroll & Legal Information', el: 'Μισθοδοσία & Νομικά Στοιχεία' },
  'employees.afm': { en: 'Tax Number (AFM)', el: 'ΑΦΜ' },
  'employees.idType': { en: 'ID Type', el: 'Τύπος Ταυτότητας' },
  'employees.selectIdType': { en: 'Select ID type', el: 'Επιλέξτε τύπο' },
  'employees.idCard': { en: 'ID Card', el: 'Ταυτότητα' },
  'employees.passport': { en: 'Passport', el: 'Διαβατήριο' },
  'employees.idNumber': { en: 'ID Number', el: 'Αριθμός Ταυτότητας' },
  'employees.iban': { en: 'IBAN', el: 'IBAN' },
  'employees.bankName': { en: 'Bank Name', el: 'Όνομα Τράπεζας' },
  'employees.requiredFields': { en: 'Please fill in all required fields', el: 'Συμπληρώστε όλα τα υποχρεωτικά πεδία' },
  'employees.scheduleRequired': { en: 'Work schedule times are required', el: 'Οι ώρες εργασίας είναι υποχρεωτικές' },
  'employees.updateSuccess': { en: 'Employee updated successfully', el: 'Ο εργαζόμενος ενημερώθηκε' },
  'employees.createSuccess': { en: 'Employee created successfully', el: 'Ο εργαζόμενος δημιουργήθηκε' },
  'employees.saveError': { en: 'Error saving employee', el: 'Σφάλμα αποθήκευσης εργαζομένου' },
  'employees.archive': { en: 'Archive', el: 'Αρχειοθέτηση' },
  'employees.restore': { en: 'Restore', el: 'Επαναφορά' },
  'employees.delete': { en: 'Delete', el: 'Διαγραφή' },
  'employees.archiveConfirmTitle': { en: 'Archive Employee', el: 'Αρχειοθέτηση Εργαζομένου' },
  'employees.restoreConfirmTitle': { en: 'Restore Employee', el: 'Επαναφορά Εργαζομένου' },
  'employees.archiveConfirmMessage': { en: 'Are you sure you want to archive', el: 'Είστε σίγουροι ότι θέλετε να αρχειοθετήσετε τον/την' },
  'employees.restoreConfirmMessage': { en: 'Are you sure you want to restore', el: 'Είστε σίγουροι ότι θέλετε να επαναφέρετε τον/την' },
  'employees.deleteConfirmTitle': { en: 'Delete Employee', el: 'Διαγραφή Εργαζομένου' },
  'employees.deleteConfirmMessage': { en: 'This action cannot be undone. Are you sure you want to permanently delete', el: 'Αυτή η ενέργεια δεν μπορεί να αναιρεθεί. Θέλετε να διαγράψετε οριστικά τον/την' },
  'employees.cannotDeleteMessage': { en: 'Cannot delete employee because work history exists. Use Archive instead.', el: 'Δεν είναι δυνατή η διαγραφή εργαζομένου επειδή υπάρχει ιστορικό εργασίας. Χρησιμοποιήστε την Αρχειοθέτηση.' },
  'employees.archiveSuccess': { en: 'Employee archived successfully', el: 'Ο εργαζόμενος αρχειοθετήθηκε' },
  'employees.restoreSuccess': { en: 'Employee restored successfully', el: 'Ο εργαζόμενος επανήλθε' },
  'employees.archiveError': { en: 'Error archiving employee', el: 'Σφάλμα αρχειοθέτησης εργαζομένου' },
  'employees.deleteSuccess': { en: 'Employee deleted successfully', el: 'Ο εργαζόμενος διαγράφηκε' },
  'employees.deleteError': { en: 'Error deleting employee', el: 'Σφάλμα διαγραφής εργαζομένου' },
  
  // Projects
  'projects.title': { en: 'Projects', el: 'Έργα' },
  'projects.addNew': { en: 'Add Project', el: 'Νέο Έργο' },
  'projects.code': { en: 'Project Code', el: 'Κωδικός Έργου' },
  'projects.name': { en: 'Project Name', el: 'Όνομα Έργου' },
  'projects.namePlaceholder': { en: 'Enter project name', el: 'Εισάγετε όνομα έργου' },
  'projects.customerCompanyName': { en: 'Customer / Company Name', el: 'Πελάτης / Επωνυμία' },
  'projects.customerCompanyNamePlaceholder': { en: 'Enter customer or company name', el: 'Εισάγετε όνομα πελάτη ή εταιρείας' },
  'projects.customerCompanyAfm': { en: 'Customer Tax Number (AFM)', el: 'ΑΦΜ Πελάτη' },
  'projects.afmHint': { en: '9 digits for Greek AFM', el: '9 ψηφία για ελληνικό ΑΦΜ' },
  'projects.invalidAfm': { en: 'Invalid AFM format (must be 9 digits)', el: 'Μη έγκυρη μορφή ΑΦΜ (πρέπει να είναι 9 ψηφία)' },
  'projects.assignedShipyardCompany': { en: 'Assigned Shipyard Company', el: 'Εταιρεία Ναυπηγείου' },
  'projects.assignedShipyardCompanyPlaceholder': { en: 'Enter internal shipyard company', el: 'Εισάγετε εταιρεία ναυπηγείου' },
  'projects.assignedTo': { en: 'Assigned to', el: 'Ανατέθηκε σε' },
  'projects.codeAutoGenerated': { en: 'Code is auto-generated', el: 'Ο κωδικός δημιουργείται αυτόματα' },
  'projects.updated': { en: 'Project updated successfully', el: 'Το έργο ενημερώθηκε' },
  'projects.created': { en: 'Project created successfully', el: 'Το έργο δημιουργήθηκε' },
  
  // Specialties
  'specialties.title': { en: 'Specialties', el: 'Ειδικότητες' },
  'specialties.addNew': { en: 'Add Specialty', el: 'Νέα Ειδικότητα' },
  'specialties.nameEn': { en: 'Name (English)', el: 'Όνομα (Αγγλικά)' },
  'specialties.nameEl': { en: 'Name (Greek)', el: 'Όνομα (Ελληνικά)' },
  'specialties.code': { en: 'Code (4 letters)', el: 'Κωδικός (4 γράμματα)' },
  
  // Reports
  'reports.title': { en: 'Reports', el: 'Αναφορές' },
  'reports.dateRange': { en: 'Date Range', el: 'Εύρος Ημερομηνιών' },
  'reports.regularHours': { en: 'Regular Hours', el: 'Κανονικές Ώρες' },
  'reports.overtimeHours': { en: 'Overtime Hours', el: 'Ώρες Υπερωρίας' },
  'reports.totalPayroll': { en: 'Total Payroll', el: 'Συνολική Μισθοδοσία' },
  'reports.laborCost': { en: 'Labor Cost', el: 'Κόστος Εργασίας' },
  'reports.generate': { en: 'Generate Report', el: 'Δημιουργία Αναφοράς' },
  'reports.exportCSV': { en: 'Export CSV', el: 'Εξαγωγή CSV' },
  'reports.exportExcel': { en: 'Export Excel', el: 'Εξαγωγή Excel' },
  
  // Dashboard
  'dashboard.welcome': { en: 'Welcome', el: 'Καλώς ήρθατε' },
  'dashboard.todayEntries': { en: "Today's Entries", el: 'Σημερινές Καταχωρήσεις' },
  'dashboard.pendingCorrections': { en: 'Pending Corrections', el: 'Εκκρεμείς Διορθώσεις' },
  'dashboard.activeEmployees': { en: 'Active Employees', el: 'Ενεργοί Εργαζόμενοι' },
  'dashboard.openProjects': { en: 'Open Projects', el: 'Ανοιχτά Έργα' },
  'dashboard.weeklyOverview': { en: 'Weekly Overview', el: 'Εβδομαδιαία Επισκόπηση' },
  
  // Roles
  'role.admin': { en: 'Administrator', el: 'Διαχειριστής' },
  'role.hr': { en: 'Human Resources', el: 'Ανθρώπινο Δυναμικό' },
  'role.timekeeper': { en: 'Timekeeper', el: 'Χρονομέτρης' },
  
  // Corrections
  'corrections.title': { en: 'Correction Requests', el: 'Αιτήσεις Διόρθωσης' },
  'corrections.reason': { en: 'Reason', el: 'Αιτιολογία' },
  'corrections.newTime': { en: 'New Time', el: 'Νέα Ώρα' },
  'corrections.approve': { en: 'Approve', el: 'Έγκριση' },
  'corrections.reject': { en: 'Reject', el: 'Απόρριψη' },
  'corrections.pending': { en: 'Pending', el: 'Εκκρεμής' },
  'corrections.approved': { en: 'Approved', el: 'Εγκρίθηκε' },
  'corrections.rejected': { en: 'Rejected', el: 'Απορρίφθηκε' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('preferred_language') as Language;
    if (saved && (saved === 'en' || saved === 'el')) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred_language', lang);
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
