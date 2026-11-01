package com.exam_prep.api.dto;

/** Longest accepted user content. Rich text limits count markup, so they sit well above what a person types. */
public final class ContentLimits {
    public static final int TITLE = 255;
    public static final int DESCRIPTION = 5_000;
    public static final int RICH_TEXT = 20_000;
    public static final int OPTION = 2_000;
    public static final int IMAGE_URL = 512;
    public static final int MAX_OPTIONS = 6;
    public static final int NAME = 100;
    public static final int EMAIL = 255;
    public static final int PHONE = 30;
    /** BCrypt only uses this many bytes of a password. */
    public static final int PASSWORD = 72;
    public static final int FILENAME = 255;
    public static final int FOLDER = 100;
    public static final int REPLY = 5_000;

    private ContentLimits() {
    }
}
