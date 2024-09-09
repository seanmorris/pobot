const populateSearch = (keyword) => {
	const field = document.querySelector('#search input[type="search"]');

	if(!field)
	{
		return;
	}

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
