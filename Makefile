.PHONY: test

VERSION:=$(shell npm view '@holochain/conductor-api' version)

get-version:
	@echo 'Version: '${VERSION}

install-hc:
	./install-holochain.sh

test:
	make install-hc
	make test-all

test-all:
	./run-test.sh

#############################
# █░█ █▀█ █▀▄ ▄▀█ ▀█▀ █▀▀ ▄▄ █▀ █▀▀ █▀█ █ █▀█ ▀█▀ █▀
# █▄█ █▀▀ █▄▀ █▀█ ░█░ ██▄ ░░ ▄█ █▄▄ █▀▄ █ █▀▀ ░█░ ▄█
#############################
# How to update holochain?
# make HC_REV="HC_REV" update-hc
# Example use: make HC_REV="f0e38fd9895054115d8755572e29a5d3639f69e6" update-hc
# Note: After running this we should run the tests and check

update-hc:
	make HC_REV=$(HC_REV) update-hc-sha
	git add nixpkgs.nix
	git commit -m hc-rev:$(HC_REV)
	git push origin HEAD

update-hc-sha:
	@if [ $(HC_REV) ]; then\
		echo "⚙️  Updating conductor-api using holochain rev: $(HC_REV)";\
		echo "✔  Replacing rev...";\
		sed -i '3s/.*/REV=$(HC_REV)/' ./install-holochain.sh;\
	else \
		echo "No holo-nixpkgs rev provided"; \
  fi

#############################
# █▀█ █▀▀ █░░ █▀▀ ▄▀█ █▀ █▀▀
# █▀▄ ██▄ █▄▄ ██▄ █▀█ ▄█ ██▄
#############################

release:
	make release-minor
	git checkout -b release-${VERSION}
	git add .
	git commit -m release-${VERSION}
	git push origin HEAD

# use this  to make a minor release 1.1 to 1.2
release-minor:
	npm version minor --force && npm publish

# use this  to make a major release 1.1 to 2.1
release-major:
	npm version major --force && npm publish
