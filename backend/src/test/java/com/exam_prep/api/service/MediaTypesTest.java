package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class MediaTypesTest {

    private static byte[] bytes(String text) {
        return text.getBytes(StandardCharsets.ISO_8859_1);
    }

    @Test
    void recognisesImagesFromTheirBytes() {
        assertEquals("png", MediaTypes.detect(new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10}).orElseThrow().extension());
        assertEquals("jpg", MediaTypes.detect(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}).orElseThrow().extension());
        assertEquals("gif", MediaTypes.detect(bytes("GIF89a....")).orElseThrow().extension());
        assertEquals("webp", MediaTypes.detect(bytes("RIFF....WEBP")).orElseThrow().extension());
    }

    @Test
    void theDeclaredTypeAndNameDoNotMatter() {
        MockMultipartFile html = new MockMultipartFile("file", "a.png", "image/png", bytes("<html><script>x()</script>"));
        assertTrue(MediaTypes.detect(html).isEmpty());
        MockMultipartFile svg = new MockMultipartFile("file", "a.svg", "image/svg+xml", bytes("<svg onload=x()>"));
        assertTrue(MediaTypes.detect(svg).isEmpty());
        MockMultipartFile png = new MockMultipartFile("file", "a.html", "text/html", new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0});
        assertEquals("image/png", MediaTypes.detect(png).orElseThrow().contentType());
    }

    @Test
    void videosAreNotImages() {
        assertFalse(MediaTypes.detect(bytes("\0\0\0\u0018ftypmp42")).orElseThrow().isImage());
        assertTrue(MediaTypes.detect(new MockMultipartFile("file", new byte[0])).isEmpty());
    }
}
