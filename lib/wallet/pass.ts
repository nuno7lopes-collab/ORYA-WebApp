import { env } from "@/lib/env";
import path from "path";

type PassPayload = {
  serialNumber: string;
  title: string;
  subtitle?: string | null;
  venue?: string | null;
  startAt?: string | null;
  barcodeMessage: string;
};

export const isWalletPassEnabled = () => {
  if (!env.appleWalletPassEnabled) return false;
  return Boolean(
    env.appleWalletPassTypeId &&
      env.appleWalletTeamId &&
      env.appleWalletCertPemBase64 &&
      env.appleWalletKeyPemBase64 &&
      env.appleWalletWwdrPemBase64,
  );
};

const formatPassDate = (value?: string | null) => {
  if (!value) return "A anunciar";
  try {
    return new Date(value).toLocaleString("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "A anunciar";
  }
};

export const buildWalletPass = async (payload: PassPayload): Promise<Buffer> => {
  if (!isWalletPassEnabled()) {
    throw new Error("PASS_NOT_CONFIGURED");
  }

  const { PKPass } = await import("passkit-generator");
  const modelPath = path.join(process.cwd(), "passes", "orya");

  const pass = await PKPass.from(
    {
      model: modelPath,
      certificates: {
        signerCert: Buffer.from(env.appleWalletCertPemBase64, "base64"),
        signerKey: Buffer.from(env.appleWalletKeyPemBase64, "base64"),
        signerKeyPassphrase: env.appleWalletKeyPassword || undefined,
        wwdr: Buffer.from(env.appleWalletWwdrPemBase64, "base64"),
      },
    },
    {
      serialNumber: payload.serialNumber,
      description: payload.title,
      organizationName: env.appleWalletOrgName,
      passTypeIdentifier: env.appleWalletPassTypeId,
      teamIdentifier: env.appleWalletTeamId,
      foregroundColor: "rgb(255,255,255)",
      backgroundColor: "rgb(12,15,26)",
      labelColor: "rgb(170,170,185)",
      logoText: "ORYA",
    },
  );

  pass.type = "eventTicket";
  pass.primaryFields.push({ key: "event", label: "Evento", value: payload.title });
  pass.secondaryFields.push({ key: "date", label: "Data", value: formatPassDate(payload.startAt) });
  if (payload.venue) {
    pass.auxiliaryFields.push({ key: "venue", label: "Local", value: payload.venue });
  }
  if (payload.subtitle) {
    pass.headerFields.push({ key: "type", label: "Tipo", value: payload.subtitle });
  }

  pass.barcodes = [
    {
      format: "PKBarcodeFormatQR",
      message: payload.barcodeMessage,
      messageEncoding: "iso-8859-1",
    },
  ];

  return pass.getAsBuffer();
};
