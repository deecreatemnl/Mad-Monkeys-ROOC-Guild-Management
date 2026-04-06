import { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../lib/api';
import { GuildSettings } from '../types';
import { Save, Globe, Type, Image as ImageIcon, Loader2, CheckCircle2, Upload, Calendar, MessageSquare, Check, ChevronDown, Users, RotateCcw, AlertTriangle, CloudDownload, Trophy, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const TIMEZONES = [
  'UTC',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Bangkok',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
];

export default function SettingsPage({ onUpdateSettings }: { onUpdateSettings?: () => void }) {
  const [settings, setSettings] = useState<GuildSettings>({
    name: 'MadMonkeys',
    subtitle: 'Guild Management System',
    timezone: 'Asia/Singapore',
    logoUrl: '',
    maxPartySize: 12,
    discordChannelId: '',
    discordGuildId: '',
    discordAnnouncementsChannelId: '',
    discordAbsenceChannelId: '',
    discordWebhookUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
  const [isDiscordConfigured, setIsDiscordConfigured] = useState(true);
  const [guilds, setGuilds] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [fetchingGuilds, setFetchingGuilds] = useState(false);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ currentVersion: string, latestVersion: string, hasUpdate: boolean } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleAuthSuccess = async (data: any) => {
      const { accessToken, guildId } = data;
      setIsDiscordConnected(true);
      fetchGuilds(accessToken);
      if (guildId) {
        setSelectedGuildId(guildId);
        const newSettings = { ...settings, discordGuildId: guildId };
        setSettings(newSettings);
        fetchChannels(guildId, newSettings);
      }
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'DISCORD_AUTH_SUCCESS') {
        handleAuthSuccess(event.data);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'discord_auth_result' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data.type === 'DISCORD_AUTH_SUCCESS') {
            handleAuthSuccess(data);
            localStorage.removeItem('discord_auth_result');
          }
        } catch (e) {
          console.error('Failed to parse discord_auth_result:', e);
        }
      }
    };

    // Check on mount for redirected auth
    const checkAuth = () => {
      const stored = localStorage.getItem('discord_auth_result');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          // Only use if it's fresh (within last 30 seconds)
          if (data.type === 'DISCORD_AUTH_SUCCESS' && Date.now() - data.timestamp < 30000) {
            handleAuthSuccess(data);
          }
          localStorage.removeItem('discord_auth_result');
        } catch (e) {
          console.error('Failed to parse discord_auth_result:', e);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    checkAuth();

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [settings]);

  const fetchGuilds = async (accessToken: string) => {
    setFetchingGuilds(true);
    try {
      const data = await fetchAPI('/api/discord/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setGuilds(data);
    } catch (err) {
      console.error('Failed to fetch guilds:', err);
    } finally {
      setFetchingGuilds(false);
    }
  };

  const fetchGuildInfo = async (guildId: string) => {
    setFetchingGuilds(true);
    try {
      const data = await fetchAPI(`/api/discord/guild/${guildId}`);
      if (data && data.name) {
        setGuilds(prev => {
          // Only add if not already in list
          if (!prev.find(g => g.id === data.id)) {
            return [...prev, data];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to fetch guild info:', err);
    } finally {
      setFetchingGuilds(false);
    }
  };

  const fetchChannels = async (guildId: string, currentSettings?: GuildSettings) => {
    setFetchingChannels(true);
    setChannelError(null);
    try {
      const data = await fetchAPI(`/api/discord/channels/${guildId}`);
      setChannels(data);
      
      // Auto-select channels if they match our default names
      const announcements = data.find((c: any) => c.name.toLowerCase() === 'guild-event-announcements');
      const absence = data.find((c: any) => c.name.toLowerCase() === 'guild-event-absence');
      
      const activeSettings = currentSettings || settings;
      const newSettings = { ...activeSettings };
      let changed = false;
      
      if (announcements && !activeSettings.discordAnnouncementsChannelId) {
        newSettings.discordAnnouncementsChannelId = announcements.id;
        changed = true;
      }
      if (absence && !activeSettings.discordAbsenceChannelId) {
        newSettings.discordAbsenceChannelId = absence.id;
        changed = true;
      }
      
      if (changed) {
        setSettings(newSettings);
      }
    } catch (err: any) {
      console.error('Failed to fetch channels:', err);
      setChannelError(err.message || 'Failed to fetch channels');
    } finally {
      setFetchingChannels(false);
    }
  };

  const handleInviteBot = async () => {
    try {
      const { url } = await fetchAPI('/api/auth/discord/invite');
      window.open(url, 'discord_invite', 'width=500,height=800');
    } catch (err) {
      console.error('Discord invite error:', err);
    }
  };

  const handleDiscordConnect = async () => {
    try {
      // Use absolute URL to avoid issues on some platforms
      const baseUrl = window.location.origin;
      const { url } = await fetchAPI(`/api/auth/discord/url?origin=${encodeURIComponent(baseUrl)}`);
      window.open(url, 'discord_oauth', 'width=500,height=800');
    } catch (err) {
      console.error('Discord connect error:', err);
      alert('Failed to start Discord connection. Check your console for details.');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Discord? This will clear your server and channel settings.')) return;
    
    try {
      const newSettings = { 
        ...settings, 
        discordGuildId: '', 
        discordAnnouncementsChannelId: '', 
        discordAbsenceChannelId: '',
        discordWebhookUrl: ''
      };
      
      await fetchAPI('/api/settings/guild_settings', {
        method: 'POST',
        body: JSON.stringify(newSettings)
      });
      
      setSettings(prev => ({ 
        ...prev, 
        discordGuildId: '', 
        discordAnnouncementsChannelId: '', 
        discordAbsenceChannelId: '',
        discordWebhookUrl: ''
      }));
      setIsDiscordConnected(false);
      setGuilds([]);
      setChannels([]);
      setSelectedGuildId('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Disconnect error:', err);
      alert('Failed to disconnect Discord.');
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [data, health] = await Promise.all([
          fetchAPI('/api/settings/guild_settings'),
          fetchAPI('/api/health')
        ]);
        
        if (health && health.env) {
          setIsDiscordConfigured(health.env.hasDiscord);
        }

        if (data && Object.keys(data).length > 0) {
          const newSettings = {
            name: data.name || '',
            subtitle: data.subtitle || '',
            timezone: data.timezone || 'Asia/Singapore',
            logoUrl: data.logoUrl || '',
            maxPartySize: data.maxPartySize || 12,
            discordChannelId: data.discordChannelId || '',
            discordGuildId: data.discordGuildId || '',
            discordAnnouncementsChannelId: data.discordAnnouncementsChannelId || '',
            discordAbsenceChannelId: data.discordAbsenceChannelId || '',
            discordWebhookUrl: data.discordWebhookUrl || '',
          };
          setSettings(newSettings);
          
          if (newSettings.discordGuildId || newSettings.discordAnnouncementsChannelId || newSettings.discordAbsenceChannelId) {
            setIsDiscordConnected(true);
            if (newSettings.discordGuildId) {
              setSelectedGuildId(newSettings.discordGuildId);
              fetchGuildInfo(newSettings.discordGuildId);
              fetchChannels(newSettings.discordGuildId, newSettings);
            }
          }
        }
      } catch (error) {
        console.error('Settings fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('Logo file is too large. Please use an image smaller than 500KB.');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSettings({ ...settings, logoUrl: base64String });
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read file.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Logo processing error:', error);
      alert('Failed to process logo.');
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await fetchAPI('/api/settings/guild_settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      setSaveSuccess(true);
      if (onUpdateSettings) onUpdateSettings();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleForceResetRaffle = async () => {
    if (!confirm('WARNING: This will completely wipe ALL raffle data (entries, winners, settings) and reset to defaults. This action cannot be undone. Are you sure?')) return;
    
    setSaving(true);
    try {
      await fetchAPI('/api/raffle/force-reset', { method: 'POST' });
      alert('Raffle data has been completely reset.');
    } catch (err: any) {
      console.error('Force reset failed:', err);
      alert('Force reset failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const data = await fetchAPI('/api/system/update-check');
      setUpdateInfo(data);
    } catch (err) {
      console.error('Update check failed:', err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!confirm('Are you sure you want to install this update? The system will be temporarily unavailable.')) return;
    setInstallingUpdate(true);
    try {
      await fetchAPI('/api/system/install-update', { method: 'POST' });
      alert('Update triggered successfully. The system will restart shortly.');
    } catch (err) {
      console.error('Install update failed:', err);
      alert('Failed to trigger update.');
    } finally {
      setInstallingUpdate(false);
    }
  };

  const [activeTab, setActiveTab] = useState('identity');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'identity', label: 'Identity', icon: Type },
    { id: 'visuals', label: 'Visuals', icon: ImageIcon },
    { id: 'localization', label: 'Localization', icon: Globe },
    { id: 'raffle', label: 'Raffle Settings', icon: Trophy },
    { id: 'events', label: 'Event Settings', icon: Calendar },
    { id: 'discord', label: 'Discord Integration', icon: MessageSquare },
    { id: 'system', label: 'System Updates', icon: RefreshCw },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Guild Settings</h1>
        <p className="text-zinc-500">Manage your guild's identity and global configuration</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-white" : "text-zinc-500")} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
          >
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {activeTab === 'identity' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Type className="w-5 h-5 text-orange-500" />
                    Identity
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Guild Name</label>
                      <input
                        required
                        type="text"
                        value={settings.name}
                        onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                        placeholder="e.g. MadMonkeys"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Subtitle</label>
                      <input
                        required
                        type="text"
                        value={settings.subtitle}
                        onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                        placeholder="e.g. Guild Management System"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'visuals' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-orange-500" />
                    Visuals
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Guild Logo</label>
                      <div className="flex gap-6 items-start">
                        <div className="w-24 h-24 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                          {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-zinc-600" />
                          )}
                          {uploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-3">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLogoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-bold py-2 px-4 rounded-lg border border-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Uploading...' : 'Upload Logo'}
                          </button>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Or use URL</label>
                            <input
                              type="url"
                              value={settings.logoUrl}
                              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                              placeholder="https://example.com/logo.png"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'localization' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-orange-500" />
                    Localization
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Primary Timezone</label>
                      <select
                        value={settings.timezone}
                        onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all appearance-none"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'raffle' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    Raffle Settings
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Raffle Winners</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.raffleWinners || 2}
                        onChange={(e) => setSettings({ ...settings, raffleWinners: parseInt(e.target.value) || 1 })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">Number of winners to draw in the weekly raffle</p>
                    </div>

                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-red-500">Raffle Data Management</h4>
                          <p className="text-xs text-zinc-500 mt-1 mb-4">If you're experiencing issues with the raffle, you can force reset the current week's state. This will clear all entries for the current week.</p>
                          <button
                            type="button"
                            onClick={handleForceResetRaffle}
                            className="flex items-center gap-2 bg-zinc-800 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/20 transition-all"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Force Reset Raffle
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    Event Settings
                  </h2>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Max Party Members</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settings.maxPartySize}
                      onChange={(e) => setSettings({ ...settings, maxPartySize: parseInt(e.target.value) || 12 })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                      placeholder="e.g. 12"
                    />
                    <p className="mt-2 text-[10px] text-zinc-500 italic">Changing this will update all existing sub-event parties.</p>
                  </div>
                </div>
              )}

              {activeTab === 'discord' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-orange-500" />
                      Discord Integration
                    </div>
                    {!isDiscordConfigured && (
                      <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20">
                        Not Configured
                      </span>
                    )}
                  </h2>

                  <div className="space-y-4">
                    {!isDiscordConfigured && (
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
                          <AlertTriangle className="w-4 h-4" />
                          Missing Environment Variables
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          To enable Discord integration, you must set the following environment variables in your Vercel project settings:
                        </p>
                        <ul className="text-[10px] font-mono text-zinc-400 list-disc list-inside space-y-1">
                          <li>DISCORD_CLIENT_ID</li>
                          <li>DISCORD_CLIENT_SECRET</li>
                          <li>DISCORD_BOT_TOKEN</li>
                        </ul>
                      </div>
                    )}
                    {!isDiscordConnected ? (
                      <button
                        type="button"
                        onClick={handleDiscordConnect}
                        disabled={!isDiscordConfigured}
                        className="w-full flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 disabled:grayscale text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-[#5865F2]/20"
                      >
                        <MessageSquare className="w-5 h-5" />
                        Connect Discord Server
                      </button>
                    ) : (
                      <div className="space-y-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-500 text-sm font-bold">
                            <Check className="w-4 h-4" />
                            Discord Connected
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              type="button"
                              onClick={() => {
                                if (selectedGuildId) fetchChannels(selectedGuildId);
                                const stored = localStorage.getItem('discord_auth_result');
                                if (stored) {
                                  try {
                                    const data = JSON.parse(stored);
                                    if (data.accessToken) fetchGuilds(data.accessToken);
                                  } catch (e) {}
                                }
                              }}
                              className="text-[10px] text-orange-500 hover:text-orange-400 underline font-bold"
                            >
                              Refresh
                            </button>
                            <button 
                              type="button"
                              onClick={handleDisconnect}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>

                        {fetchingGuilds ? (
                          <div className="flex items-center gap-2 text-zinc-500 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Fetching your servers...
                          </div>
                        ) : guilds.length > 0 ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Select Server</label>
                              <select
                                value={selectedGuildId}
                                onChange={(e) => {
                                  const guildId = e.target.value;
                                  setSelectedGuildId(guildId);
                                  const newSettings = { ...settings, discordGuildId: guildId };
                                  setSettings(newSettings);
                                  fetchChannels(guildId, newSettings);
                                }}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all appearance-none"
                              >
                                <option value="">-- Choose a Server --</option>
                                {guilds.map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            </div>

                            {selectedGuildId && (
                              fetchingChannels ? (
                                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Fetching channels...
                                </div>
                              ) : channels.length > 0 ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Event Announcements Channel</label>
                                    <select
                                      value={settings.discordAnnouncementsChannelId}
                                      onChange={(e) => setSettings({ ...settings, discordAnnouncementsChannelId: e.target.value })}
                                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all appearance-none"
                                    >
                                      <option value="">-- Choose a Channel --</option>
                                      {channels.map(c => (
                                        <option key={c.id} value={c.id}># {c.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Event Absence Channel</label>
                                    <select
                                      value={settings.discordAbsenceChannelId}
                                      onChange={(e) => setSettings({ ...settings, discordAbsenceChannelId: e.target.value })}
                                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all appearance-none"
                                    >
                                      <option value="">-- Choose a Channel --</option>
                                      {channels.map(c => (
                                        <option key={c.id} value={c.id}># {c.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-orange-400 italic">
                                    {channelError?.includes('Missing Access') 
                                      ? "The bot is not in this server or lacks permissions." 
                                      : "No text channels found."}
                                  </p>
                                  {channelError?.includes('Missing Access') && (
                                    <button
                                      type="button"
                                      onClick={handleInviteBot}
                                      className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-orange-500/20 transition-all active:scale-95"
                                    >
                                      <Users className="w-3 h-3" />
                                      Invite Bot to Server
                                    </button>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-500 italic">
                            {selectedGuildId ? "Loading server details..." : "No manageable servers found."}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="pt-2 space-y-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                          <span className="bg-zinc-900 px-2 text-zinc-600">Or Manual Setup</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Announcements Channel ID</label>
                        <input
                          type="text"
                          value={settings.discordAnnouncementsChannelId}
                          onChange={(e) => setSettings({ ...settings, discordAnnouncementsChannelId: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                          placeholder="e.g. 123456789012345678"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Absence Channel ID</label>
                        <input
                          type="text"
                          value={settings.discordAbsenceChannelId}
                          onChange={(e) => setSettings({ ...settings, discordAbsenceChannelId: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                          placeholder="e.g. 123456789012345678"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Discord Webhook URL (Optional)</label>
                        <input
                          type="text"
                          value={settings.discordWebhookUrl}
                          onChange={(e) => setSettings({ ...settings, discordWebhookUrl: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                          placeholder="https://discord.com/api/webhooks/..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-orange-500" />
                    System Updates
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Vercel Deploy Hook URL</label>
                        <input
                          type="password"
                          value={settings.vercelDeployHookUrl || ''}
                          onChange={(e) => setSettings({ ...settings, vercelDeployHookUrl: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                          placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                        />
                        <p className="mt-2 text-[10px] text-zinc-500 italic">Used to trigger the update installation.</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">Check for Updates</h3>
                        {updateInfo ? (
                          <div className="text-xs text-zinc-400 space-y-1">
                            <p>Current Version: <span className="text-white font-mono">{updateInfo.currentVersion}</span></p>
                            <p>Latest Version: <span className="text-white font-mono">{updateInfo.latestVersion}</span></p>
                            {updateInfo.hasUpdate ? (
                              <p className="text-green-500 font-bold mt-2">✨ A new update is available!</p>
                            ) : (
                              <p className="text-zinc-500 mt-2">You are on the latest version.</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500">Check if a new version is available on GitHub.</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={checkForUpdates}
                          disabled={checkingUpdate}
                          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 border border-zinc-700"
                        >
                          {checkingUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Check Now
                        </button>
                        
                        {updateInfo?.hasUpdate && (
                          <button
                            type="button"
                            onClick={handleInstallUpdate}
                            disabled={installingUpdate || !settings.vercelDeployHookUrl}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-green-600/20"
                          >
                            {installingUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                            Install Update
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-green-500 text-sm font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Settings saved successfully
                    </motion.div>
                  )}
                </div>
                <button
                  disabled={saving}
                  type="submit"
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Save Settings
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
