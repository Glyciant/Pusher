$(document).delegate("#approve", "click", function() {
    var id = $(this).data("id");

    $.post("/action/approve/", { id: id });
}); 

$(document).delegate("#remove", "click", function() {
    var id = $(this).data("id");

    $.post("/action/remove/", { id: id });
}); 

$(document).delegate("#lock", "click", function() {
    var id = $(this).data("id");

    $.post("/action/lock/", { id: id });
}); 

$(document).delegate("#unlock", "click", function() {
    var id = $(this).data("id");

    $.post("/action/unlock/", { id: id });
}); 

$(document).delegate("#nsfw", "click", function() {
    var id = $(this).data("id");

    $.post("/action/nsfw/", { id: id });
}); 

$(document).delegate("#sfw", "click", function() {
    var id = $(this).data("id");

    $.post("/action/sfw/", { id: id });
}); 

$(document).delegate("#spoiler", "click", function() {
    var id = $(this).data("id");

    $.post("/action/spoiler/", { id: id });
}); 

$(document).delegate("#unspoiler", "click", function() {
    var id = $(this).data("id");

    $.post("/action/unspoiler/", { id: id });
}); 

$(document).delegate("#flair", "click", function() {
    var id = $(this).data("id");

    $("#modal-flair").data("id", id);
    $("#modal-flair").modal("open");
}); 

$(document).delegate("#edit-flair", "click", function() {
    var id = $("#modal-flair").data("id"),
        text = $(this).data("text"),
        css = $(this).data("css");

    $.post("/action/flair/", { 
        id: id,
        text: text,
        css: css
    });
}); 

$(document).delegate("#comment", "click", function() {
    var id = $(this).data("id");

    $("#comment-text").val("");
    $("#comment-distinguish").prop("checked", true);
    if (id.includes("t1_")) {
        $("#comment-sticky").prop("checked", false);
        $("#comment-sticky").prop("disabled", true);
    }
    else {
        $("#comment-sticky").prop("checked", true);
        $("#comment-sticky").prop("disabled", false);
    }
    $("#comment-anonymous").prop("checked", false);

    $("#modal-comment").data("id", id);
    $("#modal-comment").modal("open");
}); 

$(document).delegate("#preset", "change", function() {
    var preset = $(this).val();

    if (!preset) {
        $("#comment-text").html("");
        M.textareaAutoResize($("#comment-text"));
    }
    else {
        $("#comment-text").html($("#removal-header").html() + "\n" + preset + "\n" + $("#removal-footer").html());
        M.textareaAutoResize($("#comment-text"));
    }
});

$(document).delegate("#comment-distinguish", "change", function() {
    if ($("#comment-distinguish").is(":checked") && !$("#modal-comment").data("id").includes("t1_")) {
        $("#comment-sticky").prop("checked", true);
        $("#comment-sticky").prop("disabled", false);
    }
    else {
        $("#comment-sticky").prop("checked", false);
        $("#comment-sticky").prop("disabled", true);
    }
});

$(document).delegate("#submit-comment", "click", function() {
    var id = $("#modal-comment").data("id"),
        text = $("#comment-text").val(),
        distinguish = $("#comment-distinguish").is(":checked"),
        sticky = $("#comment-sticky").is(":checked"),
        anonymous = $("#comment-anonymous").is(":checked");

    $.post("/action/comment/", { 
        id: id,
        text: text,
        distinguish: distinguish,
        sticky: sticky,
        anonymous: anonymous
    });
}); 

$(document).delegate("#posts-test", "click", function() {
    $("#post-alert")[0].play();
});

$(document).delegate("#posts-toggle", "click", function() {
    if ($("#post-alert").data("audio") === true) {
        $("#post-alert").data("audio", false);
        $("#posts-toggle").html("Enable Audio");
    }
    else {
        $("#post-alert").data("audio", true);
        $("#posts-toggle").html("Disable Audio");
    }
});

$(document).delegate("#posts-clear", "click", function() {
    $("#posts").html();
});

$(document).delegate("#comments-test", "click", function() {
    $("#comment-alert")[0].play();
});

$(document).delegate("#comments-toggle", "click", function() {
    if ($("#comment-alert").data("audio") === true) {
        $("#comment-alert").data("audio", false);
        $("#comments-toggle").html("Enable Audio");
    }
    else {
        $("#comment-alert").data("audio", true);
        $("#comments-toggle").html("Disable Audio");
    }
});

$(document).delegate("#comments-clear", "click", function() {
    $("#comments").html();
});