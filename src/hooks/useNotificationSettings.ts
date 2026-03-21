import { useState, useEffect, useCallback, useRef } from 'react';

interface NotificationSettings {
  soundEnabled: boolean;
  browserEnabled: boolean;
}

const STORAGE_KEY = 'skynet_notification_settings';

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  browserEnabled: true,
};

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const lastSoundTime = useRef(0);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    const now = Date.now();
    if (now - lastSoundTime.current < 2000) return; // debounce 2s
    lastSoundTime.current = now;

    // Simple notification ding using AudioContext
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => ctx.close(), 1000);
    } catch (err) {
      console.log('Sound play failed:', err);
    }
  }, [settings.soundEnabled]);

  const showBrowserNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (!settings.browserEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'employee-message',
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
      };
    }
  }, [settings.browserEnabled]);

  // Request permission on mount if enabled
  useEffect(() => {
    if (settings.browserEnabled) {
      requestBrowserPermission();
    }
  }, [settings.browserEnabled, requestBrowserPermission]);

  return {
    settings,
    updateSettings,
    playNotificationSound,
    showBrowserNotification,
    requestBrowserPermission,
  };
}
