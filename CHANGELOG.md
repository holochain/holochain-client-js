# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## \[Unreleased\]

### Added
### Removed
### Changed
### Fixed

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
