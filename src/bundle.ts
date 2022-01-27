import { decode } from '@msgpack/msgpack'
import {
  AppBundle,
  AppBundleSource,
  DnaProperties
} from '.'

export type HappProperties = { [role_id: string]: DnaProperties }

const readAppBundleFromPath = async (path: string): Promise<AppBundle> => {
  const isBrowser = typeof window !== 'undefined'
  if (isBrowser) {
    throw new Error('todo')
  }
  const {
    readFile
  }: {
    readFile: (path: string) => Promise<Uint8Array>
  } = require('fs/promises')
  const {
    gunzip
  }: {
    gunzip: (
      buffer: Uint8Array,
      callback: (error: Error | null, result: Uint8Array) => void
    ) => Promise<Uint8Array>
  } = require('zlib')
  const compressed = await readFile(path)
  const encoded: Uint8Array = await new Promise((resolve, reject) =>
    gunzip(compressed, (err, bytes) =>
      err === null ? resolve(bytes) : reject(err)
    )
  )
  return decode(encoded) as AppBundle
}

/// Adds properties to app bundle. Requires node if passed a path.
export const appBundleWithProperties = async (
  source: AppBundleSource,
  properties: HappProperties
): Promise<AppBundleSource> => {
  const originalBundle =
    'path' in source ? await readAppBundleFromPath(source.path) : source.bundle
  return {
    bundle: {
      ...originalBundle,
      manifest: {
        ...originalBundle.manifest,
        roles: originalBundle.manifest.roles.map(roleManifest => ({
          ...roleManifest,
          dna: {
            ...roleManifest.dna,
            properties: properties[roleManifest.id]
          }
        }))
      }
    }
  }
}
