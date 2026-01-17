import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Anchor, Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // The recovery link will set a session with the recovery token
      if (session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
      }
    };

    checkSession();

    // Listen for auth state changes (recovery token will trigger SIGNED_IN event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      } else if (event === 'SIGNED_IN' && session) {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  const validatePassword = (): string | null => {
    if (password.length < 8) {
      return language === 'el' 
        ? 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες'
        : 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      return language === 'el'
        ? 'Οι κωδικοί δεν ταιριάζουν'
        : 'Passwords do not match';
    }
    return null;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validatePassword();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          toast.error(
            language === 'el'
              ? 'Ο σύνδεσμος έχει λήξει. Παρακαλώ ζητήστε νέο.'
              : 'Reset link has expired. Please request a new one.'
          );
        } else {
          toast.error(error.message);
        }
      } else {
        setIsSuccess(true);
        toast.success(
          language === 'el'
            ? 'Ο κωδικός άλλαξε επιτυχώς!'
            : 'Password changed successfully!'
        );
        
        // Sign out and redirect to login after a delay
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch (err) {
      toast.error(
        language === 'el'
          ? 'Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά.'
          : 'An error occurred. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">
          {language === 'el' ? 'Φόρτωση...' : 'Loading...'}
        </div>
      </div>
    );
  }

  // Invalid/expired session
  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 right-4"
          onClick={toggleLanguage}
        >
          <Globe className="h-5 w-5" />
        </Button>

        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {language === 'el' ? 'Μη έγκυρος σύνδεσμος' : 'Invalid Link'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {language === 'el'
              ? 'Ο σύνδεσμος επαναφοράς κωδικού δεν είναι έγκυρος ή έχει λήξει.'
              : 'This password reset link is invalid or has expired.'}
          </p>
          <Button onClick={() => navigate('/login')}>
            {language === 'el' ? 'Επιστροφή στη Σύνδεση' : 'Back to Sign In'}
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 text-green-500 mb-4">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {language === 'el' ? 'Επιτυχία!' : 'Success!'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el'
              ? 'Ο κωδικός σας άλλαξε. Μεταφέρεστε στη σύνδεση...'
              : 'Your password has been changed. Redirecting to sign in...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Language toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4"
        onClick={toggleLanguage}
      >
        <Globe className="h-5 w-5" />
      </Button>

      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'el' ? 'Νέος Κωδικός' : 'New Password'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === 'el'
              ? 'Εισάγετε τον νέο σας κωδικό πρόσβασης'
              : 'Enter your new password'}
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="card-elevated p-8">
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {language === 'el' ? 'Νέος Κωδικός' : 'New Password'}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-tablet pr-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'el' ? 'Τουλάχιστον 8 χαρακτήρες' : 'At least 8 characters'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                {language === 'el' ? 'Επιβεβαίωση Κωδικού' : 'Confirm Password'}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-tablet pr-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full btn-tablet"
              disabled={isLoading}
            >
              {isLoading
                ? (language === 'el' ? 'Αποθήκευση...' : 'Saving...')
                : (language === 'el' ? 'Αλλαγή Κωδικού' : 'Change Password')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
