const os     = require('os');
const fsp    = require("fs").promises;
const cl     = require('chrome-launcher');
const cdp    = require('chrome-remote-interface');
const rimraf = require("rimraf");

const path = os.tmpdir() + '/.chrome-user';

const chromeFlags = {
	'--no-sandbox':          true
	, '--hide-scrollbars':   true
	, '--enable-automation': true
};

const [bin, script, ...args] = process.argv;

while(args.length)
{
	if(!args[0].match(/^--/))
	{
		break;
	}

	const [chromeFlag, flagValue = true] = args.shift().split('=');

	chromeFlags[ chromeFlag ] = flagValue;
}

const flagArray = Object.keys(chromeFlags).map((key)=>{
	if(chromeFlags[key] === true)
	{
		return key;
	}
	else if(chromeFlags[key] === 'FALSE')
	{
	return '';
	}

	return `${key}=${chromeFlags[key]}`
});

fsp.access(path).then((error)=>{
	// return new Promise((accept)=>{
	// 	rimraf(path, ()=>{
	// 		fsp.mkdir(path).then(()=>{accept()});
	// 	})
	// });
}).catch((error)=>{
	return fsp.mkdir(path);
}).then(()=>{
	console.error(`${path} created...`);

	return cl.launch({
		chromeFlags: flagArray
		, userDataDir: path
		, logLevel: 'verbose'
		, envVars: {
			HOME : path
			, DISPLAY: ':0'
		}
	});
}).then(chrome => {

	port = chrome.port;

	console.error(`Started chrome, connecting on port ${port}...\n`);

	return cdp({port:chrome.port}).then((client)=>{
		return {chrome, client};
	});

}).then(({chrome, client})=>{
	let {Network, Page} = client;

	client.inject  = (injection,args=[]) => {

		let expressionWrapper = `(()=> {
			let ret = (${injection})(...${JSON.stringify(args)});

			if(ret instanceof Promise)
			{
				return ret;
			}
			else if(typeof ret === 'object')
			{
				return JSON.stringify(ret)
			}
			else
			{
				return ret;
			}
		})()`;

		return client.Runtime.evaluate({
			awaitPromise: true
			, expression:expressionWrapper
		}).then((response)=>{
			return response.result.value;
		}).catch(error => console.error(error));
	};

	client.goto = (url) => Page.navigate({url}).then(()=> Page.loadEventFired());

	Page.enable().then(()=> Network.enable()).then(()=>{

		let iterate = () => {
			if(!args.length)
			{
				console.error(`closing chrome...\n`);
				client.close();
				chrome.kill();

				return;
			}

			let name;

			while(!name)
			{
				name = args.shift();
			}

			let routine = require(name);

			console.error(`Running ${name}...`);

			routine(client, args).then((result)=>{

				console.error(`Done with ${name}.`);

				console.log(JSON.stringify(result));

				iterate();
			}).catch((error) => {
				console.error(`Error! ${JSON.stringify(error)}`);

				client.close();
				chrome.kill();

				process.exitCode = 1;

				return;
			});
		};

		iterate();
	});

}).catch(error => {
	console.error(error);
});

