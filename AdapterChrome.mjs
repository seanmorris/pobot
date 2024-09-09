import os from 'node:os';
import cl from 'chrome-launcher';
import cdp from 'chrome-remote-interface';
import fs from 'node:fs';
const fsp = fs.promises;

const CallBindings = Symbol('CallBindings');

const userDirectories = new Set;

process.on('exit', code => userDirectories.forEach(d => fs.rmdirSync(d, {recursive:true})));

export class AdapterChrome
{
	hasBindings = false;
	bindings    = new Map;

	constructor({userDataDir, chromePath}={})
	{
		const uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(
			/[018]/g
			, c => (
				c ^ parseInt(Math.random() * 255) & 15 >> c / 4
			).toString(16)
		);

		const defaultUserDataDir = os.tmpdir() + '/.chrome-user/' + uuid;

		this.userDataDir = userDataDir || defaultUserDataDir;
		this.chromePath  = chromePath;

		Object.defineProperty(this, 'type',     {value: 'chrome'});
		Object.defineProperty(this, 'bindings', {value: new Map});
		this.hasBindings = false;
	}

	getClient({chromeFlags, envVars})
	{
		const createPath = fsp.access(this.userDataDir)
		.then( () => fsp.rm(this.userDataDir, {recursive:true}))
		.catch(() => fsp.mkdir(this.userDataDir, {recursive:true}))
		.catch(() => console.error(`Could not create userDataDir "${this.userDataDir}"`));

		userDirectories.add(this.userDataDir);

		const getClient = createPath
		.then(() => cl.launch({chromePath:this.chromePath, chromeFlags, userDataDir:this.userDataDir, envVars}))
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
