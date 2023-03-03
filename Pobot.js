"use strict";

const cl  = require('chrome-launcher');
const cdp = require('chrome-remote-interface');

const os  = require('os');
const fs  = require("fs");
const fsp = fs.promises;

const rimraf = require("rimraf");

const userDataDir = os.tmpdir() + '/.chrome-user';

const chromeFlags = {
	'--no-sandbox':        true
	, '--hide-scrollbars': true
	// , '--enable-automation': true
	// , '--blink-settings':    'imagesEnabled=true'
	// , '--disable-gpu':       false
	// , '--headless':          false
	// , '--proxy-server=socks5://localhost:8000'
};

const keyCodes = {"0":48,"1":49,"2":50,"3":51,"4":52,"5":53,"6":54,"7":55,"8":56,"9":57,"d":68,"b":66,"a":65,"s":83,"i":73,"f":70,"k":75,"ß":219,"Dead":220,"+":187,"ü":186,"p":80,"o":79,"u":85,"z":90,"t":84,"r":82,"e":69,"w":87,"g":71,"h":72,"j":74,"l":76,"ö":192,"ä":222,"#":191,"y":89,"x":88,"c":67,"v":86,"n":78,"m":77,",":188,".":190,"-":189,"ArrowRight":39,"ArrowLeft":37,"ArrowUp":38,"ArrowDown":40,"PageDown":34,"Clear":12,"Home":36,"PageUp":33,"End":35,"Delete":46,"Insert":45,"Control":17,"AltGraph":18,"Meta":92,"Alt":18,"Shift":16,"CapsLock":20,"Tab":9,"Escape":27,"F1":112,"F2":113,";":188,":":190,"_":189,"'":191,"*":187,"Q":81,"W":87,"E":69,"R":82,"T":84,"Z":90,"S":83,"A":65,"D":68,"I":73,"U":85,"O":79,"Y":89,"X":88,"C":67,"F":70,"V":86,"G":71,"B":66,"H":72,"N":78,"J":74,"M":77,"K":75,"L":76,"P":80,"Ö":192,"Ä":222,"Ü":186,"!":49,"\"":50,"§":51,"$":52,"%":53,"&":54,"/":55,"(":56,")":57,"=":48,"?":219,"°":220};

module.exports = class
{
	constructor(client, chrome)
	{
		this.client = client;
		this.chrome = chrome;

		this.pending = new Set;
		this.injectCount = 0;
	}

	static get(args)
	{
		const flags = {};

		while(args.length)
		{
			if(!args[0].match(/^--/))
			{
				break;
			}

			const [flag, flagValue = true] = args.shift().split('=');

			flags[ flag ] = flagValue;
		}

		const chromeFlags = Object.keys(flags).map((key) => {
			if(flags[key] === true)
			{
				return key;
			}
			else if(flags[key] === 'FALSE' || flags[key] === false)
			{
				return '';
			}

			return `${key}=${flags[key]}`;
		});

		const checkPath = fsp.access(userDataDir);

		checkPath.catch(() => fsp.mkdir(userDataDir));

		const createPath = Promise.allSettled([checkPath]).then(() => {
			try
			{
				return rimraf(userDataDir, () => fsp.mkdir(userDataDir));
			}
			catch(error)
			{
				return fsp.mkdir(userDataDir);
			}
		});

		createPath.catch(() => console.error(`Could not create userDataDir "${userDataDir}"`));

		const envVars   = {HOME: userDataDir, DISPLAY: ':0'};
		const launch    = createPath.then(() => cl.launch({chromeFlags, userDataDir, envVars}));
		const getClient = launch.then(chrome => cdp({port:chrome.port}).then(client => [chrome, client]));

		return getClient.then(
			([chrome, client]) => client.Page.enable()
			.then(()=> client.Network.enable())
			.then(()=> client.Runtime.enable())
			.then(()=> new this(client, chrome))
		);
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

			routine(this, args).then((result) => {

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
		return this.client.Page.navigate({url}).then(()=> this.client.Page.loadEventFired());
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

		return this.client.Runtime.compileScript({ expression, sourceURL: `<injection#${this.injectCount++}>`, persistScript: true })
		.then(script => this.client.Runtime.runScript({scriptId: script.scriptId, awaitPromise:true}))
		.then(response => {
			if(response.exceptionDetails)
			{
				throw response;
			}
			return response.result.value;
		});
	}

	startCoverage()
	{
		return this.client.Profiler.setSamplingInterval({interval:1})
		.then(() => this.client.Profiler.enable())
		.then(() => this.client.Profiler.startPreciseCoverage({callCount: true, detailed: true}));
	}

	type(keys, delay = 10)
	{
		if(typeof keys === 'string')
		{
			keys = keys.split('');
		}

		let i = 0;

		while(keys.length)
		{
			if(!(keys[0] in keyCodes))
			{
				console.error(`No key found for identifier "${keys[0]}"`);
			}

			const key = keys[0];
			const keyCode = keyCodes[ key ];

			setTimeout(() => this.client.Input.dispatchKeyEvent({
				type: 'keyDown',
				key:  key,
				code: key,
				text: key,
				nativeVirtualKeyCode:  keyCode,
				windowsVirtualKeyCode: keyCode
			}), delay * ++i);

			setTimeout(() => this.client.Input.dispatchKeyEvent({
				type: 'keyUp',
				key:  key,
				code: key,
				text: key,
				nativeVirtualKeyCode:  keyCode,
				windowsVirtualKeyCode: keyCode
			}), delay * ++i);

			keys = keys.slice(1);
		}

		return new Promise(accept => setTimeout(accept, delay * i + 1));
	}

	click(x, y, delay = 10, {buttons = 0x1, endX, endY} = {})
	{
		let i = 0;

		const button = 0x1 & buttons ? 'left' : (0x2 & buttons ? 'right' : 'none');

		setTimeout(() => this.client.Input.dispatchMouseEvent({
			type: 'mousePressed', x, y, buttons, button
		}), delay * ++i);

		if(endX && endY)
		{
			setTimeout(() => this.client.Input.dispatchMouseEvent({
				type: 'mouseMoved', x:endX, y:endY, buttons, button
			}), delay * ++i);


			setTimeout(() => this.client.Input.dispatchMouseEvent({
				type: 'mouseReleased', x:endX, y:endY, buttons, button
			}), delay * ++i);
		}
		else
		{
			setTimeout(() => this.client.Input.dispatchMouseEvent({
				type: 'mouseReleased', x, y, buttons, button
			}), delay * ++i);
		}


		return new Promise(accept => setTimeout(accept, delay * ++i));
	}

	takeCoverage()
	{
		return this.client.Profiler.takePreciseCoverage();
	}

	stopCoverage()
	{
		return this.client.Profiler.stopPreciseCoverage();
	}

	close()
	{
		return this.client.close();
	}

	kill()
	{
		return this.chrome.kill();
	}
};

return module;
