const os  = require('os');
const cl  = require('chrome-launcher');
const cdp = require('chrome-remote-interface');
const fs  = require("fs");
const fsp = fs.promises;
const rimraf = require("rimraf");

const CallBindings = Symbol('CallBindings');

const defaultUserDataDir = os.tmpdir() + '/.chrome-user';

module.exports = class
{
	hasBindings = false;
	bindings    = new Map;

	constructor({userDataDir, chromePath}={})
	{
		this.userDataDir = userDataDir || defaultUserDataDir;
		this.chromePath  = chromePath;

		Object.defineProperty(this, 'type',     {value: 'chrome'});
		Object.defineProperty(this, 'bindings', {value: new Map});
		this.hasBindings = false;
	}

	getClient({chromeFlags, envVars})
	{
		const createPath = new Promise(accept => {
			try
			{
				return rimraf(this.userDataDir, () => accept(fsp.mkdir(this.userDataDir)));
			}
			catch(error)
			{
				return accept(fsp.mkdir(this.userDataDir));
			}
		})
		.catch(() => console.error(`Could not create userDataDir "${this.userDataDir}"`));

		const getClient = createPath.then(() => cl.launch({chromePath:this.chromePath, chromeFlags, userDataDir:this.userDataDir, envVars}))
		.then(chrome => cdp({port:chrome.port}).then(client => [chrome, client]));

		return getClient.then(
			([chrome, client]) => client.Page.enable()
			.then(() => client.Network.enable())
			.then(() => client.Runtime.enable())
			.then(() => {
				this.browser = chrome;
				this.client  = client;
				return getClient;
			})
		);
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

		return this.client.Runtime.compileScript({ expression, persistScript: true, sourceURL: injection.name || `<injection#${this.injectCount++}>`})
		.then(script => this.client.Runtime.runScript({scriptId: script.scriptId, awaitPromise:true}))
		.then(response => {
			if(response.exceptionDetails)
			{
				throw response;
			}
			return response.result.value;
		});
	}

	addBinding(name, callback)
	{
		if(!this.hasBindings)
		{
			this.client.Runtime.bindingCalled(event => this[CallBindings](event));
			this.hasBindings = true;
		}

		if(this.bindings.has(name))
		{
			console.error(`Warning: overwriting binding "${name}".`);
		}

		this.bindings.set(name, callback);

		return this.client.Runtime.addBinding({name});
	}

	[CallBindings]({name, payload})
	{
		const args = JSON.parse(payload);
		const callback = this.bindings.get(name);
		return callback(...args);
	}

	addModule(name, injection)
	{
		const expression = `require.register(${JSON.stringify(name)}, (exports, require, module) => { module.exports.__esModule = true; module.exports = module.exports.default = ${injection}; } );`;

		const Runtime = this.client.Runtime;

		return Runtime
		.compileScript({expression, persistScript: true, sourceURL: `<${name}>`})
		.then(script => Runtime.runScript({scriptId: script.scriptId, awaitPromise:true}));
	}

	startCoverage()
	{
		return this.client.Profiler.enable()
		.then(() => this.client.Profiler.setSamplingInterval({interval:1}))
		.then(() => this.client.Profiler.startPreciseCoverage({callCount: true, detailed: true}));
	}

	takeCoverage()
	{
		return this.client.Profiler.takePreciseCoverage();
	}

	stopCoverage()
	{
		return this.client.Profiler.stopPreciseCoverage();
	}
}
