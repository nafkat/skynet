import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, FolderKanban, ShoppingCart, Megaphone, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface SearchResult {
  id: string;
  type: 'employee' | 'project' | 'request_offer' | 'announcement';
  title: string;
  subtitle: string;
  route: string;
}

export default function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const typeConfig = {
    employee: {
      icon: Users,
      label: language === 'el' ? 'Εργαζόμενος' : 'Employee',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    project: {
      icon: FolderKanban,
      label: language === 'el' ? 'Έργο' : 'Project',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    request_offer: {
      icon: ShoppingCart,
      label: 'RO',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    announcement: {
      icon: Megaphone,
      label: language === 'el' ? 'Ανακοίνωση' : 'Announcement',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
  };

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const ilike = `%${term.trim()}%`;

    try {
      const [employeesRes, projectsRes, rosRes, announcementsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, first_name, last_name, employee_code, status')
          .or(`first_name.ilike.${ilike},last_name.ilike.${ilike},employee_code.ilike.${ilike}`)
          .limit(5),
        supabase
          .from('projects')
          .select('id, project_code, project_name, status')
          .or(`project_name.ilike.${ilike},project_code.ilike.${ilike}`)
          .limit(5),
        supabase
          .from('request_offers')
          .select('id, ro_number, title, status')
          .or(`title.ilike.${ilike},ro_number.ilike.${ilike},description.ilike.${ilike}`)
          .limit(5),
        supabase
          .from('announcements')
          .select('id, title, status')
          .ilike('title', ilike)
          .limit(5),
      ]);

      const mapped: SearchResult[] = [];

      employeesRes.data?.forEach((e) =>
        mapped.push({
          id: e.id,
          type: 'employee',
          title: `${e.first_name} ${e.last_name}`,
          subtitle: `${e.employee_code} · ${e.status}`,
          route: '/employees',
        })
      );

      projectsRes.data?.forEach((p) =>
        mapped.push({
          id: p.id,
          type: 'project',
          title: p.project_name,
          subtitle: `${p.project_code} · ${p.status}`,
          route: '/projects',
        })
      );

      rosRes.data?.forEach((r) =>
        mapped.push({
          id: r.id,
          type: 'request_offer',
          title: r.title,
          subtitle: `${r.ro_number || 'Draft'} · ${r.status}`,
          route: `/procurement/request-offers/${r.id}`,
        })
      );

      announcementsRes.data?.forEach((a) =>
        mapped.push({
          id: a.id,
          type: 'announcement',
          title: a.title,
          subtitle: a.status,
          route: `/announcements/${a.id}`,
        })
      );

      setResults(mapped);
      setIsOpen(mapped.length > 0);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    navigate(result.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            language === 'el'
              ? 'Αναζήτηση εργαζομένων, έργων, ROs, ανακοινώσεων...'
              : 'Search employees, projects, ROs, announcements...'
          }
          className="pl-9 pr-9 h-11 bg-card border-border/60 focus:border-primary/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {results.map((result, idx) => {
            const config = typeConfig[result.type];
            const Icon = config.icon;
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0',
                  idx === selectedIndex && 'bg-accent/50'
                )}
              >
                <div className={cn('flex items-center justify-center w-8 h-8 rounded-md', config.bg)}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                </div>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.color)}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
