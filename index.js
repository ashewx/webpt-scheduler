const express = require('express');
const bodyParser = require('body-parser');
const unirest = require('unirest');
const pg = require("pg");
const {
	dialogflow,
	Image
} = require('actions-on-google')
const {
	WebhookClient,
	Card,
	Suggestion
} = require('dialogflow-fulfillment');

const server = express();
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({extended: true}));

const dbConnection = "postgres://xcsudwga:bpq85D_guM7JOcEhwqBc7VcuHAT3MCCF@tantor.db.elephantsql.com:5432/xcsudwga";
const client = new pg.Client(dbConnection); // postgres client/proxy
client.connect();

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

const errorSound = `<audio src="https://notificationsounds.com/sound-effects/strange-error-106/download/ogg">`
const successSound = `<audio src="https://notificationsounds.com/message-tones/filling-your-inbox-251/download/ogg">`

// Test Variables
const patient_id = 1;
var pt_id = 0;

function WebhookProcessing(req, res) {
	 //Create an instance
	const agent = new WebhookClient({request: req, response: res});
	var intent = agent.intent;
	let origMess = agent.consoleMessages[agent.consoleMessages.length-1].text;
	console.log(origMess);
	var ssml = `<speak>` + errorSound + `</audio>` + `</speak>`;
	let text = null;

	switch(intent){
		case "Welcome Intent":
		  ssml = `<speak>Welcome to the Web<say-as interpret-as="characters">PT</say-as> appointment scheduler.</speak>`;
			console.log(agent.session);
			break;

		case "print-form":

			break;

		case "get-pt":
			// SQL select doctor first name, last name, id for the patient's physical therapist
			function query() {

			}
			text = 'SELECT d.fname, d.lname, d.doctorid FROM doctors AS d, patients AS p, goesto AS g WHERE ' + patient_id + ' = g.patientid AND d.doctorid = g.doctorid';
			let pt_info = null;
			client.query(text).then(response => {
				console.log(response.rows[0]);
				pt_info = response.rows[0];
        //see log for output
      }).then(function() {
				if (pt_info !== null) {
					let pt_name = pt_info.fname + ' ' + pt_info.lname;  // first name + ' ' + last name
					pt_id = pt_info.doctorid;
					ssml = '<speak>Your Physical Therapist is ' + pt_name + '<speak>';
				}
			}).catch(e => {console.error(e.stack); ssml = '<speak>Unable to find Physical Therapist info for patient ' + patient_id + '<speak>';});

			break;

		case "set-pt":
			// pseudocode:
			// get physical therapist for current user
			// pt_id = "SELECT d.id FROM doctors AS d WHERE d.name = " + agent.parameters
			// INSERT INTO goesto VALUES(patient_id, pt_id);
			client.query('SELECT d.doctorid FROM doctors AS d WHERE d.fname = ' + agent.parameters['first-name'] + ' AND d.lname = ' + agent.parameters['last-name']).then(response => {
				console.log(response.rows[0]);
				pt_id = response.rows[0]['doctorid'];
      }).then(function () {
				client.query('INSERT INTO goesto VALUES(' + patient_id + ', ' + pt_id + ')').then(response => {
					console.log(response.rows[0]);
					pt_id = response.rows[0];
	      }).catch(e => {console.error(e.stack); ssml = '<speak>Unable to set Physical Therapist for patient ' + patient_id + '<speak>';});
			}).then(function() {
				ssml = '<speak>Your Physical Therapist was set to ' + agent.parameters['first-name'] + ' ' + agent.parameters['last-name'] + '<speak>';
			}).catch(e => {console.error(e.stack); ssml = '<speak>Unable to get Physical Therapist ' + agent.parameters['first-name'] + ' ' + agent.parameters['last-name'] + '<speak>';});
			break;

		case "check-missing":

			break;
		default:
		  break;
	}

	function respond(agent) {
		agent.add(ssml);
	}

	let intentMap = new Map();
	intentMap.set(intent, respond);
	agent.handleRequest(intentMap);
}


// Webhook
server.post('/webhook', function (req, res) {
  console.info(`\n\n>>>>>>> S E R V E R   H I T <<<<<<<`);
  WebhookProcessing(req, res);
});

server.listen((process.env.PORT || 8000), () => {
	console.log("Server is up and running...");
});
