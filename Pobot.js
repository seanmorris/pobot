const cl  = require('chrome-launcher');
const cdp = require('chrome-remote-interface');

const os  = require('os');
const fsp = require("fs").promises;

const rimraf = require("rimraf");

const path = os.tmpdir() + '/.chrome-user';

const chromeFlags = {
	'--no-sandbox':          true
	, '--hide-scrollbars':   true
	// , '--enable-automation': true
	// , '--blink-settings':    'imagesEnabled=true'
	// , '--disable-gpu':       false
	// , '--headless':          false
	// , '--proxy-server=socks5://localhost:8000'
};

module.exports = class 
{
	constructor(client, chrome)
	{
		this.client = client;
		this.chrome = chrome;
	}

	static get(args)
	{
		return new Promise((accept, reject) => {
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
				else if(chromeFlags[key] === 'FALSE' || chromeFlags[key] === false)
				{
					return '';
				}

				return `${key}=${chromeFlags[key]}`
			});

			fsp.access(path).then((error)=>{
		
				// console.error(`Userdir ${path} cleaned...`);
				
				return new Promise((accept)=>{
					rimraf(path, ()=>{
						fsp.mkdir(path).then(()=> accept() );
					})
				});

			}).catch((error)=>{

				return fsp.mkdir(path);

			}).then(()=>{
		
				// console.error(`Userdir ${path} created...`);

				return cl.launch({
					chromeFlags: flagArray
					, userDataDir: path
					, envVars: {HOME : path, DISPLAY: ':0'}
					// , logLevel: 'verbose'
				});

			}).then(chrome => {

				const port = chrome.port;

				// console.error(`Started Chrome, connecting on port ${port}...\n`);

				return cdp({port:chrome.port}).then((client)=>{
					return {chrome, client};
				});

			}).then(({chrome, client})=>{

				return client.Page.enable()
					.then(()=> client.Network.enable())
					.then(()=> accept(new this(client, chrome)));
			});
		});
	}

	run(args)
	{
		let iterate = () => {
			if(!args.length)
			{
				this.close();
				return;
			}

			let name;

			while(!name)
			{
				name = args.shift();
			}

			console.error(`Running ${name}...`);

			let routine = require(process.cwd() + '/' + name);

			routine(this, args).then((result)=>{

				console.error(`Done with ${name}.`);

				if(result !== undefined)
				{
					console.log(JSON.stringify(result));
				}

				iterate();
			}).catch((error) => {
				console.error(`Error! ${JSON.stringify(error)}`);

				this.close();

				process.exitCode = 1;

				return;
			});
		};

		return iterate();
	}

	goto(url)
	{
		return this.client.Page.navigate({url})
			.then(()=> this.client.Page.loadEventFired());
	}

	loaded()
	{
		return this.client.Page.loadEventFired();
	}

	inject(injection, ...args)
	{
		const expression = `(()=> {
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

		return this.client.Runtime.evaluate({ expression, awaitPromise: true })
			.then( response => response.result.value)
			.catch( error => console.error(error));
	}

	close()
	{
		// console.error(`Closing Chrome...\n`);
		this.client.close();
		this.chrome.kill();
	}
};

return module;
