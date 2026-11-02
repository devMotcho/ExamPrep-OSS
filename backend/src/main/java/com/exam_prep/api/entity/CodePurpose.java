package com.exam_prep.api.entity;

/** What a confirmation code was requested for. A code only works for the purpose it was sent for. */
public enum CodePurpose {
    REGISTER,
    PASSWORD_RESET,
    PASSWORD_CHANGE,
    EMAIL_CONFIRMATION,
    CONTACT,
    /** Sent to the new address before the sign-in email changes. */
    EMAIL_CHANGE,
    /** Confirms deleting an account that signs in with Google or Microsoft and so has no password to check. */
    ACCOUNT_DELETION
}
