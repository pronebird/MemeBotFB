//.

process.env.TZ = 'Europe/Ljubljana';

var BOT_COMMANDS = {};
var ACCESS_TOKEN = '';

var APP_ID = '758699520828270';
var APP_SECRET = '9007b2da3d5abdbbec5cd6d613dc19bf'; // Please, do not mess with my app

var FACEBOOK_GRAPH = 'graph.facebook.com';
var MEMEGENERATOR_API = 'version1.api.memegenerator.net';
var TOKEN_FILE = '.token';

var http = require('http');
var https = require('https');
var querystring = require('querystring');
var readline = require('readline');
var fs = require('fs');
var util = require('util');

var schedule = require('node-schedule');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Net utils

function httpx_get(hostname, path, is_ssl, success, error) {
	var options = {
		hostname: hostname,
		port: is_ssl ? 443 : 80,
		path: path
	};
	(is_ssl ? https : http).get(options, function(res) {
		var body = '';
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
		})
		.on('end', function() {
			success(body);
		});
	}).on('error', error);

	console.log('GET %s://%s%s', is_ssl ? 'https' : 'http', hostname, path);
}

function http_get(hostname, path, success, error) {
	return httpx_get(hostname, path, false, success, error);
}

function https_get(hostname, path, success, error) {
	return httpx_get(hostname, path, true, success, error);
}

function https_post(hostname, path, input, success, error) {
	var data = querystring.stringify(input || {});
	var options = {
		'host': hostname,
		'port': 443,
		'method': 'POST',
		'path': path,
		'headers': {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length
		}
	};
	var req = https.request(options, function(res) {
		var body = '';
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function () {
			success(body);
		});
	})
	.on('error', error);

	req.write(data);
	req.end();

	console.log('POST https://%s%s', hostname, path);
}

// Routine

function bot_token_help() {
	console.log('');
	console.log('It is cumbersome these days to post on Facebook, so please obtain your access token yourself.');
	console.log("Your token will be automatically exchanged to long-lived token and saved on disk, so you have to do it only once in few months.\n");
	console.log('To obtian access token, go to:\nhttps://www.facebook.com/dialog/oauth?client_id=%s&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=publish_actions&response_type=token', APP_ID);
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
		BOT_COMMANDS[cmd](input, function () {
			rl.prompt();
		});
	} else {
		console.log('Unrecognized command. Type ? to get a list of available commands.');
		rl.prompt();
	}
}

// Bot commands

function bot_help(input, callback) {
	console.log('Available commands:');
	console.log('');
	console.log('*  post - post a meme to Facebook');
	console.log('*  token - get or set access token');
	console.log('');
	console.log('Use space to separate arguments, e.g. if you want to set token:');
	console.log('   token XXXXXXX');

	bot_token_help();

	callback();
}

function bot_quit(input, callback) {
	console.log('Bye.');
	process.exit(0);
	callback();
}

function bot_token(input, callback) {
	if(input.length == 0) {
		console.log('Token = ' + ACCESS_TOKEN);
		return callback();
	}

	ACCESS_TOKEN = input;

	var exchange_url = '/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s';
	var path = util.format(exchange_url, APP_ID, APP_SECRET, ACCESS_TOKEN);

	https_get(FACEBOOK_GRAPH, path, function(body) {
		var exchange = querystring.parse(body);

		ACCESS_TOKEN = exchange.access_token;

		console.log('Exchanged short-lived token for long-lived token.', ACCESS_TOKEN);
		console.log('Long-lived token expires in ~%d days', parseInt(exchange.expires / 86400) );

		fs.writeFile(TOKEN_FILE, ACCESS_TOKEN, function (err) {
			if(err) {
				console.log('Could not write token to disk. Reason: ' + e);
			}
			callback();
		});
	}, function(e) {
		console.log('Cannot get long-live token. Reason: ' + e);

		callback();
	});
}

function bot_post(input, callback) {
	var path = '/Instances_Select_ByNew?languageCode=en&pageIndex=0&pageSize=1';
	http_get(MEMEGENERATOR_API, path, function(body) {
		var json;

		try {
			json = JSON.parse(body);
		} catch(e) {
			console.log('Got malformed JSON: ' + body);
			return callback();
		}

		if(!json.success) {
			console.log('API failure. Got JSON:\n' + util.inspect(json));
			return callback();
		}

		var meme = json.result[0];
		var message = meme.displayName;
		var image = meme.instanceImageUrl;

		console.log('Posting "%s" with picture at "%s"', message, image);

		var data = {
			url: image,
			message: message,
			privacy: { value: 'EVERYONE' },
			access_token: ACCESS_TOKEN
		};

		https_post(FACEBOOK_GRAPH, '/me/photos', data, function(body) {
			try {
				var json = JSON.parse(body);
				if(json.error) {
					console.log('Got opengraph error: %s (type: %s, code: %d)', json.error.message, json.error.type, json.error.code);
				} else {
					console.log('Got photo id: %s', json.id);
				}
			} catch(e) {
				console.log('Got opengraph response: %s', body);
			}
			callback();
		}, function(e) {
			console.log('Got error: ' + e.message);
			callback();
		});
	}, function(e) {
		console.log('Got error: ' + e.message);
		callback();
	});
}

// Bootstrap

// Commands map
BOT_COMMANDS = {
	'?': bot_help,
	'quit': bot_quit,
	'token': bot_token,
	'post': bot_post
};

rl.on('line', bot_run);

console.log('Meme bot is on duty.');
console.log('Type ? for help');
console.log('');

// Read token from disk
fs.readFile(TOKEN_FILE, { encoding: 'utf8' }, function (err, data) {
	if(!err) {
		console.log('Token loaded from file.');
	} else {
		console.log('Could not read token file.');
	}

	ACCESS_TOKEN = data;

	if(!ACCESS_TOKEN || !ACCESS_TOKEN.length) {
		console.log('');
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

	bot_post('', function () {
		rl.prompt();
	});
});

schedule.scheduleJob(eveningRule, function() {
	console.log('* Evening schedule *');
	rl.prompt();

	bot_post('', function () {
		rl.prompt();
	});
});
