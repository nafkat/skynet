import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Anchor, Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function SetupAccount() {
  const { language, setLanguage } = useLanguage();
  const { user, refreshSetupStatus, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string) || ''
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const el = language === 'el';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error(el ? 'Συμπληρώστε το ονοματεπώνυμό σας' : 'Please enter your full name');
      return;
    }
    if (password.length < 8) {
      toast.error(
        el ? 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες' : 'Password must be at least 8 characters'
      );
      return;
    }
    if (password !== confirmPassword) {
      toast.error(el ? 'Οι κωδικοί δεν ταιριάζουν' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim() },
      });
      if (pwError) {
        toast.error(pwError.message);
        return;
      }

      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            display_name: fullName.trim(),
            setup_completed: true,
          })
          .eq('user_id', user.id);

        if (profileError) {
          toast.error(profileError.message);
          return;
        }
      }

      await refreshSetupStatus();
      toast.success(el ? 'Ο λογαριασμός σας ρυθμίστηκε!' : 'Your account is ready!');
      navigate('/home', { replace: true });
    } catch {
      toast.error(el ? 'Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά.' : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4"
        onClick={() => setLanguage(el ? 'en' : 'el')}
      >
        <Globe className="h-5 w-5" />
      </Button>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Anchor className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {el ? 'Ρύθμιση Λογαριασμού' : 'Account Setup'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {el
              ? 'Ορίστε το όνομά σας και τον προσωπικό σας κωδικό για να συνεχίσετε.'
              : 'Set your name and a personal password to continue.'}
          </p>
          {user?.email && (
            <p className="text-sm font-medium mt-2">{user.email}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="fullName">{el ? 'Ονοματεπώνυμο' : 'Full name'}</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-9"
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{el ? 'Νέος κωδικός' : 'New password'}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{el ? 'Επιβεβαίωση κωδικού' : 'Confirm password'}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? el ? 'Αποθήκευση...' : 'Saving...'
              : el ? 'Ολοκλήρωση ρύθμισης' : 'Complete setup'}
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
            {el ? 'Αποσύνδεση' : 'Sign out'}
          </Button>
        </form>
      </div>
    </div>
  );
}
