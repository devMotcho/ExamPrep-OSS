package com.exam_prep.api.entity;

/** What a confirmation code was requested for. A code only works for the purpose it was sent for. */
public enum CodePurpose {
    REGISTER,
    PASSWORD_RESET,
    PASSWORD_CHANGE,
    EMAIL_CONFIRMATION,
    CONTACT
}
