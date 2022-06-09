const axios = require('axios');

const ENDPOINT=process.env.ENDPOINT;
const REQUESTS_TO_MAKE = 200;
const WAIT_BETWEEN_REQUESTS = 0;
let done = 0;

console.log(ENDPOINT);

let start = Date.now();

let make_request = async(endpoint, index) => {
	try {

		let res = await axios.post(endpoint, `username=test${index}&password=prova`, {headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		}});
		done++;
	} catch(e) {
		console.log(e);
	}
}

for(let i = 0; i < REQUESTS_TO_MAKE; i++) {
        make_request(ENDPOINT, i).then((_) => {
		if(done == REQUESTS_TO_MAKE) console.log(Date.now()-start)
	});
}

