"use client";

import dynamic from "next/dynamic";
import PromoCodeInput from "./PromoCodeInput";
import PaymentMethodSelector from "./PaymentMethodSelector";
import FreeCheckoutConfirm from "./FreeCheckoutConfirm";
import type { CheckoutBreakdown } from "./contextoCheckout";

const DynamicStripePaymentSection = dynamic(() => import("./StripePaymentSection"), {
  ssr: false,
});

type Step2PaymentPanelProps = {
  needsStripe: boolean;
  isGratisScenario: boolean;
  appliedPromoLabel: string | null;
  appliedDiscount: number;
  promoInput: string;
  promoWarning: string | null;
  paymentMethod: "mbway" | "card";
  cardFeePercentLabel: string;
  loading: boolean;
  error: string | null;
  clientSecret: string | null;
  total: number | null;
  breakdown: CheckoutBreakdown | null;
  freeHeaderLabel: string;
  freeDescription: string;
  freePrepLabel: string;
  freeConfirmLabel: string;
  onPromoInputChange: (value: string) => void;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  onSelectPaymentMethod: (method: "mbway" | "card") => void;
  onPaymentElementError: () => void;
  onFreeConfirm?: () => void;
};

export default function Step2PaymentPanel({
  needsStripe,
  isGratisScenario,
  appliedPromoLabel,
  appliedDiscount,
  promoInput,
  promoWarning,
  paymentMethod,
  cardFeePercentLabel,
  loading,
  error,
  clientSecret,
  total,
  breakdown,
  freeHeaderLabel,
  freeDescription,
  freePrepLabel,
  freeConfirmLabel,
  onPromoInputChange,
  onApplyPromo,
  onRemovePromo,
  onSelectPaymentMethod,
  onPaymentElementError,
  onFreeConfirm,
}: Step2PaymentPanelProps) {
  if (!needsStripe) {
    return (
      <FreeCheckoutConfirm
        loading={loading}
        error={error}
        headerLabel={freeHeaderLabel}
        description={freeDescription}
        loadingLabel={freePrepLabel}
        confirmLabel={freeConfirmLabel}
        onConfirm={!loading && !error ? onFreeConfirm : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <>
      {appliedPromoLabel === "Promo automática" && appliedDiscount > 0 && (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          Desconto aplicado automaticamente 🎉
        </div>
      )}
      {!isGratisScenario && (
        <PromoCodeInput
          promoInput={promoInput}
          onChange={onPromoInputChange}
          onApply={onApplyPromo}
          onRemove={onRemovePromo}
          warning={promoWarning}
          appliedDiscount={appliedDiscount}
          appliedPromoLabel={appliedPromoLabel}
        />
      )}
      {!isGratisScenario && (
        <PaymentMethodSelector
          value={paymentMethod}
          cardFeePercentLabel={cardFeePercentLabel}
          onSelect={onSelectPaymentMethod}
        />
      )}
      <DynamicStripePaymentSection
        loading={loading}
        error={error}
        clientSecret={clientSecret}
        total={total}
        discount={appliedDiscount}
        breakdown={breakdown}
        onLoadError={onPaymentElementError}
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
