# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## \[Unreleased\]

### Added
### Removed
### Changed
### Fixed
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
