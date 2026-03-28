import { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../firebase';
import { GuildSettings } from '../types';
import { Save, Globe, Type, Image as ImageIcon, Loader2, CheckCircle2, Upload } from 'lucide-react';
import { motion } from 'motion/react';

const TIMEZONES = [
  'UTC',
  'GMT+8 (Singapore/Manila)',
  'GMT+9 (Tokyo/Seoul)',
  'GMT+7 (Bangkok/Jakarta)',
  'GMT+0 (London)',
  'GMT-5 (New York)',
  'GMT-8 (Los Angeles)',
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<GuildSettings>({
    name: 'Mad Monkeys',
    subtitle: 'Guild Management System',
    timezone: 'GMT+8 (Singapore/Manila)',
    logoUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchAPI('/api/settings');
        setSettings(data);
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

    // Check file size (e.g., 500KB limit for Base64 storage in Firestore)
    if (file.size > 500 * 1024) {
      alert('Logo file is too large. Please use an image smaller than 500KB for the guild logo.');
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
        alert('Failed to read file. Please try another image.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Logo processing error:', error);
      alert('Failed to process logo. Please try again.');
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await fetchAPI('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Guild Settings</h1>
        <p className="text-zinc-500">Manage your guild's identity and global configuration</p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
      >
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Guild Identity */}
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
                    placeholder="e.g. Mad Monkeys"
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

            {/* Logo & Visuals */}
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
          </div>

          <div className="pt-8 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Localization */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-500" />
                Localization
              </h2>

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

          <div className="pt-8 flex items-center justify-between">
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
  );
}
