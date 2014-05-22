//.

var ACCESS_TOKEN = '';

var http = require('http');
var https = require('https');
var querystring = require('querystring');
var readline = require('readline');
var util = require('util');

console.log('Meme bot is on duty.');
console.log('Type ? for help')

var commands = {
	'?': function (input, callback) {
		console.log('Available commands:');
		console.log('');
		console.log('*  post - post a meme to Facebook');
		console.log('*  token - get or set access token');
		console.log('');
		console.log('Use space to separate arguments, e.g. if you want to set token:');
		console.log('   token XXXXXXX');
		console.log('');
		console.log("It is cumbersome these days to post on Facebook, so please obtain your access token yourself.\n");
		console.log('To obtian access token, go to:\nhttps://www.facebook.com/dialog/oauth?client_id=758699520828270&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=publish_actions&response_type=token')
		console.log('');
		callback();
	},
	'token': function (input, callback) {
		if(input.length == 0) {
			console.log('Token = ' + ACCESS_TOKEN);
		} else {
			console.log('Set token = ' + input);
			ACCESS_TOKEN = input;
		}

		callback();
	},
	'post': function (input, callback) {
		var url = 'http://version1.api.memegenerator.net/Instances_Select_ByNew?languageCode=en&pageIndex=0&pageSize=1';

		http.get(url, function(res) {
			var body = '';
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				body += chunk;
			});
			res.on('end', function() {
				var json;

				try {
					json = JSON.parse(body);
				} catch(e) {
					console.log('Got malformed JSON: ' + body);

					callback();
					return;
				}

				if(!json.success) {
					console.log('API failure. Got JSON:\n' + util.inspect(json));
					callback();
					return;
				}

				var meme = json.result[0];
				var message = meme.displayName;
				var image = meme.instanceImageUrl.replace('400x', '470x246');

				console.log('Posting "%s" with picture at "%s"', message, image);

				var data = querystring.stringify({
					'message': message,
					'picture': image,
					'access_token': ACCESS_TOKEN
				});
				var options = {
					'host': 'graph.facebook.com',
					'port': 443,
					'method': 'POST',
					'path': '/me/feed',
					'headers': {
						'Content-Type': 'application/x-www-form-urlencoded',
						'Content-Length': data.length
					}
				};
				var post = https.request(options, function(res) {
					var body = '';

					res.setEncoding('utf8');
					res.on('data', function(chunk) {
						body += chunk;
					});
					res.on('end', function () {
						try {
							var json = JSON.parse(body);
							if(json.error) {
								console.log('Got opengraph error: %s (type: %s, code: %d)', json.error.message, json.error.type, json.error.code);
							} else {
								console.log('Got post id: %s', json.id);
							}
						} catch(e) {
							console.log('Got opengraph response: %s', body);
						}
						callback();
					});
				});

				post.on('error', function(e) {
					console.log('Got error: ' + e.message);
					callback();
				});

				post.write(data);
				post.end();
			});
		}).on('error', function(e) {
			console.log('Got error: ' + e.message);
		});
	}
};

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', function (cmd) {
	cmd = cmd.trim();

	var space = cmd.indexOf(' ');
	var input = '';

	if(space !== -1) {
		input = cmd.substring(space + 1);
		cmd = cmd.substring(0, space);
	}

	if(commands[cmd]) {
		commands[cmd](input, function () {
			rl.prompt();
		});
	} else {
		console.log('Unrecognized command. Type ? to get a list of available commands.');
		rl.prompt();
	}
});

rl.setPrompt('$ ');
rl.prompt();
