import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorBoundary from "./components/ErrorBoundary";

import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useThemeStore } from "./store/useThemeStore";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { subscribeToMessages, unsubscribeFromMessages } = useChatStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Bind the socket handlers once per session rather than per open chat.
  useEffect(() => {
    if (!authUser) return undefined;
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [authUser, subscribeToMessages, unsubscribeFromMessages]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen" data-theme={theme}>
        <Loader className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-base-200">
      <Navbar />

      <ErrorBoundary>
        <Routes>
          <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" replace />} />
          <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/profile"
            element={authUser ? <ProfilePage /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>

      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </div>
  );
};

export default App;
