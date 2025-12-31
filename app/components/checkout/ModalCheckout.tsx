"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { useCheckout } from "./contextoCheckout";
import Step1Bilhete from "./Step1Bilhete";
import Step2Pagamento from "./Step2Pagamento";
import Step3Sucesso from "./Step3Sucesso";

export default function ModalCheckout() {
  const { isOpen, passo, fecharCheckout, irParaPasso } = useCheckout();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 🔥 Escutar evento vindo do WavesSectionClient e forçar passo 1
  useEffect(() => {
    function forceStep1() {
      irParaPasso(1);
    }
    window.addEventListener("ORYA_CHECKOUT_FORCE_STEP1", forceStep1);
    return () => window.removeEventListener("ORYA_CHECKOUT_FORCE_STEP1", forceStep1);
  }, [irParaPasso]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-[200] bg-gradient-to-br from-[#040712]/90 via-[#050918]/85 to-[#02040c]/90 backdrop-blur-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={fecharCheckout}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[210] flex items-center justify-center p-4 overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <div className="relative w-full max-w-3xl max-h-[88vh] rounded-3xl border border-white/12 bg-white/[0.08] backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.6)] text-white overflow-hidden">
              {/* ambient glows */}
              <div className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,0,200,0.35),_transparent_60%)] blur-2xl" />
              <div className="pointer-events-none absolute -right-24 -bottom-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(107,255,255,0.32),_transparent_60%)] blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                  {passo > 1 && passo !== 3 ? (
                    <button
                      type="button"
                      onClick={() => irParaPasso(Math.max(1, passo - 1) as 1 | 2 | 3)}
                    className="text-[12px] inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75 hover:text-white hover:border-white/30 transition"
                    >
                    ← Voltar
                    </button>
                  ) : (
                    <span className="text-[12px] text-white/60">
                      {passo === 3 ? "Pagamento concluído" : "Checkout"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={fecharCheckout}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 hover:bg-white/20 transition"
                    aria-label="Fechar checkout"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[78vh] bg-gradient-to-b from-white/[0.03] via-transparent to-white/[0.02]">
                  <StepController />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StepController() {
  const { passo, irParaPasso } = useCheckout();

  useEffect(() => {
    function handler() {
      irParaPasso(1);
    }
    window.addEventListener("ORYA_CHECKOUT_FORCE_STEP1", handler);
    return () => window.removeEventListener("ORYA_CHECKOUT_FORCE_STEP1", handler);
  }, [irParaPasso]);

  return (
    <>
      {passo === 1 && <Step1Bilhete />}
      {passo === 2 && <Step2Pagamento />}
      {passo === 3 && <Step3Sucesso />}
    </>
  );
}
