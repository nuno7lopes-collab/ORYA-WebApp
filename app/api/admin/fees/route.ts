import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getPlatformAndStripeFees, setPlatformFees, setStripeBaseFees } from "@/lib/platformSettings";

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const { orya, stripe } = await getPlatformAndStripeFees();

    return NextResponse.json(
      {
        ok: true,
        orya,
        stripe,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/fees] unexpected error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = await req.json();

    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
    const platformFeeBpsRaw = Number(body?.platformFeeBps);
    const platformFeeFixedCentsRaw = Number(body?.platformFeeFixedCents);
    const stripeFeeBpsEuRaw = Number(body?.stripeFeeBpsEu);
    const stripeFeeFixedCentsEuRaw = Number(body?.stripeFeeFixedCentsEu);

    const updatesErrors: string[] = [];
    if (body?.platformFeeBps !== undefined && !Number.isFinite(platformFeeBpsRaw)) {
      updatesErrors.push("platformFeeBps inválido");
    }
    if (body?.platformFeeFixedCents !== undefined && !Number.isFinite(platformFeeFixedCentsRaw)) {
      updatesErrors.push("platformFeeFixedCents inválido");
    }
    if (body?.stripeFeeBpsEu !== undefined && !Number.isFinite(stripeFeeBpsEuRaw)) {
      updatesErrors.push("stripeFeeBpsEu inválido");
    }
    if (body?.stripeFeeFixedCentsEu !== undefined && !Number.isFinite(stripeFeeFixedCentsEuRaw)) {
      updatesErrors.push("stripeFeeFixedCentsEu inválido");
    }

    if (updatesErrors.length > 0) {
      return NextResponse.json({ ok: false, error: updatesErrors.join(", ") }, { status: 400 });
    }

    await Promise.all([
      setPlatformFees({
        feeBps: Number.isFinite(platformFeeBpsRaw)
          ? clamp(Math.round(platformFeeBpsRaw), 0, 5000)
          : undefined,
        feeFixedCents: Number.isFinite(platformFeeFixedCentsRaw)
          ? clamp(Math.round(platformFeeFixedCentsRaw), 0, 5000)
          : undefined,
      }),
      setStripeBaseFees({
        feeBps: Number.isFinite(stripeFeeBpsEuRaw)
          ? clamp(Math.round(stripeFeeBpsEuRaw), 0, 5000)
          : undefined,
        feeFixedCents: Number.isFinite(stripeFeeFixedCentsEuRaw)
          ? clamp(Math.round(stripeFeeFixedCentsEuRaw), 0, 5000)
          : undefined,
      }),
    ]);

    const { orya, stripe } = await getPlatformAndStripeFees();

    return NextResponse.json({ ok: true, orya, stripe }, { status: 200 });
  } catch (err) {
    console.error("[admin/fees] unexpected error on POST", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
