import { router } from 'expo-router';
import { ProfileOnboarding } from '@screens/ProfileOnboarding';

export default function OnboardingScreen() {
  return (
    <ProfileOnboarding
      onComplete={() => router.replace('/(tabs)')}
    />
  );
}