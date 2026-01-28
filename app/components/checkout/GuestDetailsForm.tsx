"use client";

import { useEffect, useRef } from "react";
import FormField from "./FormField";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { sanitizePhone } from "@/lib/phone";

type GuestDetailsFormProps = {
  guestName: string;
  guestEmail: string;
  guestEmailConfirm: string;
  guestPhone: string;
  guestErrors: { name?: string; email?: string; phone?: string };
  submitAttempt: number;
  onChangeName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangeEmailConfirm: (v: string) => void;
  onChangePhone: (v: string) => void;
  onContinue: () => void;
  ticketNameLabel: string;
  ticketEmailLabel: string;
  ticketPluralWithArticle: string;
  ticketAllPlural: string;
};

export default function GuestDetailsForm({
  guestName,
  guestEmail,
  guestEmailConfirm,
  guestPhone,
  guestErrors,
  submitAttempt,
  onChangeName,
  onChangeEmail,
  onChangeEmailConfirm,
  onChangePhone,
  onContinue,
  ticketNameLabel,
  ticketEmailLabel,
  ticketPluralWithArticle,
  ticketAllPlural,
}: GuestDetailsFormProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!submitAttempt) return;
    const target =
      guestErrors.name ? nameRef.current : guestErrors.email ? emailRef.current : guestErrors.phone ? phoneRef.current : null;
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [guestErrors, submitAttempt]);

  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Continuar como convidado</h3>
          <p className="text-[11px] text-white/60 max-w-sm leading-relaxed">
            Compra rápida. Guardamos {ticketPluralWithArticle} no email.
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-white/55">
            <p>• {ticketEmailLabel}</p>
            <p>• Telefone ajuda no dia (opcional).</p>
          </div>
        </div>
        <span className="text-[20px]">🎟️</span>
      </div>

      <div className="flex flex-col gap-3 text-[12px]">
        <FormField
          id="guest-name"
          label="Nome completo"
          required
          inputRef={nameRef}
          error={guestErrors.name}
          inputProps={{
            type: "text",
            value: guestName,
            placeholder: ticketNameLabel,
            onChange: (e) => onChangeName(e.target.value),
            autoComplete: "name",
          }}
        />
        <FormField
          id="guest-email"
          label="Email"
          required
          inputRef={emailRef}
          error={guestErrors.email}
          inputProps={{
            type: "email",
            value: guestEmail,
            placeholder: "nome@exemplo.com",
            onChange: (e) => onChangeEmail(e.target.value),
            autoComplete: "email",
            autoCapitalize: "none",
            inputMode: "email",
          }}
        />
        <FormField
          id="guest-email-confirm"
          label="Confirmar email"
          inputProps={{
            type: "email",
            value: guestEmailConfirm,
            placeholder: "repete o teu email",
            onChange: (e) => onChangeEmailConfirm(e.target.value),
            autoComplete: "email",
            autoCapitalize: "none",
            inputMode: "email",
          }}
        />
        <FormField
          id="guest-phone"
          label="Telemóvel (opcional)"
          inputRef={phoneRef}
          error={guestErrors.phone}
          inputProps={{
            type: "tel",
            value: guestPhone,
            placeholder: "+351 ...",
            onChange: (e) => onChangePhone(sanitizePhone(e.target.value)),
            autoComplete: "tel",
            inputMode: "tel",
          }}
        />
      </div>

      <button
        type="button"
        onClick={onContinue}
        className={`${CTA_PRIMARY} mt-1 w-full justify-center px-6 py-2.5 text-xs active:scale-95`}
      >
        Continuar como convidado
      </button>

      <p className="mt-1 text-[10px] text-white/40 leading-snug">
        Vamos enviar {ticketPluralWithArticle} para este email. Depois podes criar conta e
        migrar {ticketAllPlural} para o teu perfil.
      </p>
    </div>
  );
}
