# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## \[Unreleased\]

### Added
- Tests for magic config variables: `window.__HC_LAUNCHER_ENV__` and `window.__HC_ZOME_CALL_SIGNER__`
- Added `SignalType` enum
### Fixed
- Fixes `InstalledAppInfoStatus` type
### Changed
### Removed

## 2025-04-07: v0.19.0-rc.0
### Added
- Call `DumpNetworkStats` was added to Admin + App websockets.
- Call `DumpNetworkMetrics` was added to Admin + App websockets.
### Removed
- Call `NetworkInfo` was removed from the Conductor API.
- Call `GetCompatibleCells` was moved to a feature.

## 2025-03-11: v0.19.0-dev.8

### Changed
- Updates the `AppBundleSource` type according to Holochain PR [#4651](https://github.com/holochain/holochain/issues/4651) and adjusts the tests accordingly.

## 2025-02-20: v0.19.0-dev.7

### Fixed
- Fix DhtOps helper functions `getChainOpType`, `getChainOpAction`, `getChainOpEntry` and `getChainOpSignature` to adhere to the new types
### Changed
- Updated types to the new [enum serialization convention](https://docs.rs/holochain_conductor_api/0.5.0-dev.19/holochain_conductor_api/docs/index.html#enum-serialization-convention). The following types are affected:
  - `SignalType`
  - `CellInfo`
  - `InstallAppRequest`
  - `RoleSettings`
  - `DnaSource`
  - `RegisterDnaRequest`
  - `CoordinatorSource`
  - `AppBundleSource`
  - `AppStatusFilter`
  - `CloneCellId`
  - `GrantedFunctions`
  - `CapAccess`
  - `DnaStorageBlob`

  Enum variants are now consistently `snake_case` and typically distinguished by a `type` attribute, unless for enums with exclusively unit-like variants.

  Example 1:
  ```
  // OLD
  export type AppBundleSource =
    | { bundle: AppBundle }
    | { path: string };

  // NEW
  export type AppBundleSource =
  | {
      type: "path";
      value: string;
    }
  | {
      type: "bundle";
      value: AppBundle;
    };
  ```

  Example 2 (unit-like variants only):
  ```
  // OLD
  export enum AppStatusFilter {
    Enabled = "Enabled",
    Disabled = "Disabled",
    Running = "Running",
    Stopped = "Stopped",
    Paused = "Paused",
  }

  // NEW
  export enum AppStatusFilter {
    Enabled = "enabled",
    Disabled = "disabled",
    Running = "running",
    Stopped = "stopped",
    Paused = "paused",
  }
  ```

## 2024-11-28: v0.19.0-dev.6
### Added
### Fixed
### Changed
- Change `InstallAppRequest` type to adhere to the new format that includes the `roles_settings` field and removes
the `membrane_proofs` field as membrane proofs are now specified as part of the `roles_settings`.
### Removed

## 2024-11-21: v0.19.0-dev.5
### Changed
- Simplify zome call parameters. `cap_secret`, `provenance` and `payload` are optional parameters of a `CallZomeRequest`. If implicit zome call signing is used, which happens when calling a zome with a `CallZomeRequest`, `provenance` and `cap_secret` are automatically set with the authorized signing credentials. It is still possible to call a cell by its role name instead of its cell id. Alternatively to passing in a `CallZomeRequest`, `callZome` can be invoked with a signed request `CallZomeRequestSigned`, where the zome call parameters have already been serialized and signed.

## 2024-11-21: v0.19.0-dev.4
### Fixed
- Bring back optional cap_secret to zome call parameters.

## 2024-11-20: v0.19.0-dev.3
### Changed
- Zome call signing has been changed in Holochain to remove the requirement of imitating Holochain serialization. Signing is now a simplified process of serializing zome call parameters using MessagePack, then computing a SHA2 512-bit hash of the serialized bytes and signing the hash. The zome call payload consists of the serialized bytes and the signature.

## 2024-11-12: v0.19.0-dev.2
### Added
- AppWebsocket calls to interact with countersigning sessions, i.e. `GetCountersigningSessionState` as well as `AbandonCountersigningSession` and `PublishCountersigningSession` when a session could not be resolved automatically. Countersigning is an unstable feature which must explicitly be enabled in Holochain.

## 2024-10-28: v0.19.0-dev.1
### Added
- Bring back a websocket reconnection automation for Admin and App websockets. When either of them is closed and a new request made, it will attempt to reconnect using the same app authentication token that was used to initially authenticate the websocket. A specific `InvalidTokenError` is returned if that fails.

## 2024-10-09: v0.19.0-dev.0
### Changed
- Update to Holochain 0.5.0-dev.0

## 2024-09-30: v0.18.0-dev.12
### Fixed
- Type `RevokeAgentKeyResponse`, which returns an array of tuples with cell id and error message for all cells that key revocation failed for.

## 2024-09-30: v0.18.0-dev.12
### Added
- Admin API call `RevokeAgentKey`.

## 2024-09-26: v0.18.0-dev.11
### Added
- Util function to compare two cell ids `isSameCell`.
### Changed
- **BREAKING**: Clone cell ids have changed from accepting a `CellId` to a `DnaHash`.

## 2024-08-05: v0.18.0-dev.10
### Changed
- Signal listeners changed from only returning an `AppSignal` to a `Signal` which can be either an app or system signal.

## 2024-08-05: v0.18.0-dev.8
### Changed
- Revert addition of @hc-spartan/holo-hash. Hashes were used inconsistently and lead to wrong types for return values.

## 2024-07-23: v0.18.0-dev.7
### Changed
- **BREAKING**: Use package @spartan-hc/holo-hash for managing hashes, instead of custom functions. `AgentPubKey` is a new type now instead of a `Uint8Array`.

## 2024-07-16: v0.18.0-dev.6
### Added
- New value `NotStartedAfterProvidingMemproofs` for type `DisabledAppReason` which effectively allows a new app status, corresponding to the specific state where a UI has just called AppRequest::ProvideMemproofs, but the app has not yet been enabled for the first time.
- New `AppWebsocket` call `EnableAfterMemproofsProvided`, which allows enabling an app only if the app is in the `AppStatus::Disabled(DisabledAppReason::NotStartedAfterProvidingMemproofs)` state. Attempting to enable the app from other states (other than Running) will fail.
- New field `lineage` to the DNA manifest, which declares forward compatibility for any hash in that list with this DNA.
- New `AdminWebsocket` call `GetCompatibleCells`, which returns `CellId` for all installed cells which use a DNA that is forward-compatible with a given DNA hash. This can be used to find a compatible cell for use with the UseExisting cell provisioning method.

## 2024-07-09: v0.18.0-dev.5
### Fixed
- Hash part utility functions for core hash and DHT location. Both were using an incorrect number of bytes.

## 2024-06-27: v0.18.0-dev.4

### Added
- Added missing `base` field to the `Link` type. This exists in Holochain but wasn't present in the client.

### Changed
### Fixed
- Refer to type, not `this` in a static context to fix a bug in the `AppWebsocket` that would result in `this.requester is not a function` when the client is used in as JavaScript environment.

### Removed

## 2024-06-13: v0.18.0-dev.3
### Changed
- `DhtOp` was split into `ChainOp` and `WarrantOp` in Holochain.

## 2024-06-11: v0.18.0-dev.2
### Added
- New call `AppRequest::ProvideMemproofs`. An app can be installed with deferred membrane proofs, which can later be provided through this call.

## 2024-05-10: v0.18.0-dev.1
### Added
- App id to `AppClient` and `AppWebsocket`.
- Optional function parameter for a custom zome transformer in `AppWebsocket`.

## 2024-05-02: v0.18.0-dev.0
### Added
- Test for Rust enum serialization.
### Changed
- **BREAKING** Update enum serialization to match [changed Conductor API serialization format](https://github.com/holochain/holochain/blob/develop/crates/holochain/CHANGELOG.md#040-dev1).

## 2024-04-27: v0.17.0-dev.12
### Fixed
- Invalid module references which caused the client to fail to import in Node environments.

## 2024-04-26: v0.17.0-dev.11
### Changed
- **BREAKING** Changed `Appwebsocket.connect()` to take a single parameter `AppWebsocketConnectionOptions` that includes the `AppAuthenticationToken` as an optional property. The `AppAuthenticationToken` can be omitted if it is provided by the `window.__HC_LAUNCHER_ENV__` variable.
- **BREAKING** The legacy  framework specific zome call signing methods `signZomeCallTauri` and `signZomeCallElectron` have been removed. Runtimes like Launcher now mandatorily need to provide a `window.__HC_ZOME_CALL_SIGNER__` object to have zome calls be automatically signed.
- New optional parameter to `attachAppInterface` to bind the app interface to a specific app.
- **BREAKING** The admin call `listAppInterfaces` now returns a list of `AppInterfaceInfo` instead of a list of ports.

## 2024-04-25: v0.17.0-dev.10
### Added
- **BREAKING** Connecting an app websocket now requires an authentication token which can be obtained from the admin
  websocket using `AdminWebsocket#issueAppAuthenticationToken`.

### Changed
- **BREAKING** Merged the app and app-agent websockets into a single `AppWebsocket` class. Following the addition of the
  authentication token, the two types were well enough aligned that there was no longer a need to keep them separate.
- **BREAKING** App calls that previously required an `InstalledAppId` no longer require one because the websocket will
  be authenticated with an app already, so the app interface no longer requires you to tell it which app you are calling.

## 2024-04-16: v0.17.0-dev.9
### Fixed
- Replace all IPv4 addresses `127.0.0.1` by `localhost`.

## 2024-04-05: v0.17.0-dev.8
### Changed
- Websocket client: Specify `origin` parameter when establishing app websocket connections to protect localhost from cross origin attacks in browser scripts.
- Websocket client: Add `allowed_origins` parameter to `AdminWebsocket.attachAppInterface` to specify allowed origins.
- Consistently throw `HolochainError`s throughout with specific error names and messages.

## 2024-02-27: v0.17.0-dev.7
### Fixed
- Type: `AppInfoResponse` can be `null` if the requested app is not found.

## 2024-02-23: v0.17.0-dev.6
### Changed
- **BREAKING**: `Websocket.connect()` functions' mandatory `url` parameter is replaced by an optional options object, which contains optional properties `url` and `defaultTimeout`. Calling `connect` if the url is not defined by parameter, nor by launcher environment will throw an error. Order of parameters in the `AppAgentWebsocket.connect` function is changed, so the required parameter goes first.

## 2024-02-02: v0.17.0-dev.5
### Fixed
- Work around cell_id being a proxy object in Vue.

## 2024-01-27: v0.17.0-dev.4
### Changed
- Decouple host zome call signer from environment. Now a zome call signer can be provided separatedly from the environment that the client is used in.

## 2023-11-29: v0.17.0-dev.3
### Added
- Utility functions for slicing hashes into their components: `sliceHashType`, `sliceCore32`, `sliceDhtLocation`
- Utility functions for generating hashes from components: `dhtLocationFrom32`, `hashFrom32AndType`:
### Changed
- Utility functions fakeAgentPubKey, fakeEntryHash, fakeActionHash and fakeDnaHash now generate *valid* hashes with a valid final 4 bytes
- Utility functions fakeAgentPubKey, fakeEntryHash, fakeActionHash and fakeDnaHash now optionally take a single parameter `coreByte` which if defined will be repeated for all core 32 bytes of the hash

## 2023-11-22: v0.17.0-dev.2
### Fixed
- Action type `CreateLink`: Add field `link_type`.

## 2023-11-16: v0.17.0-dev.1
### Added
- Type `Link` to HDK and a confirmatory test.

## 2023-11-08: v0.17.0-dev.0
### Changed
- **BREAKING CHANGE**: Conductor API ser/deserialization has changed on Holochain side. Tags are serialized like `{ type: { app_info: null } }` now, when before it was `{ type: "app_info" }` for requests and responses.

## 2023-10-17: v0.16.3
### Fixed
- `CapAccess` types `Unrestricted` and `Transferable` were not correctly implemented. Both need to be nested objects containing a single property with a Pascal cased name, e. g. `{ access: { Unrestricted: null } }`.
- `AttachAppInterfaceRequest` took a mandatory property `port`. The property is optional now.
### Removed
- Dropped support for Node.js v16 after its end-of-life.

## 2023-09-19: v0.16.2
### Added
- Support for signing zome calls in electron via `window.electronAPI.signZomeCall` when `__HC_LAUNCHER_ENV__.ENVIRONMENT == 'electron'`.
### Fixed
- `DnaProperties` in `DnaModifiers` changed to `Uint8array` as it comes back serialized from Holochain.

## 2023-09-05: v0.16.1
### Changed
- Update `InstallAppRequest` with new optional field `ignore_genesis_failure`.

## 2023-08-07: v0.16.0
### Added
- When generating a signing key pair, a new optional argument can be passed in to copy the last 4 bytes (= DHT location bytes) of the original agent pub key.
### Changed
- **BREAKING CHANGE**: Swap cryptographic package from `noble/ed25519` to `libsodium`. This lead to helper functions become async and some type changes.
- **BREAKING CHANGE**: Set type of `Memproof` to `Uint8array` instead of `Buffer` which is specific to Node.js.

## 2023-08-02: v0.15.1
### Added
- Export functions to check if a role name is a clone id.
### Fixed
- In Vue projects reactivity broke signal functionality provided by Emittery. A pointer to `this` which Emittery relies on becomes undefined. Until the bug is fixed upstream in Emittery, the workaround is to bind all its methods manually after instantiating an agent websocket.

## 2023-06-16: v0.15.0
### Added
- When making a WsClient request, reconnect websocket in case it's closed.
### Changed
- **BREAKING CHANGE**: Refactor client and websocket classes to use URLs instead of strings.
- **BREAKING CHANGE**: Error responses from Holochain are thrown as instance of new class `HolochainError` which extends `Error`.

## 2023-05-04: v0.14.1
### Fixed
- Import crypto module conditionally when in Node.js environment. For browsers and bundlers no module import is required and the Web API module is used. Add
```javascript
...
    externals: {
        "node:crypto": {}
    },
...
```
to Webpack config.

## 2023-05-01: v0.14.0
### Changed
- Set default timeout for API calls to 60 seconds, formerly 15 seconds.
- **BREAKING CHANGE**: Replace NPM package "tweetnacl" with "@noble/ed25519". "tweetnacl" produced errors with bundlers and hasn't been updated in a longer time.
### Fixed
- **BREAKING CHANGE**: Update params of `NetworkInfoRequest`.

## 2023-04-15: v0.13.0
### Added
- Add new Admin API endpoint `storageInfo`.
- Add new Admin API endpoint `dumpNetworkStats`.
- Add new Admin API endpoint `updateCoordinators` to update coordinator zomes in an already installed hApp.
### Changed
- Update response type `NetworkInfo`.

## 2023-03-01: v0.12.5
### Fixed
- Replace event listener method `.on("close")` by `.onclose`. `.on` is not compatible with Web API's WebSocket.

## 2023-03-01: v0.12.4
### Fixed
- When app websocket closes, reject pending requests.

## 2023-02-24: v0.12.3
### Changed
- Throw an error when calling zome with role name and provenance from `AppAgentWebsocket`. Role names can only be used with own agent, not for other agents.

## 2023-02-13: v0.12.2
### Added
- Function to generate a fake DNA hash.
### Changed
- Switch to Nix flake for develop environment. Run `nix develop` from now on instead of `nix-shell`. Pass on `--extra-experimental-features nix-command --extra-experimental-features flakes` or enable these features for your user in [`~/.config/nix/nix.conf`](https://nixos.org/manual/nix/stable/command-ref/conf-file.html#conf-experimental-features).

## 2023-02-07: v0.12.1
### Changed
- Update `NetworkInfo` types.

## 2023-01-27: v0.12.0
Compatible with Holochain v0.1.0

- No changes; minor version bump.

## 2023-01-25: v0.11.16
### Changed
- Refactor AppAgentWebsocket to directly get the agent pub key from app info.

## 2023-01-23: v0.11.15
### Added
- Return additional field `agent_pub_key` in `AppInfo`.
### Changed
- **BREAKING CHANGE**: The resources field of bundles was changed from `Array<number>` to `Uint8Array`.
- **BREAKING CHANGE**: `CreateCloneCell` returns `ClonedCell` instead of `InstalledCell`.
- **BREAKING CHANGE**: `EnableCloneCell` returns `ClonedCell` instead of `InstalledCell`.
- **BREAKING CHANGE**: Remove unused call `AdminRequest::StartApp`.
- **BREAKING CHANGE**: `Cell` is split up into `ProvisionedCell` and `ClonedCell`.
- **BREAKING CHANGE**: `CellInfo` variants are renamed to snake case during serde.

## 2023-01-19: v0.11.14
### Added
- API generation, available under ./docs
### Changed
### Fixed
- Cell provisioning strategy type in AppBundle.
### Removed
- TypeScript source maps.

## 2023-01-16: v0.11.13
### Fixed
- Access `Blob` from window for browser apps (fixes error with Nodejs v16).

## 2023-01-16: v0.11.12
### Fixed
- Cell id log when no signing credentials are present for a cell.

## 2023-01-11: v0.11.11
### Changed
- Refactor util functions that depend on crypto to async import.

## 2023-01-11: v0.11.10
### Removed
- Deprecated parameter `signalCb` from `WsClient` and `AppWebsocket`.
### Changed
- All Launcher environment properties to be optional.
### Fixed
- Types belonging to AppManifest.
- Add pending request from client after processing response.

## 2022-12-23: v0.11.9
### Added
- Introduce `GrantedFunctionsType` to reflect newly added wildcard option for all zomes and functions.
### Changed
- Simplify `authorizeSigningCredentials` by making functions an optional parameter and defaulting to all zomes and functions.

## 2022-12-21: v0.11.8
### Changed
- Move signing functions to corresponding modules and simplify fn signZomeCall.

## 2022-12-21: v0.11.7
### Changed
- AppAgentWebsocket constructor is private now and follows the same pattern to instantiate through `connect` as the other websockets.

## 2022-12-21: v0.11.6
### Fixed
- Revert launcher refactors that introduced problems.

## 2022-12-20: v0.11.5
### Fixed
- tauri-apps bug which came out of the blue.

## 2022-12-20: v0.11.4
### Changed
- Tidy up signing module & export functions for signing.

## 2022-12-20: v0.11.3
### Fixed
- Serialization package issue.

## 2022-12-20: v0.11.2
### Removed
- Deprecated API calls.
### Fixed
- Type definition of functions in `authorizeNewSigningKeyPair`.
- Problem with rolling up serialization package.

## 2022-12-19: v0.11.1
### Removed
- property `provenance` from `AppAgentCallZomeRequest`.

## 2022-12-18: v0.11.0
### Added
- Low-level functions to generate and authorize signing keys and to sign zome calls with them.
- High-level function to handle key generation and zome call signing automatically.
### Removed
- **BREAKING CHANGE**: Remove call `install_app`.
### Changed
- **BREAKING CHANGE**: Upgrade to Holochain v0.1.0-beta-rc.1
- **BREAKING CHANGE**: Require all zome calls to be signed.
- **BREAKING CHANGE**: Rename `install_app_bundle` to `install_app`.
- **BREAKING CHANGE**: Rename `archive_clone_cell` to `disable_clone_cell`.
- **BREAKING CHANGE**: Rename `restore_archived_clone_cell` to `enable_clone_cell`.
- **BREAKING CHANGE**: Move `enable_clone_cell` to App API.
- **BREAKING CHANGE**: Refactor `delete_clone_cell` to delete a single disabled clone cell.
- **BREAKING CHANGE**: Refactor `app_info` to return all cells and DNA modifiers.
- **BREAKING CHANGE**: Rename `request_agent_info` to `agent_info`.
- AppAgentWebsocket constructor uses launcher env.INSTALLED_APP_ID when present

## 2022-12-14: v0.10.4
### Changed
- Remove fetch to launcher-env.json and replace it with `window.__HC_LAUNCHER_ENV__`.

## 2022-12-12: v0.10.3
### Changed
- Use lodash-es instead of lodash

## 2022-12-08: v0.10.2
### Fixed
- Missing export of AppAgentWebsocket

## 2022-12-08: v0.10.1
### Fixed
- Switch event emitter package from "events" to "Emittery".

## 2022-12-07: v0.10.0
### Added
- Interface AppAgentClient, along with a class that implements that interface AppAgentWebsocket as part of work to unify the holochain and holo client apis. Happ devs will now be able to write the majority of their client code using the AppAgentClient interface, completely agnostic as to whether they're in a pure holochain or holo context.
- Add App API call `gossip_info`, which returns progress data on historical gossip.
- Update to holochain 0.0.175, hdk 0.0.163 which includes all the breaking change renames

## 2022-11-02: v0.9.3
### Added
- Add Admin API call `getDnaDefinition`, which returns the DNA definition for a given DNA hash.

### Changed
- Upgrade to Holochain v0.0.170

### Fixed
- Fix AppEntryType type definition, leading to wrong deserialization.

## 2022-09-30: v0.9.2
### Fixed
- Response type for request `RestoreCloneCell` set to `InstalledCell`.

## 2022-09-30: v0.9.1
### Added
- Expose clone id class.

## 2022-09-30: v0.9.0
### Added
- Added calls for clone cell management:
  - App API: create clone cell
  - App API: archive clone cell
  - Admin API: restore clone cell
  - Admin API: delete archived clone cells
- Added utility class `CloneId`

### Changed
- **BREAKING CHANGE**: `RegisterDnaRequest` parameters have changed in Conductor API.
- Upgraded `isomorphic-ws` to v5.0.0 which provides native ES modules.

## 2022-08-24: v0.8.0

### Changed
- Updated `uid` to `network_seed` after name change in Holochain.

## 2022-08-01: v0.7.0

### Added
- Main entry points in `package.json` for CommonJS and ECMA modules.

### Removed
- BREAKING: `bundle.ts` module, which was Nodejs-specific and not compatible with browser-based clients.

### Fixed
- Update link to launcher in comment (#123).
- Cater for some edge cases for function `getDhtOpAction` (#122).

## 2022-07-08: v0.6.0

### Changed
- Use more specific type `DnaHash` in `CellId` [PR \#120](https://github.com/holochain/holochain-client-js/pull/120)
- Change argument `appInfoTransform` of `appInfo` to take an `AppWebsocket` [PR \#121](https://github.com/holochain/holochain-client-js/pull/121)

### Fixed
- fix(type): use entry type for record [PR \#119](https://github.com/holochain/holochain-client-js/pull/119)

## 2022-07-05: v0.5.0

### Added

- Type `Record` and `RecordEntry`

### Changed

- Updates nomenclature in types from Header/Element to Action/Record as per changes from holochain 0.0.145 [PR \#117](https://github.com/holochain/holochain-client-js/pull/117)
- Update test fixture to holochain 0.0.147 [PR \#117](https://github.com/holochain/holochain-client-js/pull/117)

## 2022-06-07: v0.4.3

### Fixed

- Correct field name `hashed` in Header [\#113](https://github.com/holochain/holochain-client-js/pull/113)

## 2022-06-07: v0.4.1

### Changed

- Convert module import to URL schema in lazy imports. [\#111](https://github.com/holochain/holochain-client-js/pull/111)

## 2022-06-07: v0.4.0

### Changed

- Converted to pure ES module (dropped CommonJS support)

## 2022-01-20: v0.3.2

### Added
- ES module support

## 2022-01-13: v0.3.1

### Fixed
- Export all common types [#96](https://github.com/holochain/holochain-client-js/pull/96)

## 2022-01-12: v0.3.0

### Added
- Adding types and `dump full state` call [#94](https://github.com/holochain/holochain-conductor-api/pull/94)

### Removed
- Everything that's not needed to use the library, run tests or publish the npm package
### Changed
- Renamed package to @holochain/client and repository to holochain-client-js
- Use git tag instead of revision SHA for version mentions [#92](https://github.com/holochain/holochain-conductor-api/pull/92)
- Updated to Holochain v0.0.121 and HDK v0.0.117
### Fixed
- Failed tests cause non-zero exit code [#93](https://github.com/holochain/holochain-conductor-api/pull/93)
## 2021-10-28: v0.2.3

### Fixed
- It now works in a browser context. 0.2.2 introduced an exception in the browser context by improperly checking for a node specific variable. [#88](https://github.com/holochain/holochain-conductor-api/pull/88)

## 2021-10-28: v0.2.2

### Fixed
- We now safely ignore system signals instead of breaking upon receiving them [#84](https://github.com/holochain/holochain-conductor-api/pull/84)
- Launcher autodetection now works properly in jest environments [#85](https://github.com/holochain/holochain-conductor-api/pull/85)

## v0.2.1
### Added
- Adds support for UninstallApp which is available in holochain 0.0.106
- Adds support for automatically detecting Launcher run context for overriding installedApi

## 2021-07-09: v0.2.0
### Added
- Add new admin conductor api endpoints - EnableApp, StartApp and DisableApp
### Changed
- Deprecated admin conductor api endpoints: ActivateApp & DisactivateApp

## 2021-07-09: v0.1.1
### Added
- Change log
### Fixed
- Downstream compilation issues when using rollup and typescript (adds an esmodules compilation target to dist)
