// App.js Setup
var express = require('express'),
    config = require('./config'),
    bodyParser = require('body-parser'),
    app = express(),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    restler = require('restler'),
    WebSocket = require("ws"),
    cron = require('node-cron'),
    swig = require('swig'),
    showdown  = require('showdown'),
    converter = new showdown.Converter();

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/pub'));
app.use(cookieParser());
app.use(session({
  secret: "None",
  resave: false,
  saveUninitialized: false
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('view cache', false);
swig.setDefaults({cache: false});

converter.setOption("omitExtraWLInCodeBlocks", true);
converter.setOption("simplifiedAutoLink", true);
converter.setOption("strikethrough", true);
converter.setOption("tables", true);
converter.setOption("emoji", true);


app.locals = {
    subreddit: config.app.subreddit,
    auth: config.auth.url,
    ws: config.ws.base
};

app.get('*', function(req, res, next) {
    res.locals.mod = req.session.mod;
    res.locals.loggedin = req.session.loggedin;
    next();
});

app.get("/", function(req, res) {
    if (req.session.loggedin) {
        if (req.session.mod) {
            restler.post('https://www.reddit.com/api/v1/access_token', {
                username: config.bot.id,
                password: config.bot.secret,
                data: {
                  grant_type: "password",
                  username: config.bot.username,
                  password: config.bot.password
                }
            }).on("complete", function(auth) {
                restler.get("https://oauth.reddit.com/r/" + config.app.subreddit + "/api/link_flair_v2.json", {
                    accessToken: auth.access_token
                }).on("complete", function(flairs) {
                    restler.get("https://oauth.reddit.com/r/" + config.app.subreddit + "/wiki/toolbox.json", {
                        accessToken: auth.access_token
                    }).on("complete", function(removals) {
                        removals = JSON.parse(removals.data.content_md).removalReasons;
                        res.render("index", { flairs: flairs, removals: removals });
                    });
                });
            });
        }
        else {
            res.render("error", { title: "403 Error", code: "403", message: "You are not allowed to use this service." });
        }
    }
    else {
        res.redirect(config.auth.url);
    }
});

app.get("/auth/", function(req, res) {
    if (req.query.error != "access_denied") {
        if (req.query.state == config.auth.state) {
            restler.post("https://www.reddit.com/api/v1/access_token", {
                username: config.auth.id,
                password: config.auth.secret,
                data: {
                    code: req.query.code,
                    grant_type: "authorization_code",
                    redirect_uri: config.auth.redirect
                }
            }).on("complete", function(auth) {
                restler.get("https://oauth.reddit.com/api/v1/me", {
                    "headers": {
                        "User-Agent": "Pusher",
                        "Authorization": "bearer " + auth.access_token
                    }
                }).on("complete", function(user) {
                    req.session.auth = auth.access_token;
                    restler.post('https://www.reddit.com/api/v1/access_token', {
                        username: config.bot.id,
                        password: config.bot.secret,
                        data: {
                          grant_type: "password",
                          username: config.bot.username,
                          password: config.bot.password
                        }
                    }).on("complete", function(auth) {
                        restler.get("https://oauth.reddit.com/r/" + config.app.subreddit + "/about/moderators.json", {
                            accessToken: auth.access_token
                        }).on("complete", function(mods) {
                            req.session.loggedin = user.name;
                            if (mods && mods.error && mods.error === 403) {
                                res.render("error", { title: "401 Error", code: "401", message: "The Pusher bot is not a moderator of the subreddit." });
                            }
                            else {
                                if (mods && mods.data && mods.data.children) {
                                    for (var mod of mods.data.children) {
                                        if (req.session.mod) {
                                            break;
                                        }
                                        if (mod.name == user.name) {
                                            req.session.mod = true;
                                        }
                                    }
                                    if (req.session.mod) {
                                        res.redirect("/");
                                    }
                                    else {
                                        res.render("error", { title: "403 Error", code: "403", message: "You are not allowed to use this service." });
                                    }
                                }
                                else {
                                    res.render("error", { title: "502 Error", code: "502", message: "Reddit API appears to be having problems." });
                                }
                            }
                        });
                    });
                });
            });
        }
        else {
            res.render("error", { title: "403 Error", code: "403", message: "An invalid state parameter was returned." });
        }
    }
    else {
        res.render("error", { title: "401 Error", code: "401", message: "Access to your account was denied." });
    }
});

app.get('*', function(req, res) {
    res.render("error", { title: "404 Error", code: "404", message: "That page wasn't found." });
});

var server = app.listen(config.app.port, function() {
    console.log('[DASHBOARD] Ready (' + config.app.port + ')');
});

process.on('unhandledRejection', function(reason, p){
    console.log("Promise Rejection at: ", p, " \nReason: ", reason);
});

var ws = new WebSocket.Server({
    port: config.ws.port
});

ws.broadcast = function broadcast(data) {
    ws.clients.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

ws.on('connection', function(w) {
    w.on('message', function(msg){
        ws.broadcast(msg);
        msg = JSON.parse(msg);
    });
});

// Authenticate with Reddit
restler.post('https://www.reddit.com/api/v1/access_token', {
    username: config.bot.id,
    password: config.bot.secret,
    data: {
      grant_type: "password",
      username: config.bot.username,
      password: config.bot.password
    }
}).on("complete", function(auth) {
    // Prepare to Hold Handled Posts & Comments
    var posts = [];
    var comments = [];
    // Get New Posts & Comments
    cron.schedule('*/3 * * * * *', function() {
        // Get Latest Post from Subreddit
        restler.get("https://oauth.reddit.com/r/" + config.app.subreddit + "/new.json?limit=1", {
            accessToken: auth.access_token
        }).on("complete", function(data) {
            // Check if Reddit Responded Correctly
            if (data.data && data.data.children && data.data.children[0] && data.data.children[0].data) {
                // Make Post Easy to Get
                var post = data.data.children[0].data;
                // Check if Post has Been Previously Handled
                if (posts.indexOf(post.id) === -1) {
                    // Add Post to Handled List
                    posts.push(post.id);
                    ws.broadcast(JSON.stringify({
                        type: "POST",
                        id: post.id,
                        title: post.title,
                        body: converter.makeHtml(post.selftext),
                        permalink: "https://redd.it/" + post.id,
                        author: post.author,
                        reports: post.mod_reports.length,
                        flair: post.link_flair_text,
                        approved: post.approved,
                        removed: post.removed,
                        locked: post.locked,
                        nsfw: post.over_18,
                        spoiler: post.spoiler,
                        edited: post.edited,
                        timestamp: post.created_utc * 1000,
                        url: post.url
                    }));
                }
            }
        });
        // Get Latest Comment from Subreddit
        restler.get("https://oauth.reddit.com/r/" + config.app.subreddit + "/comments.json?limit=1", {
            accessToken: auth.access_token
        }).on("complete", function(data) {
            // Check if Reddit Responded Correctly
            if (data.data && data.data.children && data.data.children[0] && data.data.children[0].data) {
                // Make Comment Easy to Get
                var comment = data.data.children[0].data;
                // Check if Comment has Been Previously Handled
                if (comments.indexOf(comment.id) === -1) {
                    // Add Comment to Handled List
                    comments.push(comment.id);
                    ws.broadcast(JSON.stringify({
                        type: "CMMT",
                        id: comment.id,
                        title: comment.title,
                        body: converter.makeHtml(comment.body),
                        permalink: "https://reddit.com/" + comment.permalink,
                        author: comment.author,
                        reports: comment.mod_reports.length,
                        approved: comment.approved,
                        removed: comment.removed,
                        parent: comment.link_permalink,
                        edited: comment.edited,
                        timestamp: comment.created_utc * 1000
                    }));
                }
            }
        });
    });

    // Get Modmail & Mod Queue
    cron.schedule('*/15 * * * * *', function() {
        // Get Modqueue Data from Subreddit
        restler.get("https://oauth.reddit.com/r/" + config.app.subreddit + "/about/modqueue.json", {
            accessToken: auth.access_token
        }).on("complete", function(data) {
            // Check if Reddit Responded Correctly
            if (data.data && data.data.children) {
                // Store Data
                var posts = 0,
                    comments = 0,
                    total = data.data.children.length;

                // Get Posts and Comments
                for (var submission of data.data.children) {
                    if (submission.kind == "t1") {
                        comments += 1;
                    }
                    else {
                        posts += 1;
                    }
                }

                ws.broadcast(JSON.stringify({
                    type: "MODQ",
                    posts: posts,
                    comments: comments,
                    total: total
                }));
            }
        });
    });
});

// Handle Approve Actions
app.post("/action/approve/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/approve/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "APRV",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Remove Actions
app.post("/action/remove/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/remove/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id,
                "spam": false
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "REMV",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Lock Actions
app.post("/action/lock/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/lock/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "LOCK",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Unlock Actions
app.post("/action/unlock/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/unlock/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "ULCK",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle NSFW Actions
app.post("/action/nsfw/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/marknsfw/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "NSFW",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle SFW Actions
app.post("/action/sfw/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/unmarknsfw/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "SFWV",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Spoiler Actions
app.post("/action/spoiler/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/spoiler/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "SPLR",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Unspoiler Actions
app.post("/action/unspoiler/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/api/unspoiler/", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "id": req.body.id
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "USLR",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Flair Actions
app.post("/action/flair/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        restler.post("https://oauth.reddit.com/r/" + config.app.subreddit + "/api/flair", {
            "headers": {
                "User-Agent": "Pusher",
                "Authorization": "bearer " + req.session.auth
            },
            "data": {
                "api_type": "json",
                "css_class": req.body.css,
                "link": req.body.id,
                "text": req.body.text
            }
        }).on("complete", function(action) {
            ws.broadcast(JSON.stringify({
                type: "FLAR",
                id: req.body.id
            }));
        });
    }
    else {
        res.sendStatus(403);
    }
});

// Handle Comment Actions
app.post("/action/comment/", function(req, res) {
    if (req.session.auth && req.session.loggedin && req.session.mod) {
        if (req.body.anonymous == "true") {
            restler.post('https://www.reddit.com/api/v1/access_token', {
                username: config.bot.id,
                password: config.bot.secret,
                data: {
                    grant_type: "password",
                    username: config.bot.username,
                    password: config.bot.password
                }
            }).on("complete", function(auth) {
                restler.post("https://oauth.reddit.com/api/comment/", {
                    accessToken: auth.access_token,
                    data: {
                        "api_type": "json",
                        "thing_id": req.body.id,
                        "text": req.body.text
                    }
                }).on("complete", function(modmail) {
                    restler.post("https://oauth.reddit.com/api/compose/", {
                        accessToken: auth.access_token,
                        data: {
                            "api_type": "json",
                            "subject": "Anonymous Pusher Comment",
                            "to": "/r/" + config.app.subreddit,
                            "text": "/u/" + req.session.loggedin + " has used an anonymous Pusher comment [here](https://reddit.com" + action.json.data.things[0].data.permalink + ")."
                        }
                    }).on("complete", function(action) {
                        if (req.body.distinguish == "true") {
                            restler.post("https://oauth.reddit.com/api/distinguish", {
                                accessToken: auth.access_token,
                                "data": {
                                    "api_type": "json",
                                    "id": "t1_" + action.json.data.things[0].data.id,
                                    "how": "yes",
                                    "sticky": (req.body.sticky == "true")
                                }
                            }).on("complete", function(action) {
                                res.sendStatus(200);
                            });
                        }
                        else {
                            res.sendStatus(200);
                        }
                    });
                });
            });
        }
        else {
            restler.post("https://oauth.reddit.com/api/comment", {
                "headers": {
                    "User-Agent": "Pusher",
                    "Authorization": "bearer " + req.session.auth
                },
                "data": {
                    "api_type": "json",
                    "thing_id": req.body.id,
                    "text": req.body.text
                }
            }).on("complete", function(action) {
                if (req.body.distinguish == "true") {
                    restler.post("https://oauth.reddit.com/api/distinguish", {
                        "headers": {
                            "User-Agent": "Pusher",
                            "Authorization": "bearer " + req.session.auth
                        },
                        "data": {
                            "api_type": "json",
                            "id": "t1_" + action.json.data.things[0].data.id,
                            "how": "yes",
                            "sticky": (req.body.sticky == "true")
                        }
                    }).on("complete", function(action) {
                        res.sendStatus(200);
                    });
                }
                else {
                    res.sendStatus(200);
                }
            });
        }
    }
    else {
        res.sendStatus(403);
    }
});

// Post Partial
app.post("/partial/post/", function(req, res) {
    req.body.approved = (req.body.approved == "true");
    req.body.removed = (req.body.removed == "true");
    req.body.locked = (req.body.locked == "true");
    req.body.nsfw = (req.body.nsfw == "true");
    req.body.spoiler = (req.body.spoiler == "true");
    req.body.edited = (req.body.edited == "true");
    req.body.timestamp = parseInt(req.body.timestamp);
    res.render("partials/post", req.body);
});

// Comment Partial
app.post("/partial/comment/", function(req, res) {
    req.body.approved = (req.body.approved == "true");
    req.body.removed = (req.body.removed == "true");
    req.body.edited = (req.body.edited == "true");
    req.body.timestamp = parseInt(req.body.timestamp);
    res.render("partials/comment", req.body);
});
