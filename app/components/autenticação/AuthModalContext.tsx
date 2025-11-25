"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

type Mode = "login" | "signup" | "verify" | "onboarding" | null;
type OnboardingStep = "perfil" | "foto" | "interesses" | "local" | "final" | null;

type AuthModalContextType = {
  isOpen: boolean;
  mode: Mode;
  email: string;
  redirectTo: string | null;
  onboardingStep: OnboardingStep;
  openModal: (options?: {
    mode?: Mode;
    email?: string;
    redirectTo?: string;
    onboardingStep?: OnboardingStep;
  }) => void;
  closeModal: () => void;
  setEmail: (email: string) => void;
  setMode: (mode: Mode) => void;
  setRedirectTo: (redirectTo: string | null) => void;
  setOnboardingStep: (step: OnboardingStep) => void;
};

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export const AuthModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<Mode>(null);
  const [email, setEmailState] = useState<string>("");

  const [redirectTo, setRedirectToState] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStepState] = useState<OnboardingStep>(null);

  const openModal = useCallback(
    (options?: {
      mode?: Mode;
      email?: string;
      redirectTo?: string;
      onboardingStep?: OnboardingStep;
    }) => {
      if (options?.mode !== undefined) setModeState(options.mode);
      if (options?.email !== undefined) setEmailState(options.email);
      if (options?.redirectTo !== undefined) setRedirectToState(options.redirectTo);
      if (options?.onboardingStep !== undefined) setOnboardingStepState(options.onboardingStep);
      setIsOpen(true);
    },
    []
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setModeState(null);
    setEmailState("");
    setRedirectToState(null);
    setOnboardingStepState(null);
  }, []);

  const setEmail = useCallback((email: string) => {
    setEmailState(email);
  }, []);

  const setRedirectTo = useCallback((value: string | null) => {
    setRedirectToState(value);
  }, []);

  const setOnboardingStep = useCallback((step: OnboardingStep) => {
    setOnboardingStepState(step);
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setModeState(mode);
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        mode,
        email,
        redirectTo,
        onboardingStep,
        openModal,
        closeModal,
        setEmail,
        setMode,
        setRedirectTo,
        setOnboardingStep,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return ctx;
};