import fs from 'node:fs';
import { Console } from 'node:console';

import { AdapterChrome } from './AdapterChrome.mjs';
import { AdapterFirefox } from './AdapterFirefox.mjs';

const fsp = fs.promises;

const defaultFlags  = {
	'--enable-automation': true
	, '--hide-scrollbars': true
	, '--no-sandbox':      true
	// , '--blink-settings':    'imagesEnabled=true'
	// , '--disable-gpu':       false
	// , '--headless':          false
	// , '--proxy-server=socks5://localhost:8000'
};

const keyCodes = {"0":48,"1":49,"2":50,"3":51,"4":52,"5":53,"6":54,"7":55,"8":56,"9":57,"d":68,"b":66,"a":65,"s":83,"i":73,"f":70,"k":75,"ß":219,"Dead":220,"+":187,"ü":186,"p":80,"o":79,"u":85,"z":90,"t":84,"r":82,"e":69,"w":87,"g":71,"h":72,"j":74,"l":76,"ö":192,"ä":222,"#":191,"y":89,"x":88,"c":67,"v":86,"n":78,"m":77,",":188,".":190,"-":189,"ArrowRight":39,"ArrowLeft":37,"ArrowUp":38,"ArrowDown":40,"PageDown":34,"Clear":12,"Home":36,"PageUp":33,"End":35,"Delete":46,"Insert":45,"Control":17,"AltGraph":18,"Meta":92,"Alt":18,"Shift":16,"CapsLock":20,"Tab":9,"Escape":27,"F1":112,"F2":113,";":188,":":190,"_":189,"'":191,"*":187,"Q":81,"W":87,"E":69,"R":82,"T":84,"Z":90,"S":83,"A":65,"D":68,"I":73,"U":85,"O":79,"Y":89,"X":88,"C":67,"F":70,"V":86,"G":71,"B":66,"H":72,"N":78,"J":74,"M":77,"K":75,"L":76,"P":80,"Ö":192,"Ä":222,"Ü":186,"!":49,"\"":50,"§":51,"$":52,"%":53,"&":54,"/":55,"(":56,")":57,"=":48,"?":219,"°":220};

const CallBindings = Symbol('CallBindings');
const CallConsole  = Symbol('CallConsole');
const CallPageLoad = Symbol('CallPageLoad');

const konsole = new Console({stdout: process.stderr, stderr: process.stderr});

const delay = ms => new Promise(a => setTimeout(a, ms));

export class Pobot
{
	constructor(adapter)
	{
		this.hasConsole  = false;
		this.injectCount = 0;

		Object.defineProperties(this, {
			consoleHandlers:  {value: new Set}
			, onNextPageLoad: {value: new Set}
			, onPageLoad:     {value: new Set}
			, bindings:       {value: new Map}
			, pending:        {value: new Map}
			, client:         {value: adapter.client}
			, chrome:         {value: adapter.browser}
			, adapter:        {value: adapter}
			, init:           {value: new Map}
		});

		this.client.Page.loadEventFired(event => this[CallPageLoad](event));
	}

	/**
	 * Get an instance of Pobot.
	 * @param {any[]} args
	 * @returns {Promise<Pobot>} a new instance of Pobot.
	 */
	static async get(args = [], adapter = new AdapterChrome)
	{
		const flags = {...defaultFlags};

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

		const envVars = {HOME: '/tmp', DISPLAY: ':0'};

		// const adapter = new AdapterFirefox;
		// const adapter = new AdapterChrome;

		await adapter.getClient({chromeFlags, flags, envVars});

		return new this(adapter);
	}

