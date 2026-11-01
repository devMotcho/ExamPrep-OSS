package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class RichTextSanitizerTest {

    @Test
    void keepsWhatTheEditorProduces() {
        String html = "<h2>T</h2><p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s> <code>e</code></p>"
                + "<ol start=\"3\"><li><p>f</p></li></ol><pre><code>g</code></pre><blockquote><p>h</p></blockquote><hr>";
        assertEquals(html, RichTextSanitizer.richText(html));
    }

    @Test
    void removesActiveContent() {
        assertEquals("<p>a</p>", RichTextSanitizer.richText("<p onclick=\"x()\">a</p><script>y()</script>"));
        assertEquals("", RichTextSanitizer.richText("<img src=x onerror=x()>"));
        assertEquals("", RichTextSanitizer.richText("<svg><script>x()</script></svg>"));
    }

    @Test
    void removesFormsAndStyling() {
        String out = RichTextSanitizer.richText("<form><input><button>go</button></form><p style=\"position:fixed\" class=\"x\">a</p>");
        assertEquals("go<p>a</p>", out);
    }

    @Test
    void restrictsLinks() {
        assertEquals("<a rel=\"noopener noreferrer nofollow\">a</a>", RichTextSanitizer.richText("<a href=\"javascript:x()\">a</a>"));
        assertEquals("<a href=\"https://e.test\" rel=\"noopener noreferrer nofollow\">a</a>", RichTextSanitizer.richText("<a href=\"https://e.test\">a</a>"));
    }

    @Test
    void keepsEscapedText() {
        assertEquals("<p>1 &lt; 2 &amp; 3</p>", RichTextSanitizer.richText("<p>1 &lt; 2 &amp; 3</p>"));
    }

    @Test
    void plainTextKeepsWhatWasTyped() {
        assertEquals("1 < 2 & 3 > 2", RichTextSanitizer.plainText("1 < 2 & 3 > 2"));
        assertEquals("Olá, mundo", RichTextSanitizer.plainText("Olá, mundo"));
    }

    @Test
    void plainTextRemovesMarkupEvenWhenEncoded() {
        assertEquals("hi", RichTextSanitizer.plainText("<b>hi</b><script>x()</script>"));
        assertFalse(RichTextSanitizer.plainText("&lt;img src=x onerror=x()&gt;").contains("<"));
        assertFalse(RichTextSanitizer.plainText("&amp;lt;script&amp;gt;").contains("<"));
    }

    @Test
    void nullStaysNull() {
        assertNull(RichTextSanitizer.richText(null));
        assertNull(RichTextSanitizer.plainText(null));
    }
}
