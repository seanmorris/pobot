import os from 'node:os';
import cdp from 'chrome-remote-interface';
import { ChildProcess as child_process } from 'node:child_process';
import readline from 'node:readline';

const launchFirefox = ({port, flags, chromeFlags} = {}) => {

	const findPort = port ? Promise.resolve(port) : new Promise(accept => {
		const proc   = child_process.exec(`netstat -tunlep | grep LISTEN | awk '{print $4}' | perl -pe 's/.+://' | sort -n`);
		const reader = readline.createInterface({input:proc.stdout});

		const usedPorts = new Set;

		reader.on('line',  line => usedPorts.add(Number(line)));
		reader.on('close', () => {
			const maxPort = 2**16;
			const minPort = 2**10;

			let port = minPort + Math.trunc((maxPort - minPort) * Math.random())

			while(usedPorts.has(port))
			{
				port++
			}

			accept(port);
		});
	});

	return findPort.then(port => {
		const proc = child_process.spawn('/usr/bin/env', ['-S', 'firefox', '--remote-debugging-port=' + port, ...chromeFlags]);
		const pid     = proc.pid;
		const kill    = () => proc.kill();

		const browser = {pid, kill, port, process:proc};

		const reader = readline.createInterface({input:proc.stderr});

		return new Promise(accept => {
			reader.on('line', line => {
				if(line.substr(0, 18) === 'DevTools listening')
				{
					accept(browser);
				}
			});
		});
	});
};

const userDataDir = os.tmpdir() + '/.chrome-user';

export class AdapterFirefox
{
	constructor({userDataDir, chromePath}={})
	{
		this.userDataDir = userDataDir || defaultUserDataDir;
		this.chromePath  = chromePath;

		Object.defineProperty(this, 'type', {value: 'firefox'});
	}

	getClient({chromeFlags, flags, envVars})
	{
		const getClient = launchFirefox({chromeFlags, flags})
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
		const expression = `(async ()=> { return JSON.stringify(await (${injection})(...${JSON.stringify(args)})); })()`;
		const response = this.client.Runtime.evaluate({ expression, awaitPromise:true });

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
		return Promise.resolve();
	}

	addModule(name, injection)
	{
		const expression = `require.register(${JSON.stringify(name)}, (exports, require, module) => { module.exports.__esModule = true; module.exports = module.exports.default = ${injection}; } );`;

		const Runtime = this.client.Runtime;

		return Runtime.evaluate({expression, awaitPromise:true});
	}

	startCoverage()
	{
		return Promise.resolve();
	}

	takeCoverage()
	{
		return Promise.resolve();
	}

	stopCoverage()
	{
		return Promise.resolve();
	}
}