	/**
	 * Run some Pobot scripts
	 * @param {string[]} scripts List of module names to be run as Pobot scripts.
	 * @returns {Promise<null>} Resolves when scripts are complete.
	 */
	run(scripts)
	{
		const iterate = async () => {
			if(!args.length)
			{
				this.close();
				return;
			}

			let name;

			while(!name)
			{
				name = scripts.shift();
			}

			console.error(`Running ${name}...`);

			try
			{
				const { default: routine } = await import(process.cwd() + '/' + name);

				const result = await routine(this, args);

				console.error(`Done with ${name}.`);

				if(result !== undefined)
				{
					console.log(JSON.stringify(result));
				}

				iterate();
			}
			catch(error)
			{
				console.error(`Error! ${JSON.stringify(error)}`);
				this.close();
				process.exitCode = 1;
			}
		};

		return iterate();
	}

	/**
	 * Navigate to a page.
	 * @param {string} url
	 * @returns {Promise<null>} Resolves when the new page loads.
	 */
	goto(url)
	{
		return new Promise(accept => {
			this.client.Page.navigate({url});
			this.onNextPageLoad.add(accept);
		});
	}

	/**
	 * Wait for a page to load.
	 * Meant to be called after navigation is triggered.
	 * @returns {Promise<null>} Resolves when the new page loads.
	 */
	loaded()
	{
		return new Promise(accept => this.onNextPageLoad.add(accept));
	}

	/**
	 * Run a callback in the context of the page.
	 * Return value and arguments are optional, and if present
	 * must be JSON-serializable.
	 * @param {function(...any):any} injection
	 * @param  {...any} args
	 * @returns {Promise<any>}
	 */
	inject(injection, ...args)
	{
		return this.adapter.inject(injection, ...args);
	}

	/**
	 * Type some text with a virtual keyboard.
	 * @param {string|array} keys Keys to press.
	 * @param {number} delayTime Milliseonds to wait between virtual key events.
	 * @returns {Promise<null>} Resolves when typing is complete.
	 */
	async type(keys, delayTime = 10)
	{
		keys = [...keys];

		while(keys.length)
		{
			if(!(keys[0] in keyCodes))
			{
				console.error(`No key found for identifier "${keys[0]}"`);
			}

			const key = keys[0];
			const keyCode = keyCodes[ key ];

			await delay(delayTime);
			this.client.Input.dispatchKeyEvent({
				type: 'keyDown',
				key:  key,
				code: key,
				text: key,
				nativeVirtualKeyCode:  keyCode,
				windowsVirtualKeyCode: keyCode
			});

			await delay(delayTime);
			this.client.Input.dispatchKeyEvent({
				type: 'keyUp',
				key:  key,
				code: key,
				text: key,
				nativeVirtualKeyCode:  keyCode,
				windowsVirtualKeyCode: keyCode
			});

			keys = keys.slice(1);
		}
	}

	/**
	 * Click on a point with a virtual pointer.
	 * @param {number} x The X position in the viewport.
	 * @param {number} y The Y position in the viewport.
	 * @param {number} delayTime Milliseonds to wait between virtual mouse events.
	 * @param {number} param3.buttons 0x1|0x2|0x4... left|right|middle
	 * @param {number} param3.endX The X position to drag to in the viewport.
	 * @param {number} param3.endY The Y position to drag to in the viewport.
	 * @returns {Promise<null>} Resolves when the click (or drag) is complete.
	 */
	async click(x, y, delayTime = 10, {buttons = 0x1, endX, endY} = {})
	{
		let i = 0;

		const button = 0x1 & buttons ? 'left' : (0x2 & buttons ? 'right' : 'none');

		await delay(delayTime);
		this.client.Input.dispatchMouseEvent({type: 'mousePressed', x, y, buttons, button});

		if(endX && endY)
		{
			await delay(delayTime);
			this.client.Input.dispatchMouseEvent({type: 'mouseMoved', x:endX, y:endY, buttons, button});

			await delay(delayTime);
			this.client.Input.dispatchMouseEvent({type: 'mouseReleased', x:endX, y:endY, buttons, button});
		}
		else
		{
			await delay(delayTime);
			this.client.Input.dispatchMouseEvent({type: 'mouseReleased', x, y, buttons, button})
		}
	}

