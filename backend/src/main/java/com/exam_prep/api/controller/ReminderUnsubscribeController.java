package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.service.ReminderCopy;
import com.exam_prep.api.service.ReminderService;

import java.util.UUID;

/**
 * Public unsubscribe path for reminder emails. GET only shows a confirmation, because mail
 * scanners follow links; POST (the form, or a one-click List-Unsubscribe client) does the change.
 */
@RestController
@RequestMapping("/auth/reminders/unsubscribe")
@RequiredArgsConstructor
public class ReminderUnsubscribeController {

    private final ReminderService reminderService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @GetMapping(produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> confirm(@RequestParam(required = false) String token,
                                          @RequestParam(required = false) String lang) {
        ReminderCopy copy = ReminderCopy.of(lang);
        UUID parsed = parse(token);
        if (parsed == null) {
            return page(copy, copy.invalidLinkTitle(), "<p>" + copy.invalidLinkBody() + "</p>" + dashboardLink(copy));
        }
        return page(copy, copy.unsubscribeLabel(),
                "<p>" + copy.unsubscribeQuestion() + "</p>"
                        + "<form method=\"post\" action=\"unsubscribe?token=" + parsed + "&lang=" + copy.locale() + "\">"
                        + "<button type=\"submit\" style=\"padding:10px 18px;font-size:15px;cursor:pointer\">" + copy.unsubscribeLabel() + "</button></form>");
    }

    @PostMapping(produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> unsubscribe(@RequestParam(required = false) String token,
                                              @RequestParam(required = false) String lang) {
        ReminderCopy copy = ReminderCopy.of(lang);
        UUID parsed = parse(token);
        if (parsed != null) {
            reminderService.unsubscribe(parsed);
        }
        return page(copy, copy.unsubscribedTitle(), "<p>" + copy.unsubscribedBody() + "</p>" + dashboardLink(copy));
    }

    private UUID parse(String token) {
        try {
            return token == null ? null : UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String dashboardLink(ReminderCopy copy) {
        return "<p><a href=\"" + copy.dashboardUrl(frontendUrl) + "\">" + copy.dashboardLinkLabel() + "</a></p>";
    }

    private ResponseEntity<String> page(ReminderCopy copy, String title, String body) {
        String html = "<!doctype html><html lang=\"" + copy.locale() + "\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + title + "</title></head>"
                + "<body style=\"font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;line-height:1.5\">"
                + "<h1 style=\"font-size:20px\">" + title + "</h1>" + body + "</body></html>";
        return ResponseEntity.ok().contentType(new MediaType(MediaType.TEXT_HTML, java.nio.charset.StandardCharsets.UTF_8)).body(html);
    }
}
