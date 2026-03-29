import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchAPI } from './lib/api';
import { Users, Calendar, MessageSquare, LogIn, LogOut, Menu, X, Shield, Briefcase, Mail, Lock, UserPlus as UserPlusIcon, Settings, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import MembersPage from './pages/MembersPage';
import EventsPage from './pages/EventsPage';
import AdminsPage from './pages/UsersPage';
import JobsPage from './pages/JobsPage';
import StatisticsPage from './pages/StatisticsPage';
import SettingsPage from './pages/SettingsPage';
import PublicEventPage from './pages/PublicEventPage';
import AccountPage from './pages/AccountPage';
import { UserProfile, GuildSettings } from './types';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [guildSettings, setGuildSettings] = useState<GuildSettings>({
    name: 'MadMonkeys',
    subtitle: 'Guild Management System',
    timezone: 'GMT+8 (Singapore/Manila)',
    logoUrl: '',
  });

  const loadSettings = async () => {
    try {
      const data = await fetchAPI('/api/settings');
      setGuildSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const username = (formData.get('username') as string).toLowerCase();
    const password = formData.get('password') as string;

    try {
      const data = await fetchAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const username = (formData.get('username') as string).toLowerCase();
    const password = formData.get('password') as string;

    try {
      const data = await fetchAPI('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const AuthUI = () => (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
            {guildSettings.logoUrl ? (
              <img src={guildSettings.logoUrl} alt={guildSettings.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Users className="w-8 h-8 text-orange-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{guildSettings.name}</h1>
          <p className="text-zinc-400 text-sm">{guildSettings.subtitle}</p>
        </div>

        <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">IGN (Username)</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                required
                name="username"
                type="text"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                placeholder="Your In-Game Name"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                required
                name="password"
                type="password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-zinc-500">
          {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="text-orange-500 font-bold hover:underline"
          >
            {authMode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <Router>
      <Routes>
        <Route path="/public/event/:eventId" element={<PublicEventPage />} />
        <Route path="*" element={
          !user ? <AuthUI /> : (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
              {/* Mobile Nav */}
              <div className="md:hidden bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center overflow-hidden">
                    {guildSettings.logoUrl ? (
                      <img src={guildSettings.logoUrl} alt={guildSettings.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="font-bold text-white">{guildSettings.name.charAt(0)}</span>
                    )}
                  </div>
                  <span className="font-bold text-lg">{guildSettings.name}</span>
                </div>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-zinc-400">
                  {isMenuOpen ? <X /> : <Menu />}
                </button>
              </div>

              {/* Sidebar */}
              <AnimatePresence>
                {(isMenuOpen || window.innerWidth >= 768) && (
                  <motion.aside
                    initial={{ x: -300 }}
                    animate={{ x: 0 }}
                    exit={{ x: -300 }}
                    className={cn(
                      "fixed md:relative inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40 transition-all",
                      !isMenuOpen && "hidden md:flex"
                    )}
                  >
                    <div className="p-6 hidden md:flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 overflow-hidden">
                        {guildSettings.logoUrl ? (
                          <img src={guildSettings.logoUrl} alt={guildSettings.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="font-bold text-white text-xl">{guildSettings.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <h2 className="font-bold text-white leading-tight">{guildSettings.name}</h2>
                        <p className="text-xs text-zinc-500">{guildSettings.subtitle}</p>
                      </div>
                    </div>

                    <nav className="flex-1 px-4 py-4 space-y-1">
                      <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all group">
                        <Users className="w-5 h-5 group-hover:text-orange-500 transition-colors" />
                        <span className="font-medium">Guild Members</span>
                      </Link>
                      <Link to="/events" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all group">
                        <Calendar className="w-5 h-5 group-hover:text-orange-500 transition-colors" />
                        <span className="font-medium">Guild Events</span>
                      </Link>
                      <Link to="/jobs" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all group">
                        <Briefcase className="w-5 h-5 group-hover:text-orange-500 transition-colors" />
                        <span className="font-medium">Job Classes</span>
                      </Link>
                      <Link to="/statistics" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all group">
                        <BarChart3 className="w-5 h-5 group-hover:text-orange-500 transition-colors" />
                        <span className="font-medium">Statistics</span>
                      </Link>
                      {isAdmin && (
                        <>
                          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Administration</div>
                          <Link to="/admins" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all group">
                            <Shield className="w-5 h-5 group-hover:text-orange-500 transition-colors" />
                            <span className="font-medium">User Management</span>
                          </Link>
                          <Link to="/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all group">
                            <Settings className="w-5 h-5 group-hover:text-orange-500 transition-colors" />
                            <span className="font-medium">Guild Settings</span>
                          </Link>
                        </>
                      )}
                    </nav>

                    <div className="p-4 border-t border-zinc-800">
                      <Link 
                        to="/account" 
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 mb-2 hover:bg-zinc-800 rounded-xl transition-all group"
                      >
                        <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-orange-500 border border-zinc-700 group-hover:border-orange-500/50 transition-colors">
                          {user.displayName?.charAt(0) || user.username?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate group-hover:text-orange-500 transition-colors">{user.displayName || 'User'}</p>
                          <p className="text-[10px] text-zinc-500 truncate uppercase tracking-wider">{user.role}</p>
                        </div>
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all group"
                      >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              {/* Main Content */}
              <main className="flex-1 overflow-auto p-4 md:p-8">
                <Routes>
                  <Route path="/" element={<MembersPage isAdmin={isAdmin} />} />
                  <Route path="/events" element={<EventsPage isAdmin={isAdmin} />} />
                  <Route path="/jobs" element={<JobsPage isAdmin={isAdmin} />} />
                  <Route path="/statistics" element={<StatisticsPage isAdmin={isAdmin} />} />
                  <Route path="/account" element={<AccountPage user={user} onUpdateUser={setUser} onLogout={handleLogout} />} />
                  {isAdmin && (
                    <>
                      <Route path="/admins" element={<AdminsPage isSuperAdmin={user?.role === 'superadmin'} />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          )
        } />
      </Routes>
    </Router>
  );
}
