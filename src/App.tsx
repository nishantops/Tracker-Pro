import { useAuth } from './context/AuthContext';
import { useProfile } from './hooks/useProfile';
import { AuthGate } from './components/AuthGate';
import { ProfileSetup } from './components/ProfileSetup';
import { Layout } from './components/Layout';
import { AIChatFAB } from './components/chat/AIChatFAB';
import { FeedbackPrompt } from './components/common/FeedbackPrompt';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { loading: profileLoading, isComplete, isSuperuser, features } = useProfile();

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) return <AuthGate />;
  if (!isComplete && !isSuperuser) return <ProfileSetup />;
  return (
    <>
      <Layout />
      {features.ai_chat !== false && <AIChatFAB />}
      <FeedbackPrompt />
    </>
  );
}
