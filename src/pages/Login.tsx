import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Globe, Anchor, Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { t, language, setLanguage } = useLanguage();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(t('auth.invalidCredentials'));
    } else {
      toast.success(t('auth.welcome'));
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotEmail.trim()) {
      toast.error(language === 'el' ? 'Εισάγετε email' : 'Please enter an email');
      return;
    }
    
    setIsSendingReset(true);
    
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: redirectUrl,
      });
      
      if (error) {
        // Don't reveal if email exists or not
        console.error('Reset password error:', error);
      }
      
      // Always show success message to prevent user enumeration
      toast.success(
        language === 'el'
          ? 'Αν το email υπάρχει, θα λάβετε οδηγίες επαναφοράς.'
          : 'If the email exists, you will receive reset instructions.'
      );
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err) {
      toast.error(
        language === 'el'
          ? 'Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά.'
          : 'An error occurred. Please try again.'
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

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
            <Anchor className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            SKYNET
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === 'el' ? 'Σύνδεση Admin / HR / Timekeeper' : 'Admin / HR / Timekeeper Sign In'}
          </p>
        </div>

        {/* Login Form */}
        <div className="card-elevated p-8">
          <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t('auth.email')}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-tablet"
                placeholder="name@shipyard.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {t('auth.password')}
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
                  autoComplete="current-password"
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
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotPassword(true);
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
              >
                {language === 'el' ? 'Ξεχάσατε τον κωδικό;' : 'Forgot Password?'}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full btn-tablet"
              disabled={isLoading}
            >
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {language === 'el' ? 'Επαναφορά Κωδικού' : 'Reset Password'}
            </DialogTitle>
            <DialogDescription>
              {language === 'el'
                ? 'Εισάγετε το email σας και θα σας στείλουμε οδηγίες επαναφοράς.'
                : 'Enter your email and we will send you reset instructions.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="name@shipyard.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
              >
                {language === 'el' ? 'Ακύρωση' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSendingReset}>
                {isSendingReset
                  ? (language === 'el' ? 'Αποστολή...' : 'Sending...')
                  : (language === 'el' ? 'Αποστολή' : 'Send')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
