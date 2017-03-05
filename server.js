//.

var BOT_COMMANDS = {};
var ACCESS_TOKEN = '';

// Setup vars from environment
var APP_ID = process.env.APP_ID;
var APP_SECRET = process.env.APP_SECRET;

var FACEBOOK_GRAPH = 'https://graph.facebook.com';
var MEMEGENERATOR_API = 'http://version1.api.memegenerator.net';
var TOKEN_FILE = '.token';

var request = require('request');
var querystring = require('querystring');
var readline = require('readline');
var fs = require('fs');
var util = require('util');
var schedule = require('node-schedule');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: function(line) {
		var completions = Object.keys(BOT_COMMANDS);
		var hits = completions.filter(function(c) {
			return c.indexOf(line) === 0;
		});
		return [ hits.length ? hits : completions, line ];
	}
});

// A transitory data that persists between bot commands
var BOT_TRANSITORY_DATA = {};

// Routine

function bot_token_help() {
	console.log('');
	console.log('It is cumbersome these days to post on Facebook, so please obtain your access token yourself.');
	console.log("Your token will be automatically exchanged to long-lived token and saved on disk, so you have to do it only once in few months.\n");
	console.log('To obtain access token, go to:\nhttps://www.facebook.com/dialog/oauth?client_id=%s&redirect_uri=https://github.com/pronebird/MemeBotFB&scope=user_friends,publish_actions&response_type=token', APP_ID);
	console.log('After you grant access to the app, copy access token from URL bar and run: token XXXXXXX');
	console.log('');
}

function bot_run(cmd) {
	cmd = cmd.trim();

	var space = cmd.indexOf(' ');
	var input = '';

	if(space !== -1) {
		input = cmd.substring(space + 1);
		cmd = cmd.substring(0, space);
	}

	if(BOT_COMMANDS[cmd]) {
		var promise = BOT_COMMANDS[cmd](input);

		rl.pause();
		
		promise.then(function () {
			rl.prompt();
		}).catch(function (error) {
			console.log('%s: %s', cmd, error.message);
			rl.prompt();
		});
	} else {
		console.log('Unrecognized command. Type ? to get a list of available commands.');
		rl.prompt();
	}
}

// Bot commands

function bot_help(input) {
	console.log('Available commands:');
	console.log('');
	console.log('*  entertain  - entertain friends by posting a meme on Facebook');
	console.log('*  token - get or set access token');
	console.log('*  quit  - terminate process');
	console.log('');
	console.log('Use space to separate arguments, e.g. if you want to set token:');
	console.log('   token XXXXXXX');

	bot_token_help();

	return Promise.resolve();
}

function bot_quit(input) {
	console.log('Bye.');
	process.exit(0);
	return Promise.resolve();
}

function bot_token(input) {
	input = input.trim();
	if(input.length == 0) {
		console.log('Token = ' + ACCESS_TOKEN);
		return Promise.resolve();
	}

	var exchange_url = '/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s';
	var path = util.format(exchange_url, APP_ID, APP_SECRET, input);

	return new Promise(function (resolve, reject) {
		request.get(FACEBOOK_GRAPH + path, function (error, response, body) {
			if(error) {
				console.log('Cannot get long-live token. Reason: ' + error.message);
				return reject(error);
			}

			var exchange = querystring.parse(body);
			ACCESS_TOKEN = exchange.access_token;

			console.log('Exchanged short-lived token for long-lived token.', ACCESS_TOKEN);
			console.log('Long-lived token expires in ~%d days', parseInt(exchange.expires / 86400) );

			fs.writeFile(TOKEN_FILE, ACCESS_TOKEN, function (error) {
				if(error) {
					console.log('Could not write token to disk. Reason: ' + error.message);
					return reject(error);
				}
				resolve(ACCESS_TOKEN);
			});
		});
	});
}

function bot_entertain(input) {
	var url = MEMEGENERATOR_API + '/Instances_Select_ByNew?languageCode=en&pageIndex=0&pageSize=1';

	return new Promise(function (resolve, reject) {
		request.get(url, function (error, response, body) {
			if(error) { return reject(error); }

			var json;
			try { 
				json = JSON.parse(body); 
			} catch(e) {
				return reject(e); 
			}

			if(!json.success) { 
				return reject(new Error('API failure. Got JSON:\n' + util.inspect(json))); 
			}

			var meme = json.result[0];
			var message = meme.displayName;
			var image = meme.instanceImageUrl;

			// Avoid sharing the same image twice
			if(BOT_TRANSITORY_DATA.last_shared_image === image) {
				console.log('Same picture as before. Not sharing.');
				return resolve(image);
			}

			// Save last shared image
			BOT_TRANSITORY_DATA.last_shared_image = image;

			console.log('Entertaining friends with "%s" (picture: "%s")', message, image);

			var options = {
				form: {
					url: image,
					message: message,
					privacy: { value: 'EVERYONE' },
					access_token: ACCESS_TOKEN
				},
				headers: {

				}
			};

			request.post(FACEBOOK_GRAPH + '/me/photos', options, function (error, response, body) {
				var json;
				try { 
					json = JSON.parse(body);
				} catch(e) {
					return reject(e);
				}

				if(json.error) {
					var e = json.error;
					var msg = util.format('%s (type: %s, code: %d)', e.message, e.type, e.code);
					return reject(new Error(msg));
				}

				console.log('Got photo id: %s', json.id);
				resolve(image, json.id);
			});
		});
	});
}

// Bootstrap

// Commands map
BOT_COMMANDS = {
	'?': bot_help,
	'quit': bot_quit,
	'token': bot_token,
	'entertain': bot_entertain
};

rl.on('line', bot_run);

console.log('Meme bot is on duty.');
console.log('Type ? for help');
console.log('');

if(!APP_ID || !APP_SECRET) {
	console.log('Check if APP_ID and APP_SECRET environment variables set properly.');
	console.log('Please create .env file with configuration:');
	console.log('APP_ID=XXXXXXX');
	console.log('APP_SECRET=XXXXXXX');
	console.log('Use setup_env.sh to run script.');
	console.log('');
}

// Read token from disk
fs.readFile(TOKEN_FILE, { encoding: 'utf8' }, function (err, data) {
	if(!err) {
		console.log('Token loaded from file.');
	} else {
		console.log('Could not read token file.');
	}

	ACCESS_TOKEN = data;

	if(!ACCESS_TOKEN || !ACCESS_TOKEN.length) {
		console.log('You do not have access token set for your Facebook account. Please follow the steps below:');
		bot_token_help();
	}

	rl.setPrompt('$ ');
	rl.prompt();
});

// Setup schedule for bot
var morningRule = new schedule.RecurrenceRule();
var eveningRule = new schedule.RecurrenceRule();

// 9 am
morningRule.hour = 9;
morningRule.minute = 0;

// 4 pm
eveningRule.hour = 16;
eveningRule.minute = 0;

schedule.scheduleJob(morningRule, function() {
	console.log('* Morning schedule *');
	rl.prompt();

	bot_run('entertain');
});

schedule.scheduleJob(eveningRule, function() {
	console.log('* Evening schedule *');
	rl.prompt();

	bot_run('entertain');
});
