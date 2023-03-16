const os  = require('os');
const cdp = require('chrome-remote-interface');
const child_process = require('child_process');
const readline      = require('readline');

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

module.exports = class
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

		return this.client.Runtime.evaluate({ expression, awaitPromise:true })
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
