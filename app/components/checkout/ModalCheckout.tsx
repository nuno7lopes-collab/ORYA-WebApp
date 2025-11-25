"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { useCheckout } from "./contextoCheckout";
import Step1Bilhete from "./Step1Bilhete";
import Step2Pagamento from "./Step2Pagamento";
import Step3Sucesso from "./Step3Sucesso";

type ModalCheckoutProps = {
  children: ReactNode;
};

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
            className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[200]"
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
  <div className="w-full max-w-lg max-h-[85vh] rounded-3xl border border-white/15 bg-gradient-to-br from-[#020617ee] via-[#020617f8] to-[#020617ee] shadow-[0_24px_80px_rgba(0,0,0,0.95)] text-white overflow-hidden">
    <div className="p-6 overflow-y-auto max-h-[85vh]">
      <StepController />
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