	/**
	 * Get some HTML from the page, optionally using a selector to get only one element.
	 * @param {string|null} selector The CSS Query Selector to select an element by
	 * @returns {Promise<string>} The selected HTML
	 */
	getHtml(selector = null)
	{
		const getter = () => {
			const getDocument = this.client.DOM.getDocument();

			let getNode;

			if(selector !== null)
			{
				getNode = getDocument.then(doc => this.client.DOM.querySelector({selector, nodeId: doc.root.nodeId}));
			}
			else
			{
				getNode = getDocument.then(doc => doc.root);
			}

			return getNode
			.then(node => this.client.DOM.getOuterHTML({nodeId:node.nodeId}))
			.then(response => response.outerHTML);
		}

		if(!this.pending.has('getHtml'))
		{
			this.pending.set('getHtml', new Set);
		}

		const waitingFor = this.pending.get('getHtml');

		const getHtml = waitingFor.size
			? Promise.allSettled([...waitingFor]).then(getter)
			: getter();

		waitingFor.add(getHtml);

		getHtml.finally(() => waitingFor.delete(getHtml));

		return getHtml;
	}

	/**
	 * Take a screenshot of the page
	 * @param {string} args.filename The filename to save the screenshot to.
	 * @param {string} args.type The type of file (defaults to png).
	 * @returns {Promise<Buffer>} Screenshot image data.
	 */
	async getScreenshot(args = {type: 'png'})
	{
		const response = await this.client.Page.captureScreenshot(args);
		const data = Buffer.from(response.data, 'base64');

		if(args.filename)
		{
			await fsp.writeFile(args.filename, data);
		}

		return data;
	}

	/**
	 * Add a callback to be run on every new page load.
	 * Optionally, with some arguments.
	 * @param {function()} initCallback
	 * @param  {...any} args
	 * @returns {Promise<null>} Resolves when the callback has been registered.
	 */
	async addInit(initCallback, ...args)
	{
		const source = `(${initCallback})(...${JSON.stringify(args)})`;
		const ident = await this.client.Page.addScriptToEvaluateOnNewDocument({source});
		this.init.set(initCallback, ident);
	}

	/**
	 * Add multiple callbacks to be run on every new page load.
	 * @param {...function()} initCallbacks
	 */
	addInits(initCallbacks)
	{
		return Promise.all(initCallbacks.map(i => this.addInit(i)))
	}

	/**
	 * Remove a callback that was registered with pobot.addInit() or pobot.addInits().
	 * @param {function()} injection
	 */
	removeInit(injection)
	{
		this.client.Page.removeScriptToEvaluateOnNewDocument(this.init.get(injection));
	}

	/**
	 * Add a callback to the global scope of the page using the given name.
	 * @param {string} name
	 * @param {function()} callback
	 * @returns {Promise} Resolves when the binding has been registerd.
	 */
	addBinding(name, callback)
	{
		return this.adapter.addBinding(name, callback);
	}

	/**
	 * Add multiple callback to the global scope of the page using the given name.
	 * @param {Object.<string, function()>} bindings
	 * @returns {Promise} Resolves when the bindings have been registerd.
	 */
	addBindings(bindings)
	{
		return Promise.all(
			Object.entries(bindings).map(b => this.addBinding(...b))
		);
	}

	addModule(name, injection)
	{
		return this.adapter.addModule(name, injection);
	}

	addModules(modules)
	{
		return Promise.all(modules.map(m => this.addModule(...m)));
	}

	/**
	 * Subscribe to one or more console methods in the page.
	 * @param {Object.<string, function()>} handler Object mapping console method names to lister callbacks
	 */
	addConsoleHandler(handler)
	{
		if(!this.hasConsole)
		{
			this.client.Runtime.consoleAPICalled(event => this[CallConsole](event));
			this.hasConsole = true;
		}

		this.consoleHandlers.add(handler);
	}

	[CallConsole](event)
	{
		for(const consoleHandler of this.consoleHandlers)
		{
			if(event.type in consoleHandler) consoleHandler[ event.type ](event);
			else if(consoleHandler['!']) consoleHandler['!'](event);
			if(consoleHandler['*']) consoleHandler['*'](event);
		}
	}

