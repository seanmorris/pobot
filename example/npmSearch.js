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

module.exports = (client, args) => new Promise((accept,reject)=>{
	console.log('Opening npmjs.com...');

	client.goto('http://npmjs.com').then(()=>{

		console.log('Populating keyword...');

		return client.inject(populateSearch, ['pobot']);

	}).then(()=>{

		console.log('Performing search...');

		return client.inject(peformSearch);
	}).then(()=>{
		console.log('Waiting 5 seconds...');

		setTimeout(() => { accept('Done!.'); }, 5000);
	});
});
