var config = {};

config.app = {};
config.auth = {};
config.bot = {};

config.app.port = 8080; // Web Server Port
config.app.base = "http://localhost:" + config.app.port; // Domain (HTTP/HTTPS)
config.app.ws = "wss://localhost:" + config.app.port; // Domain (WS/WSS)
config.app.subreddit = ""; // Subreddit

config.auth.id = ""; // Reddit Application Client ID
config.auth.secret = ""; // Reddit Application Client Secret
config.auth.redirect = config.app.base + "/auth/"; // Do Not Edit
config.auth.state = Math.floor(Math.random() * 9999999999999999999999999).toString(36).substring(0, 15); // Do Not Edit
config.auth.url = "https://www.reddit.com/api/v1/authorize?client_id=" + config.auth.id + "&response_type=code&state=" + config.auth.state + "&redirect_uri=" + config.auth.redirect + "&duration=permanent&scope=identity+modposts+modflair+submit"; // Do Not Edit

config.bot.username = ""; // Reddit Bot Username
config.bot.password = ""; // Reddit Bot Password
config.bot.id = ""; // Reddit Bot Client ID
config.bot.secret = ""; // Reddit Bot Client Secret

module.exports = config;