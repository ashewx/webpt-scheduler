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
var pt_name = null;

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
				return client.query(text).then(response => {
					pt_info = response.rows[0];
					if (pt_info !== null) {
						pt_name = pt_info.fname + ' ' + pt_info.lname;  // first name + ' ' + last name
						pt_id = pt_info.doctorid;
						// console.log(pt_id);
						agent.add(`<speak>Your Physical Therapist is ` + pt_name + `</speak>`);
					}
	      }).catch(e => {
					console.log(e.stack); ssml = `<speak>Unable to find Physical Therapist info for patient ` + patient_id + `</speak>`;
				});
			}
			break;

		case "set-pt":
			// SQL update the patient's doctor
			respond = function(agent) {
				text = `UPDATE goesto SET doctorid = (SELECT d.doctorid FROM doctors AS d WHERE d.fname = '` + agent.parameters['first-name'] + `' AND d.lname = '` + agent.parameters['last-name'] + `') WHERE ` + patient_id + ` = patientid`;
				return client.query(text).then(response => {
					pt_info = response.rows[0];
					console.log(pt_info);
					if (pt_info !== null) {
						agent.add(`<speak>Your Physical Therapist was updated. When would you like to make the appointment?</speak>`);
					}
					else {
						agent.add(`<speak>Failed to update your Physical Therapist.</speak>`);
					}
				}).catch(e => {
					console.log(e.stack);
				});
			}


			break;

		case "schedule-appointment":
			respond = function(agent) {
				text = 'SELECT d.fname, d.lname, d.doctorid FROM doctors AS d, patients AS p, goesto AS g WHERE ' + patient_id + ' = g.patientid AND d.doctorid = g.doctorid';
				let pt_info = null;
				return client.query(text).then(response => {
					console.log(response.rows[0]);
					pt_info = response.rows[0];
					if (pt_info !== null) {
						pt_name = pt_info.fname + ' ' + pt_info.lname;  // first name + ' ' + last name
						pt_id = pt_info.doctorid;
						// console.log(pt_id);
						agent.add(`<speak>Your current physical therapist is ` + pt_name + `. Is this correct?</speak>`);
					}
				}).catch(e => {
					console.log(e.stack); ssml = `<speak>Unable to find Physical Therapist info for patient ` + patient_id + `</speak>`;
				});
			}
		  break;

		case "appointment-times":
			let app_date = agent.parameters['date'].substring(0,10);
			let app_time = agent.parameters['time'].substring(11,19);
			respond = function(agent) {
				text = `SELECT a.appid, d.doctorid, d.fname, d.lname FROM appointments AS a, schedule AS s, patients AS p, doctors AS d, goesto AS g WHERE p.patientid = g.patientid AND g.doctorid = s.doctorid AND g.doctorid = d.doctorid AND a.appid = s.appid AND '` + app_date + `' = a.appdate AND '` + app_time + `' = a.apptime`;
				console.log(text)
				let full_info = null;
				let app_info = null;
				return client.query(text).then(response => {
					console.log(response.rows[0]);
					full_info = response.rows[0];
					app_info = full_info.appid;
					pt_id = full_info.doctorid;
					pt_name = full_info.fname + ' ' + full_info.lname;
					if (app_info !== undefined) {
						agent.add(`<speak>Unfortunately ` + pt_name + ` is busy during that time. Is there another time that works for you?</speak>`);
					}
					else {
					 	// GET LAST app key
						client.query('SELECT appid FROM appointments ORDER BY appid DESC LIMIT 1').then(response1 => {
							console.log(response1.rows[0].appid);
							let last_app_key = response1.rows[0].appid + 1;
							let text2 = `INSERT INTO appointments VALUES(` + last_app_key + `, '` + app_date + `', '` + app_time + `'); INSERT INTO schedule VALUES(` + pt_id + `, ` + last_app_key + `);`;
							client.query(text2).catch(e => {
								console.log(e.stack);
							});
						}).catch(e => {
							console.log(e.stack);
						});
						agent.add(`<speak>Great! I will add you to ` + pt_name + `'s schedule for ` + app_date + ` at ` + app_time + `.</speak>`);
					}
				}).catch(e => {
					console.log(e.stack);
				});
			}
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
