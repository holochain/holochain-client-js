lair:
	mkdir -p ./test/tmp
	rm -rf ./test/tmp/*
	mkdir -p ./test/tmp/shim
	RUST_LOG=trace lair-keystore --lair-dir test/tmp/keystore  &> hc-lair.log &

stop-lair:
	killall lair-keystore &

conductor:
	RUST_LOG=debug npx holochain-run-dna -c ./test/app-config.yml -a 4444 -r ./test/tmp -k shim  &> hc-conductor.log &

stop-conductor:
	npm run stop-conductor

shim:
	node ./test/shim/shim.js &

test-bug: stop-lair stop-conductor
	make lair
	sleep 2
	make shim
	make conductor
	sleep 5
	npm run test-bug
