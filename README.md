![avatar](https://avatars3.githubusercontent.com/u/640101?s=80&v=4)

# Pobot

Promise-oriented Chrome automator.

*Pobot is now ESM compliant!*

## Usage

Pobot is still in very heavy alpha. Its API has a lot of pipes and wires sticking out.

### Example

In the example below, we navigate to a page and `then` inject some javascript. **PLEASE NOTE** In the code, it looks like a normal callback is passed to `pobot.inject()`. This is simply for the convenience of syntax highlighting in the editor ONLY. The callback passed here will be converted to a string behing the scenes and run in another JS environment ENTIRELY (the webpage). Of course, normal variable inheritance will NOT apply.

```javascript
// This script will search google and return the URL
// and link text of the first result

import { Pobot } from 'Pobot';

(async () => {
    try {
        const pobot = await Pobot.get();
        await pobot.goto('https:google.com');

        await pobot.inject(() => {
            document.querySelector('textarea').value = 'Sean Morris "developer"';
            document.querySelector('input[type=submit]').click();
        });

        await pobot.loaded();

        const {linkText, linkUrl} = await pobot.inject(() => {
            const link = document.querySelector('#search a');
            const linkText = link.querySelector('h3').innerText.trim();
            const linkUrl = link.getAttribute('href');
            return {linkText, linkUrl};
        });

        console.log({linkText, linkUrl});

        pobot.kill();
    }
    catch(error)
    {
        console.log(error);
    }
})();
```

## Methods

### pobot.goto(url)

Async, will navigate to a new URL. Promise will resolve when the page is loaded.

```javascript
await pobot.goto('https:google.com');
```

### pobot.inject(callback, ...args)

Async, will execute a callback in the context of the page. Return values must be JSON serializable.

Optional args must also be JSON serializable.

```javascript
const getLink = (selector) => {
    const link = document.querySelector(selector);
    return {
        linkText: link.innerText.trim(),
        linkUrl: link.getAttribute('href'),
    };
};

const {linkText, linkUrl} = await pobot.inject(getLink, '#querySelectorHere');
```

### pobot.loaded()

Async, will resolve when the page load event is detected. Meant to be used after a page action that would trigger navigation.

```javascript
await pobot.goto('https:google.com');

await pobot.inject(() => {
    document.querySelector('textarea').value = 'search keywords here';
    document.querySelector('input[type=submit]').click();
});

await pobot.loaded();
```

### pobot.type(keys, delayTime = 10)

Type some text with a virtual keyboard.

```javascript
await pobot.type('some text here');
```

### pobot.click(x, y, delayTime, {buttons, endX, endY})

Click on a point with a virtual pointer.

```javascript
await pobot.click(100, 500);
```

### pobot.getHTML(selector = null)

Get some HTML from the page, optionally using a selector to get only one element.

```javascript
const html = await pobot.getHTML();
```

```javascript
const html = await pobot.getHTML('#querySelectorHere');
```
### pobot.getScreenshot({filename, type = 'png'})

Take a screenshot of the page.

```javascript
await pobot.getScreenshot({filename: '~/screenshots/my-page.png'});
```

### pobot.addInit(callback)

Add a callback to be run on every new page load.

```javascript
pobot.addInit(() => {
    console.log('New page loaded!');
});
```

### pobot.addInits(callbacks)

Add multiple callbacks to be run on every new page load.

```javascript
pobot.addInits(
    () => console.log('New page loaded!'),
    () => console.log('Second init callback!'),
);
```
### pobot.removeInit()

Remove a callback that was registered with `pobot.addInit` or `pobot.addInits`.

```javascript
const callback = () => console.log('New page loaded!');
await pobot.addInit(callback);
// later...
await pobot.removeInit(callback);
```

### pobot.addBinding(name, callback)

Add a callback to the global scope of the page using the given name.

```javascript
pobot.addBinding('someCallback', () =>
    console.log('Callback invoked from page!');
});
```

### pobot.addBindings(bindings)

Add multiple callback to the global scope of the page using the given name.

```javascript
pobot.addBindings({
    'someCallback': () => console.log('Callback invoked from page!'),
    'otherCallback': () => console.log('Other callback invoked from page!'),
});
```

### pobot.addConsoleHandler(handler)

Add listeners for `console.log` and similar functions. Takes an object keyed by the name of the methods to be subscribed to.

```javascript
pobot.addBindings({
    log: () => console.log('Console.log invoked from page!'),
    error: () => console.error('Console.error invoked from page!'),
});
```

You can also pass the special property `!` to catch any other unhandled methods, or `*` to listen for ALL console methods:

```javascript
pobot.addBindings({
    log: () => console.log('Console.log invoked from page!'),
    error: () => console.error('Console.error invoked from page!'),
    '!': () => console.error('Other console method invoked from page!'),
});
```

### pobot.getVersion()

Get the version of the browser being controlled.

```javascript
const verion = await pobot.getVersion();
```
```javascript
{
    protocolVersion: '1.3',
    product: 'Chrome/127.0.6533.99',
    revision: '@f31af5097d90ef5ae5bd7b8700199bc6189ba34d',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    jsVersion: '12.7.224.18'
}
```

### pobot.startCoverage()

Start logging code coverage.

```javascript
await pobot.startCoverage()
```

### pobot.takeCoverage()

Get logged code coverage.

```javascript
const coverage = await pobot.takeCoverage()
```

### pobot.stopCoverage()

Stop logging code coverage.

```javascript
await pobot.stopCoverage()
```

### pobot.close()

Close the browser tab.

```javascript
pobot.close()
```

### pobot.kill()

Kill the browser.

```javascript
pobot.kill()
```

### pobot.addModule()

## CLI Scripts

Pobot can be installed globally via:

```bash
npm install -g pobot
```

and can be used with scripts like so:

```bash
pobot ./relative-path-to/script.js
```

Scripts are formatted just like normal modules:

*example/npmSearch.mjs:*
```javascript
const populateSearch = (keyword) => {
    const field = document.querySelector('#search input[type="search"]');
    if(!field) return;
    field.value = keyword;
    return true;
};

const peformSearch = () => {
    const button = document.querySelector('#search button[type="submit"]');
    button.click();
    return true;
};

export default async (pobot, args) => {
    console.log('Opening npmjs.com...');
    await pobot.goto('http://npmjs.com');

    console.log('Populating keyword...');
    await pobot.inject(populateSearch, ['pobot']);

    console.log('Performing search for "pobot"...');
    await pobot.inject(peformSearch);

    console.log('Waiting 5 seconds...');
    await new Promise(a => setTimeout(a, 5000));
};
```

You can run the script above like so:

```bash
$ npx pobot example/npmSearch.mjs
```

## Copyright 2019-2024 Sean Morris

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
