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

	async getClient({chromeFlags, envVars})
	{
		const createPath = fsp.access(this.userDataDir)
		.then( () => fsp.rm(this.userDataDir, {recursive:true}))
		.catch(() => fsp.mkdir(this.userDataDir, {recursive:true}))
		.catch(() => console.error(`Could not create userDataDir "${this.userDataDir}"`));

		userDirectories.add(this.userDataDir);

		await createPath;

		const chrome = await cl.launch({
			chromePath:this.chromePath,
			chromeFlags,
			userDataDir:this.userDataDir,
			envVars
		});

		const client = await cdp({port: chrome.port});

		await client.Page.enable();
		await client.Network.enable();
		await client.Runtime.enable();

		this.browser = chrome;
		this.client  = client;

		return [chrome, client];
	}

	async inject(injection, ...args)
	{
		const expression = `(async ()=> {
			return JSON.stringify(await (${injection})(...${JSON.stringify(args)}));
		})()`;

		const script = await this.client.Runtime.compileScript({ expression, persistScript: true, sourceURL: injection.name || `<injection#${this.injectCount++}>`});
		const response = await this.client.Runtime.runScript({scriptId: script.scriptId, awaitPromise:true});

		if(response.exceptionDetails)
		{
			throw response;
		}

		if(response.result.type === 'undefined')
		{
			return undefined;
		}

		if(response.result.type === 'string')
		{
			return JSON.parse(response.result.value);
		}

		return response.result.value;
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
