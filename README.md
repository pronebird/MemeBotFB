## Meme Bot for Facebook

Got sick of your pals clogging your Facebook feed with cats, wisdom pictures and inspirational quotes? It's time for revenge, increase the relevance of your feed by automatically posting fresh Meme a day.

### Notes

Initial requirement is to obtain access token from Facebook. Console gives a tip on that. Once you get the token, run `token YOUR_ACCESS_TOKEN` from console. Your token will be exchanged to long-lived one and cached to disk.

Default bot's schedule is 9am and 4pm.

### Configuration

All configuration is made via environment variables. You can run bot using `setup_env.sh` which will automatically setup environment variables from `.env` file.

Create `.env` file with the following contents:

```env
APP_ID=YOUR_FACEBOOK_APP_ID
APP_SECRET=YOUR_FACEBOOK_APP_SECRET
TZ=YOUR_TIMEZONE # Example: Europe/Ljubljana
```

Facebook app must be created with `publish_actions` permissions.

### TODO

* Once a day: Find a friend with least relevant content and publish a personal meme on his wall.
* Once a week: Rank friends content relevance and post scoreboards. Congratulate least relevant content posters.
* Make a web page and open service that would allow visitors to setup bots for their Facebook accounts. Get 1 billion evaluation for whatever reason, sell it to Google, buy Tesla, fancy villa and yacht, flee the country. Startup life.

Pull requests are welcome.

![Pull requests are welcome](https://i.imgur.com/Ky4ufVa.gif)
