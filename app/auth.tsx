import { useState } from 'react';
import { LoginScreen, SignUpScreen } from '@screens/AuthScreens';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (mode === 'signup') {
    return (
      <SignUpScreen
        onSuccess={() => setMode('login')}
        onSwitchToLogin={() => setMode('login')}
      />
    );
  }

  return (
    <LoginScreen
      onSuccess={() => {}}
      onSwitchToSignUp={() => setMode('signup')}
    />
  );
}