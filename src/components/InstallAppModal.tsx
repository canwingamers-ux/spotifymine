import React, { useEffect, useState } from 'react';
import { X, Download, MonitorSmartphone, CheckCircle2, Clock } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstalled: () => void;
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled,
}) => {
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const android = isAndroid();
  const alreadyStandalone = isStandalone();

  useEffect(() => {
    if (!isOpen) {
      setInstalled(false);
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        onInstalled();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#1DB954] flex items-center justify-center">
              <Download className="w-4.5 h-4.5 text-black" />
            </div>
            <h2 className="text-white font-extrabold text-base">Get the App</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {alreadyStandalone || installed ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <CheckCircle2 className="w-12 h-12 text-[#1DB954]" />
              <p className="text-white font-bold">You're all set!</p>
              <p className="text-zinc-400 text-sm">
                This app is already installed and running on your device.
              </p>
            </div>
          ) : android ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#1DB954]" />
              </div>
              <p className="text-white font-bold">Android — Coming Soon</p>
              <p className="text-zinc-400 text-sm max-w-xs">
                The installable Android app isn't ready yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-4">
                <MonitorSmartphone className="w-5 h-5 text-[#1DB954] shrink-0 mt-0.5" />
                <p className="text-zinc-300 text-sm">
                  Install this as an app on your device. It'll get its own icon,
                  open in its own window, and work just like a native app.
                </p>
              </div>

              {deferredPrompt ? (
                <button
                  onClick={handleInstallClick}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-60 text-black font-extrabold py-3 rounded-full transition-all active:scale-95"
                >
                  <Download className="w-4.5 h-4.5" />
                  {busy ? 'Installing…' : 'Install App'}
                </button>
              ) : (
                <div className="flex flex-col gap-3 text-sm text-zinc-300">
                  <p>
                    Your browser hasn't offered an install prompt yet. You can usually
                    still install manually:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400">
                    <li><b>Chrome/Edge (desktop):</b> click the install icon in the address bar, or the browser menu → "Install app".</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
