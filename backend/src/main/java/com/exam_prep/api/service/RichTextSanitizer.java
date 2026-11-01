package com.exam_prep.api.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.parser.Parser;
import org.jsoup.safety.Safelist;

/**
 * Applied whenever user content is written. The allowlist is what the Tiptap editor produces, and matches
 * ALLOWED_TAGS in frontend/src/lib/sanitizeHtml.ts.
 */
public final class RichTextSanitizer {

    private static final Safelist RICH_TEXT = new Safelist()
            .addTags("p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "code", "pre",
                    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li", "hr", "a", "span")
            .addAttributes("a", "href", "target")
            .addAttributes("ol", "start")
            .addProtocols("a", "href", "http", "https", "mailto")
            .addEnforcedAttribute("a", "rel", "noopener noreferrer nofollow");

    private static final Document.OutputSettings OUTPUT = new Document.OutputSettings()
            .prettyPrint(false)
            .syntax(Document.OutputSettings.Syntax.html);

    private RichTextSanitizer() {
    }

    /** For prompts and explanations, which are rendered as HTML. */
    public static String richText(String html) {
        return html == null ? null : Jsoup.clean(html, "", RICH_TEXT, OUTPUT);
    }

    /**
     * For options, descriptions and titles, which are rendered as text: "a &lt; b" stays as typed instead of
     * becoming an entity. Repeats until stable, so markup hidden behind entities does not survive either.
     */
    public static String plainText(String text) {
        if (text == null) {
            return null;
        }
        String current = text;
        for (int i = 0; i < 5; i++) {
            String cleaned = Parser.unescapeEntities(Jsoup.clean(current, "", Safelist.none(), OUTPUT), false);
            if (cleaned.equals(current)) {
                return cleaned;
            }
            current = cleaned;
        }
        // Still changing after this much nesting: nothing legitimate looks like that.
        return current.replace("<", "").replace(">", "");
    }
}
