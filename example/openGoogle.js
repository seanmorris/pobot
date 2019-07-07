module.exports = (client, args) => new Promise((accept,reject)=>{
	console.log('Opening google...');

	client.goto('http://google.com').then(()=>{

		console.log('waiting 5 seconds...');

		setTimeout(() => {

			accept('Done!.');

		}, 5000);

		// setTimeout(() => reject('Timeout!'), 15000);
	});
});