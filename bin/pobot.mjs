#!/usr/bin/env node

import { Pobot } from "../Pobot.mjs";

const [bin, script, ...args] = process.argv;

(async () => {
	const pobot = await Pobot.get(args);
	await pobot.run(args);
	await pobot.close();
	await pobot.kill();
	console.error('Done.');
})();
