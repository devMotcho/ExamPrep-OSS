package com.exam_prep.api.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;

/** Identifies an upload from its first bytes, as the declared type and file name are up to the sender. */
public final class MediaTypes {

    public record Detected(String contentType, String extension) {
        public boolean isImage() {
            return contentType.startsWith("image/");
        }
    }

    private static final int HEADER_BYTES = 12;
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] WEBM = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};

    private MediaTypes() {
    }

    public static Optional<Detected> detect(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return Optional.empty();
        }
        try (InputStream in = file.getInputStream()) {
            return detect(in.readNBytes(HEADER_BYTES));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    static Optional<Detected> detect(byte[] head) {
        if (startsWith(head, 0, PNG)) {
            return Optional.of(new Detected("image/png", "png"));
        }
        if (startsWith(head, 0, JPEG)) {
            return Optional.of(new Detected("image/jpeg", "jpg"));
        }
        if (startsWith(head, 0, ascii("GIF87a")) || startsWith(head, 0, ascii("GIF89a"))) {
            return Optional.of(new Detected("image/gif", "gif"));
        }
        if (startsWith(head, 0, ascii("RIFF")) && startsWith(head, 8, ascii("WEBP"))) {
            return Optional.of(new Detected("image/webp", "webp"));
        }
        if (startsWith(head, 4, ascii("ftyp"))) {
            return Optional.of(new Detected("video/mp4", "mp4"));
        }
        if (startsWith(head, 0, WEBM)) {
            return Optional.of(new Detected("video/webm", "webm"));
        }
        return Optional.empty();
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }

    private static boolean startsWith(byte[] head, int offset, byte[] expected) {
        return head.length >= offset + expected.length
                && Arrays.equals(head, offset, offset + expected.length, expected, 0, expected.length);
    }
}
