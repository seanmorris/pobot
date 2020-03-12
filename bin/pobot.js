#!/usr/bin/env node

const [bin, script, ...args] = process.argv;

const Pobot = require('../Pobot');

Pobot.get(args).then(pobot => pobot.run(args)).then(()=>{

	console.log('Done.');

});
