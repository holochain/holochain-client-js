# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## \[Unreleased\]

### Added
- When generating a signing key pair, a new optional argument can be passed in to copy the last 4 bytes (= DHT location bytes) of the original agent pub key.
### Changed
- **BREAKING CHANGE**: Swap cryptographic package from `noble/ed25519` to `libsodium`. As a consequence, helper functions become async and some types changed.
- **BREAKING CHANGE**: Set type of `Memproof` to `Uint8array` instead of `Buffer` which is specific to Node.js.
### Fixed
### Removed

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
