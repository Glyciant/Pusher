$(document).ready(function() {
    // Initialise Elements
    M.AutoInit();

    function utcNow() {
        var d = new Date(),
            s = ("0" + d.getUTCDate()).slice(-2) + "/" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "/" + d.getUTCFullYear() + " " + ("0" + d.getUTCHours()).slice(-2) + ":" + ("0" + d.getUTCMinutes()).slice(-2) + ":" + ("0" + d.getUTCSeconds()).slice(-2) + " UTC";

        $("#utc").html(s);
    }

    utcNow();

    setInterval(utcNow, 1000);
});

$(document).delegate("#dark-mode", "click", function() {
    if ($("body").hasClass("dark") === true) {
        $("body").removeClass("dark");
        $("#dark-mode").html("Dark Mode");
    }
    else {
        $("body").addClass("dark");
        $("#dark-mode").html("Light Mode");
    }
});