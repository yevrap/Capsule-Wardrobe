import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Profile } from '@/types';

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfileId: (id: string) => void;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const profiles = useLiveQuery(() => db.profiles.orderBy('createdAt').toArray(), []);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => localStorage.getItem('capsule:activeProfileId'),
  );

  // Keep localStorage in sync with state
  useEffect(() => {
    if (activeProfileId) {
      localStorage.setItem('capsule:activeProfileId', activeProfileId);
    } else {
      localStorage.removeItem('capsule:activeProfileId');
    }
  }, [activeProfileId]);

  // Auto-select the first profile if none is selected (e.g. after onboarding)
  useEffect(() => {
    if (!activeProfileId && profiles && profiles.length > 0) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  const isLoading = profiles === undefined;
  const hasCompletedOnboarding = !isLoading && (profiles?.length ?? 0) > 0;
  const activeProfile = profiles?.find((p) => p.id === activeProfileId) ?? profiles?.[0] ?? null;

  return (
    <ProfileContext.Provider
      value={{
        profiles: profiles ?? [],
        activeProfile,
        setActiveProfileId,
        hasCompletedOnboarding,
        isLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfiles must be used inside <ProfileProvider>');
  return ctx;
}
