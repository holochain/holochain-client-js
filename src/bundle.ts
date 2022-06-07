import { decode } from "@msgpack/msgpack";
import { AppBundle, AppBundleSource } from "./api/index.js";
import { DnaProperties } from "./types.js";

export type HappProperties = { [role_id: string]: DnaProperties };

const readAppBundleFromPath = async (path: string): Promise<AppBundle> => {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    throw new Error("Cannot read app bundle from path in browser context");
  }
  const {
    promises: { readFile },
  } = await import("fs");
  const { gunzip } = await import("zlib");

  const compressed = await readFile(path);
  const encoded: Uint8Array = await new Promise((resolve, reject) =>
    gunzip(compressed, (err, bytes) =>
      err === null ? resolve(bytes) : reject(err)
    )
  );
  return decode(encoded) as AppBundle;
};

/// Adds properties to app bundle. Requires node if passed a path.
export const appBundleWithProperties = async (
  source: AppBundleSource,
  properties: HappProperties
): Promise<AppBundleSource> => {
  const originalBundle =
    "path" in source ? await readAppBundleFromPath(source.path) : source.bundle;
  return {
    bundle: {
      ...originalBundle,
      manifest: {
        ...originalBundle.manifest,
        roles: originalBundle.manifest.roles.map((roleManifest) => ({
          ...roleManifest,
          dna: {
            ...roleManifest.dna,
            properties: properties[roleManifest.id],
          },
        })),
      },
    },
  };
};
