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
	var respond = null;

	switch(intent){
		case "Welcome Intent":
			respond = function(agent) {
				console.log(agent.session);
				agent.add(`<speak>Welcome to the Web<say-as interpret-as="characters">PT</say-as> appointment scheduler.</speak>`);
			}
			break;

		case "get-pt":
			// SQL select doctor first name, last name, id for the patient's physical therapist
			respond = function(agent) {
				text = 'SELECT d.fname, d.lname, d.doctorid FROM doctors AS d, patients AS p, goesto AS g WHERE ' + patient_id + ' = g.patientid AND d.doctorid = g.doctorid';
				let pt_info = null;
				client.query(text).then(response => {
					console.log(response.rows[0]);
					pt_info = response.rows[0];
					if (pt_info !== null) {
						let pt_name = pt_info.fname + ' ' + pt_info.lname;  // first name + ' ' + last name
						pt_id = pt_info.doctorid;
						// console.log(pt_id);
						agent.add(`<speak>Your Physical Therapist is ` + pt_name + `</speak>`);
					}
	      }).catch(e => {
					console.log(e.stack); 
					agent.add(`<speak>Unable to find Physical Therapist info for patient ` + patient_id + `</speak>`);
				});
			}
			break;

		case "set-pt":
		  break;

		case "schedule-appointment":
		  break;

    case "play-sound":
		  ssml = `<speak> Error Sound` + errorSound  + ` ...</audio>` +
			       `<break time="1s"/>` +
						 `Success Sound` + successSound  + ` ...</audio>` +
						 `</speak>`;
			break;

		default:
		  break;
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
