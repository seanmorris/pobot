![avatar](https://avatars3.githubusercontent.com/u/640101?s=80&v=4)

# Pobot

Promise-oriented Chrome automator.

[![Docker Pulls](https://img.shields.io/docker/pulls/seanmorris/pobot?logo=docker&logoColor=white&color=960&label=ids.server%20pulls&style=for-the-badge)](https://hub.docker.com/repository/docker/seanmorris/pobot)

## Usage

Pobot is still in very heavy alpha. Its API has a lot of pipes and wires sticking out.

### Scripting

In the example below, we navigate to a page and `then` inject some javascript. **PLEASE NOTE** In the code, it looks like a normal callback is passed to `pobot.inject()`. This is simply for the convenience of syntax highlighting in the editor ONLY. The callback passed here will be converted to a string behing the scenes and run in another JS environment ENTIRELY (the webpage). Of course, normal namespacing rules will NOT apply.

```javascript
(async () => {
	const pobot = await Pobot.get([]);

	await pobot.goto('https:google.com');

	await pobot.inject(() => {
		document.querySelector('input[type=text]').value = 'Sean Morris';
		document.querySelector('input[type=submit]').click();
	});

	await pobot.loaded();

	const linkText = await pobot.inject(() => {
		return document.querySelector('#search a').innerText.trim();
	});
})();
```

### CLI

Pobot can be installed globally via:

```bash
npm install -g pobot
```

and can be used with scripts like so:

```bash
pobot ./relative-path-to/script.js
```

Scripts are formatted like modules and may export functions or promises:

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

export default async (client, args) => {
	console.log('Opening npmjs.com...');
	await client.goto('http://npmjs.com');

	console.log('Populating keyword...');
	await client.inject(populateSearch, ['pobot']);

	console.log('Performing search for "pobot"...');
	await client.inject(peformSearch);

	console.log('Waiting 5 seconds...');
	await new Promise(a => setTimeout(a, 5000));
};
```

## Pobot

### Copyright 2019-2020 Sean Morris

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
