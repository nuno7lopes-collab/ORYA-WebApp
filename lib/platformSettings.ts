import { prisma } from "@/lib/prisma";

export type PlatformFeeConfig = {
  feeBps: number;
  feeFixedCents: number;
};

const DEFAULT_PLATFORM_FEE_BPS = 200;
const DEFAULT_PLATFORM_FEE_FIXED_CENTS = 0;

/**
 * Lê platform_settings e devolve os valores normalizados.
 * Fallback para defaults se ainda não existirem entradas.
 */
export async function getPlatformFees(): Promise<PlatformFeeConfig> {
  const settings = await prisma.platformSetting.findMany();

  const map = settings.reduce<Record<string, string>>((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});

  const feeBpsRaw = Number(map["platform_fee_bps"]);
  const feeFixedRaw = Number(map["platform_fee_fixed_cents"]);

  const feeBps = Number.isFinite(feeBpsRaw) ? feeBpsRaw : DEFAULT_PLATFORM_FEE_BPS;
  const feeFixedCents = Number.isFinite(feeFixedRaw) ? feeFixedRaw : DEFAULT_PLATFORM_FEE_FIXED_CENTS;

  return {
    feeBps,
    feeFixedCents,
  };
}