	[CallPageLoad](event)
	{
		for(const handler of this.onNextPageLoad)
		{
			this.onNextPageLoad.delete(handler);
			handler(event);
		}

		for(const handler of this.onPageLoad)
		{
			handler(event);
		}
	}

	/**
	 * Get the version of the browser being controlled.
	 * @returns {Promise<{product: string, revision: string, userAgent: string, jsVersion: string, protocolVersion:string}>} Version information
	 */
	getVersion()
	{
		return this.client.Browser.getVersion();
	}

	/**
	 * Start logging code coverage.
	 * @returns {Promise<null>} Resolves when coverage logging has begin.
	 */
	startCoverage()
	{
		return this.adapter.startCoverage();
	}

	/**
	 * Get logged code coverage.
	 * @returns {Promise<any>} Code coverage information
	 */
	takeCoverage()
	{
		return this.adapter.takeCoverage();
	}

	/**
	 * Stop logging code coverage.
	 * @returns {Promise<null>} Resolves when coverage logging has stopped.
	 */
	stopCoverage()
	{
		return this.adapter.stopCoverage();
	}

	/**
	 * Close the browser tab.
	 * @returns  {Promise<null>} Resolves when tab has closed.
	 */
	close()
	{
		return this.client.close();
	}

	/**
	 * Kill the browser.
	 * @returns  {Promise<null>} Resolves when browser has been killed.
	 */
	kill()
	{
		return this.chrome.kill();
	}

	getObject(objectIdent, maxDepth = 3, depth = 0)
	{
		if(depth > maxDepth)
		{
			return Promise.resolve(`maxDepth reached.`);
		}

		if(!objectIdent)
		{
			return Promise.resolve(`Unknown objectIdent type: "${typeof objectIdent}"`);
			return Promise.resolve(null);
		}

		if('unserializableValue' in objectIdent)
		{
			return Promise.resolve(objectIdent.unserializableValue);
		}

		switch(objectIdent.type)
		{
			case 'object':
				return !objectIdent.objectId ? Promise.resolve(objectIdent) : (this.client.Runtime
				.getProperties({objectId: objectIdent.objectId})
				.then(({result}) => {

					const getObjectProperties = result
					.filter(property => property.enumerable)
					.map(property => this.getObject(property.value, maxDepth, 1+depth).then(value => ({[property.name]: value})));

					const collectProprerties = Promise.all(getObjectProperties)
					.then(p => p.reduce((a,b) => ({...a, ...b}), {}));

					if(objectIdent.subtype === 'array')
					{
						return collectProprerties.then(properties => {
							delete properties.length;
							return Object.assign([], properties)
						});
					}

					return collectProprerties;
				}));

			case 'number':
			case 'string':
			case 'boolean':
			case 'function':
				return Promise.resolve(objectIdent.value);

			case 'null':
			case 'symbol':
			case 'undefined':
				return Promise.resolve(objectIdent.type);
				break;
		}

		return Promise.resolve(`Unknown type: "${objectIdent.type}"`);

		return Promise.resolve(null);
	}

	getStackTrace(error)
	{
		if(!error.result || !error.exceptionDetails || !error.exceptionDetails.stackTrace || !error.exceptionDetails.stackTrace.callFrames)
		{
			return Promise.reject('Object does not refer to a stack trace');
		}

		// konsole.log(error.exceptionDetails.stackTrace);

		return this.getObject(error.result).then(message => {
			const lines = error.exceptionDetails.stackTrace.callFrames.map(frame => frame.functionName
				? `${frame.functionName} (${frame.url||'<anonymous>'}:${frame.lineNumber}:${frame.columnNumber})`
				: `${frame.url||'<anonymous>'}:${frame.lineNumber}:${frame.columnNumber}`
			);
			return `${error.exceptionDetails.text} "${message}"\nat ${lines.join('\nat ')}`;
		});
	}
};

Object.defineProperty(Pobot, 'chromePath', {value: undefined, writable: true});
