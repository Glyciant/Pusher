$(document).ready(function() {
    var path = $("#wrapper").data("ws"),
        user = $("#wrapper").data("user"),
        ws = new WebSocket(path);

    // Send JOIN
    ws.onopen = function() {
        ws.send(JSON.stringify({
            type: "JOIN",
            user: user
        })); 
    };

    // Send PART
    window.onbeforeunload = function() {
        ws.send(JSON.stringify({
            type: "PART",
            user: user
        })); 
        ws.close();
    };

    // Send BACK (Manual)
    $(document).delegate("#back", "click", function() {
        ws.send(JSON.stringify({
            type: "BACK",
            user: user
        })); 
    });

    // Send IDLE (Manual)
    $(document).delegate("#idle", "click", function() {
        ws.send(JSON.stringify({
            type: "IDLE",
            user: user
        })); 
    });

    // Send BUSY (Manual)
    $(document).delegate("#busy", "click", function() {
        ws.send(JSON.stringify({
            type: "BUSY",
            user: user
        })); 
    });

    // Send BACK & IDLE (Automatic)
    var timeout,
        idle;
    $(document).mousemove(function() {
        clearTimeout(timeout);
        if (idle === true) {
            idle = false;
            ws.send(JSON.stringify({
                type: "BACK",
                user: user
            }));
        }
        timeout = setTimeout(function() {
            idle = true;
            ws.send(JSON.stringify({
                type: "IDLE",
                user: user
            }));
        }, 600000);
    });

    // Report Errors
    ws.onerror = function(err) {
      console.error("WebSocket Error: " + err);
    };

    // Handle Server Messages
    ws.onmessage = function(message) {
        msg = JSON.parse(message.data);
    
        // Receive PING
        if (msg.type == "PING") {
            ws.send(JSON.stringify({
                type: "PONG"
            }));
        }

        // Receive JOIN
        if (msg.type == "JOIN") {
            $("#online-mods").append("<tr id=\"" + msg.user + "\"><th>" + msg.user + "</th><td>Active</td></tr>");
        }

        // Receive PART
        if (msg.type == "PART") {
            $("#online-mods #" + msg.user).remove();
        }

        // Receive BACK
        if (msg.type == "BACK") {
            $("#online-mods #" + msg.user + " td").html("Active");
        }

        // Receive IDLE
        if (msg.type == "IDLE") {
            $("#online-mods #" + msg.user + " td").html("Away");
        }

        // Receive BUSY
        if (msg.type == "BUSY") {
            $("#online-mods #" + msg.user + " td").html("Busy");
        }

        // Receive MODQ
        if (msg.type == "MODQ") {
            $("#modqueue-total").html(msg.total);
            $("#modqueue-posts").html(msg.posts);
            $("#modqueue-comments").html(msg.comments);
        }

        // Receive POST
        if (msg.type == "POST") {
            $.post("/partial/post/", msg, function(resp) {
                $("#posts").prepend(resp);
                $("#" + msg.id).slideDown("slow");
                if ($("#post-alert").data("audio") === true) {
                    $("#post-alert")[0].play();
                }
                M.AutoInit();
            });
        }

        // Receive CMMT
        if (msg.type == "CMMT") {
            $.post("/partial/comment/", msg, function(resp) {
                $("#comments").prepend(resp);
                $("#" + msg.id).slideDown("slow");
                if ($("#comment-alert").data("audio") === true) {
                    $("#comment-alert")[0].play();
                }
                M.AutoInit();
            });
        }

        // Receive APRV
        if (msg.type == "APRV") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#approved-" + msg.id).html("<i class=\"material-icons\">done</i>");
            $("#removed-" + msg.id).html("");
            $("#reported-" + msg.id).html("");
            $("#" + msg.id + " #remove").show();
            $("#" + msg.id + " #approve").hide();
        }

        // Receive REMV
        if (msg.type == "REMV") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#removed-" + msg.id).html("<i class=\"material-icons\">close</i>");
            $("#approved-" + msg.id).html("");
            $("#reported-" + msg.id).html("");
            $("#" + msg.id + " #approve").show();
            $("#" + msg.id + " #remove").hide();
        }

        // Receive LOCK
        if (msg.type == "LOCK") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#locked-" + msg.id).html("<i class=\"material-icons\">lock</i>");
            $("#" + msg.id + " #unlock").show();
            $("#" + msg.id + " #lock").hide();
        }

        // Receive ULCK
        if (msg.type == "ULCK") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#locked-" + msg.id).html("");
            $("#" + msg.id + " #lock").show();
            $("#" + msg.id + " #unlock").hide();
        }

        // Receive NSFW
        if (msg.type == "NSFW") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#nsfwmarked-" + msg.id).html("<i class=\"material-icons\">priority_high</i>");
            $("#" + msg.id + " #sfw").show();
            $("#" + msg.id + " #nsfw").hide();
        }

        // Receive SFWV
        if (msg.type == "SFWV") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#nsfwmarked-" + msg.id).html("");
            $("#" + msg.id + " #nsfw").show();
            $("#" + msg.id + " #sfw").hide();
        }

        // Receive SPLR
        if (msg.type == "SPLR") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#spoilermarked-" + msg.id).html("<i class=\"material-icons\">visibility_off</i>");
            $("#" + msg.id + " #unspoiler").show();
            $("#" + msg.id + " #spoiler").hide();
        }

        // Receive USLR
        if (msg.type == "USLR") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#spoilermarked-" + msg.id).html("");
            $("#" + msg.id + " #spoiler").show();
            $("#" + msg.id + " #unspoiler").hide();
        }

        // Receive FLAR
        if (msg.type == "FLAR") {
            msg.id = msg.id.replace("t3_", "").replace("t1_", "");
            $("#modal-flair").modal("close");
            $("#flaired-" + msg.id).html("<i class=\"material-icons\">label</i>");
        }
    };
});