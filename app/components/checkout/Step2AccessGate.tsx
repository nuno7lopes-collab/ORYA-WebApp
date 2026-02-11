"use client";

import AuthGateBanner from "./AuthGateBanner";
import AuthRequiredCard from "./AuthRequiredCard";
import AuthWall from "./AuthWall";
import GuestDetailsForm from "./GuestDetailsForm";
import PurchaseModeSelector from "./PurchaseModeSelector";

type Step2AccessGateProps = {
  authInfo: string | null;
  error: string | null;
  shouldShowAuthGate: boolean;
  authGateTitle: string;
  authGateDescription: string;
  requiresAuth: boolean;
  purchaseMode: "auth" | "guest";
  onSelectMode: (mode: "auth" | "guest") => void;
  onAuthenticated: (userId: string) => void;
  onGuestContinue: () => void;
  guestName: string;
  guestEmail: string;
  guestEmailConfirm: string;
  guestPhone: string;
  guestConsent: boolean;
  guestErrors: { name?: string; email?: string; phone?: string; consent?: string };
  submitAttempt: number;
  onChangeName: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangeEmailConfirm: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeConsent: (value: boolean) => void;
  ticketNameLabel: string;
  ticketEmailLabel: string;
  ticketPluralWithArticle: string;
  ticketAllPlural: string;
  authRequiredTitle: string;
  authRequiredDescription: string;
};

export default function Step2AccessGate({
  authInfo,
  error,
  shouldShowAuthGate,
  authGateTitle,
  authGateDescription,
  requiresAuth,
  purchaseMode,
  onSelectMode,
  onAuthenticated,
  onGuestContinue,
  guestName,
  guestEmail,
  guestEmailConfirm,
  guestPhone,
  guestConsent,
  guestErrors,
  submitAttempt,
  onChangeName,
  onChangeEmail,
  onChangeEmailConfirm,
  onChangePhone,
  onChangeConsent,
  ticketNameLabel,
  ticketEmailLabel,
  ticketPluralWithArticle,
  ticketAllPlural,
  authRequiredTitle,
  authRequiredDescription,
}: Step2AccessGateProps) {
  return (
    <div className="space-y-3">
      {authInfo && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-50">
          {authInfo}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-[11px] text-red-50">
          {error}
        </div>
      )}
      {shouldShowAuthGate && (
        <AuthGateBanner title={authGateTitle} description={authGateDescription} />
      )}
      {!requiresAuth && (
        <PurchaseModeSelector mode={purchaseMode} onSelect={onSelectMode} />
      )}

      {requiresAuth ? (
        <AuthRequiredCard title={authRequiredTitle} description={authRequiredDescription}>
          <AuthWall
            variant="plain"
            showHeader={false}
            onAuthenticated={onAuthenticated}
            ticketPluralWithArticle={ticketPluralWithArticle}
          />
        </AuthRequiredCard>
      ) : purchaseMode === "guest" ? (
        <GuestDetailsForm
          guestName={guestName}
          guestEmail={guestEmail}
          guestEmailConfirm={guestEmailConfirm}
          guestPhone={guestPhone}
          guestConsent={guestConsent}
          guestErrors={guestErrors}
          submitAttempt={submitAttempt}
          onChangeName={onChangeName}
          onChangeEmail={onChangeEmail}
          onChangeEmailConfirm={onChangeEmailConfirm}
          onChangePhone={onChangePhone}
          onChangeConsent={onChangeConsent}
          onContinue={onGuestContinue}
          ticketNameLabel={ticketNameLabel}
          ticketEmailLabel={ticketEmailLabel}
          ticketPluralWithArticle={ticketPluralWithArticle}
          ticketAllPlural={ticketAllPlural}
        />
      ) : (
        <AuthWall onAuthenticated={onAuthenticated} ticketPluralWithArticle={ticketPluralWithArticle} />
      )}
    </div>
  );
}
