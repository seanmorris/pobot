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
