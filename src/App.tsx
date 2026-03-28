/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Users, Calendar, MessageSquare, LogIn, LogOut, Menu, X, Shield, Briefcase, Mail, Lock, UserPlus as UserPlusIcon, Settings, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MembersPage from './pages/MembersPage';
import EventsPage from './pages/EventsPage';
import AdminsPage from './pages/UsersPage';
import JobsPage from './pages/JobsPage';
import StatisticsPage from './pages/StatisticsPage';
import SettingsPage from './pages/SettingsPage';
import PublicEventPage from './pages/PublicEventPage';
import { UserProfile, GuildSettings } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [guildSettings, setGuildSettings] = useState<GuildSettings>({
    name: 'Mad Monkeys',
    subtitle: 'Guild Management System',
    timezone: 'GMT+8 (Singapore/Manila)',
    logoUrl: '',
  });

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'guild_settings');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setGuildSettings({ id: docSnap.id, ...docSnap.data() } as GuildSettings);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() && user.email) {
          // Check if there's a pending admin doc with this email
          const emailId = user.email.toLowerCase().trim();
          const emailRef = doc(db, 'users', emailId);
          const emailSnap = await getDoc(emailRef);
          
          if (emailSnap.exists()) {
            const pendingData = emailSnap.data();
            console.log("Found pending authorization for:", emailId);
            
            const profile: UserProfile = {
              id: user.uid,
              email: user.email,
              displayName: pendingData.displayName || user.displayName || user.email.split('@')[0],
              role: pendingData.role || 'user',
              createdAt: pendingData.createdAt || new Date().toISOString(),
              authUid: user.uid,
              isPreAuthorized: false // No longer pending
            };
            
            try {
              await setDoc(userRef, profile);
              await deleteDoc(emailRef);
              userSnap = await getDoc(userRef);
              console.log("Successfully converted pending authorization to user profile");
            } catch (err) {
              console.error("Error converting pending authorization:", err);
            }
          }
        }

        if (userSnap.exists()) {
          const profile = userSnap.data() as UserProfile;
          if (user.email === 'darren@createmnl.com' && profile.role !== 'superadmin') {
            await updateDoc(userRef, { role: 'superadmin' });
            setUserProfile({ ...profile, role: 'superadmin' });
          } else {
            setUserProfile({ id: userSnap.id, ...profile });
          }
        } else {
          // If profile doesn't exist and no pending admin, create standard profile
          const profile: UserProfile = {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            role: user.email === 'darren@createmnl.com' ? 'superadmin' : 'user',
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, profile);
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = user?.email === 'darren@createmnl.com' || userProfile?.role === 'superadmin';
  const isAdmin = isSuperAdmin || userProfile?.role === 'admin';

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google login failed:', error);
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      throw error;
    }
  };

  const handleEmailSignUp = async (email: string, pass: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email,
        displayName: name,
        role: 'user',
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/public/event/:eventId" element={<PublicEventPage />} />
        <Route path="*" element={<AuthenticatedApp user={user} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} guildSettings={guildSettings} handleGoogleLogin={handleGoogleLogin} handleEmailLogin={handleEmailLogin} handleEmailSignUp={handleEmailSignUp} handleLogout={handleLogout} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />} />
      </Routes>
    </Router>
  );
}

function AuthenticatedApp({ user, isAdmin, isSuperAdmin, guildSettings, handleGoogleLogin, handleEmailLogin, handleEmailSignUp, handleLogout, isMenuOpen, setIsMenuOpen }: any) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  if (!user) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setAuthLoading(true);
      try {
        if (authMode === 'login') {
          await handleEmailLogin(email, password);
        } else {
          await handleEmailSignUp(email, password, name);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setAuthLoading(false);
      }
    };

    return (
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Display Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                    placeholder="Your IGN"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

            <button
              disabled={authLoading}
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
            >
              {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-900 px-2 text-zinc-500">Or continue with</span></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
            Google Account
          </button>

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
  }

  return (
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

            <nav className="flex-1 px-4 py-4 space-y-2">
              <NavLink to="/members" icon={<Users className="w-5 h-5" />} label="Members" onClick={() => setIsMenuOpen(false)} />
              <NavLink to="/events" icon={<Calendar className="w-5 h-5" />} label="Events" onClick={() => setIsMenuOpen(false)} />
              <NavLink to="/statistics" icon={<BarChart3 className="w-5 h-5" />} label="Statistics" onClick={() => setIsMenuOpen(false)} />
              {isAdmin && (
                <>
                  <div className="pt-4 pb-2 px-3 border-t border-zinc-800/50 mt-4">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Admin</span>
                  </div>
                  <NavLink to="/users" icon={<Shield className="w-5 h-5" />} label="Users" onClick={() => setIsMenuOpen(false)} />
                  <NavLink to="/jobs" icon={<Briefcase className="w-5 h-5" />} label="Jobs" onClick={() => setIsMenuOpen(false)} />
                  <NavLink to="/settings" icon={<Settings className="w-5 h-5" />} label="Settings" onClick={() => setIsMenuOpen(false)} />
                </>
              )}
            </nav>

            <div className="p-4 border-t border-zinc-800">
              <div className="flex items-center gap-3 mb-4 px-2">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-zinc-700" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <Routes>
          <Route path="/members" element={<MembersPage isAdmin={isAdmin} />} />
          <Route path="/events" element={<EventsPage isAdmin={isAdmin} />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          {isAdmin && (
            <>
              <Route path="/users" element={<AdminsPage isSuperAdmin={isSuperAdmin} />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          <Route path="/" element={<Navigate to="/members" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function NavLink({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all group"
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

import { cn } from './lib/utils';

