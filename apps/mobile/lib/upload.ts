import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { getMobileEnv } from "./env";
import { unwrapApiResponse } from "./api";

type UploadScope = "avatar" | "profile-cover" | "event-cover" | "service-cover" | "store-product";

type UploadResponse = {
  url?: string | null;
  publicUrl?: string | null;
  signedUrl?: string | null;
};

type UploadPayload = {
  uri: string;
  scope: UploadScope;
  accessToken: string;
  onProgress?: (progress: number) => void;
  maxRetries?: number;
};

const guessMimeType = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

const SCOPE_PRESETS: Record<UploadScope, { maxSize: number; quality: number }> = {
  avatar: { maxSize: 512, quality: 0.82 },
  "profile-cover": { maxSize: 1600, quality: 0.82 },
  "event-cover": { maxSize: 1920, quality: 0.84 },
  "service-cover": { maxSize: 1600, quality: 0.84 },
  "store-product": { maxSize: 1600, quality: 0.84 },
};

const getImageSize = (uri: string): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });

const prepareImageForUpload = async (
  uri: string,
  scope: UploadScope,
): Promise<{ uri: string; name: string; type: string }> => {
  const preset = SCOPE_PRESETS[scope];
  const size = await getImageSize(uri);
  const maxSize = preset?.maxSize ?? 1600;
  const quality = preset?.quality ?? 0.82;

  const actions: ImageManipulator.Action[] = [];
  if (size && Math.max(size.width, size.height) > maxSize) {
    if (size.width >= size.height) {
      actions.push({ resize: { width: maxSize } });
    } else {
      actions.push({ resize: { height: maxSize } });
    }
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return {
      uri: result.uri,
      name: `upload-${scope}-${Date.now()}.jpg`,
      type: "image/jpeg",
    };
  } catch {
    const filename = uri.split("/").pop() ?? `upload-${Date.now()}.jpg`;
    return {
      uri,
      name: filename,
      type: guessMimeType(filename),
    };
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadWithProgress = async ({
  endpoint,
  file,
  accessToken,
  onProgress,
}: {
  endpoint: string;
  file: { uri: string; name: string; type: string };
  accessToken: string;
  onProgress?: (progress: number) => void;
}): Promise<UploadResponse> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const progress = Math.min(1, Math.max(0, event.loaded / event.total));
      onProgress(progress);
    };

    xhr.onerror = () => {
      reject(new Error("Sem ligação à internet."));
    };

    xhr.onload = () => {
      const status = xhr.status;
      const raw = xhr.response ?? xhr.responseText;
      let json: any = raw;
      if (typeof raw === "string") {
        try {
          json = JSON.parse(raw);
        } catch {
          json = {};
        }
      }
      if (status < 200 || status >= 300) {
        const errorMessage =
          (json && typeof json.error === "string" && json.error) ||
          (json && typeof json.message === "string" && json.message) ||
          "Falha no upload da imagem.";
        reject(new Error(errorMessage));
        return;
      }
      resolve(json ?? {});
    };

    const formData = new FormData();
    formData.append("file", file as unknown as Blob);
    xhr.send(formData);
  });

export const uploadImage = async ({
  uri,
  scope,
  accessToken,
  onProgress,
  maxRetries = 1,
}: UploadPayload): Promise<string> => {
  const env = getMobileEnv();
  const endpoint = `${env.apiBaseUrl}/api/upload?scope=${encodeURIComponent(scope)}`;
  const prepared = await prepareImageForUpload(uri, scope);

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      if (onProgress) onProgress(0);
      const json = await uploadWithProgress({
        endpoint,
        file: prepared,
        accessToken,
        onProgress,
      });
      const payload = unwrapApiResponse<UploadResponse>(json);
      const url = payload.url || payload.publicUrl || payload.signedUrl;
      if (!url) {
        throw new Error("Upload concluído, mas sem URL.");
      }
      if (onProgress) onProgress(1);
      return url;
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      attempt += 1;
      await sleep(600 * attempt);
    }
  }

  throw new Error("Falha no upload da imagem.");
};
