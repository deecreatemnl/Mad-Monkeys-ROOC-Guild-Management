import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Database, CheckCircle2, Loader2, Server, AlertTriangle } from 'lucide-react';
import { fetchAPI } from '../lib/api';
import { cn } from '../lib/utils';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [envStatus, setEnvStatus] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    guildName: '',
    guildSubtitle: '',
  });

  // Fetch env status on mount
  useEffect(() => {
    fetchAPI('/api/health').then(data => setEnvStatus(data.env)).catch(console.error);
  }, []);

  const handleNext = () => {
    if (step === 2 && !formData.guildName) {
      setError('Guild Name is required');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await fetchAPI('/api/setup/init', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          displayName: formData.displayName,
          password: formData.password,
          guildName: formData.guildName,
          guildSubtitle: formData.guildSubtitle
        })
      });
      setStep(4);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize system');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl relative z-10 shadow-2xl"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 border border-red-500/20">
            <Shield className="w-8 h-8" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">System Setup</h1>
        
        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`h-1.5 w-12 rounded-full ${step >= 1 ? 'bg-red-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 w-12 rounded-full ${step >= 2 ? 'bg-red-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 w-12 rounded-full ${step >= 3 ? 'bg-red-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 w-12 rounded-full ${step >= 4 ? 'bg-red-500' : 'bg-zinc-800'}`} />
        </div>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-lg font-medium text-white">Welcome to Guild Manager</h2>
              <p className="text-sm text-zinc-400">
                It looks like this is a fresh installation. Let's get your system configured.
              </p>
            </div>

            <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 space-y-3">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">Database Connection</p>
                    {envStatus && (
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", envStatus.hasSupabase ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                        {envStatus.hasSupabase ? 'Supabase Connected' : 'Supabase Missing'}
                      </span>
                    )}
                  </div>
                  {!envStatus?.hasSupabase ? (
                    <p className="text-xs text-red-500 mt-1 font-medium">Supabase is required for this installation. Please configure your environment variables.</p>
                  ) : (
                    <div className="space-y-1 mt-1">
                      <p className="text-xs text-zinc-500">Supabase connection verified.</p>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", envStatus.hasDatabaseUrl ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20")}>
                          {envStatus.hasDatabaseUrl ? 'Auto-Migration Ready' : 'Manual SQL Required'}
                        </span>
                        <p className="text-[10px] text-zinc-500">
                          {envStatus.hasDatabaseUrl 
                            ? 'Database connection URL detected. Tables will sync automatically.' 
                            : 'Connection URL missing (DATABASE_URL or POSTGRES_URL). You must run schema.sql manually.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-green-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">Environment Variables</p>
                    {envStatus && (
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", envStatus.nodeEnv === 'production' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-500/10 text-zinc-400")}>
                        {envStatus.nodeEnv || 'development'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Verify your .env file is properly configured with your deployment credentials.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!envStatus?.hasSupabase}
              className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!envStatus?.hasSupabase ? 'Configure Supabase to Continue' : 'Continue to Setup'}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-lg font-medium text-white">Create Superadmin</h2>
              <p className="text-sm text-zinc-400">
                This account will have full control over the system.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm text-center border border-red-500/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Display Name</label>
              <input
                type="text"
                required
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                placeholder="System Admin"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handleNext}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mt-6"
            >
              Continue
            </button>
          </motion.form>
        )}

        {step === 3 && (
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-lg font-medium text-white">Guild Settings</h2>
              <p className="text-sm text-zinc-400">
                Configure your guild's identity.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm text-center border border-red-500/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Guild Name</label>
              <input
                type="text"
                required
                value={formData.guildName}
                onChange={e => setFormData({ ...formData, guildName: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                placeholder="My Awesome Guild"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Guild Subtitle</label>
              <input
                type="text"
                value={formData.guildSubtitle}
                onChange={e => setFormData({ ...formData, guildSubtitle: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                placeholder="The best guild in the world"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Complete Setup'
              )}
            </button>
          </motion.form>
        )}

        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-8"
          >
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
              <p className="text-zinc-400">Redirecting to login...</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
