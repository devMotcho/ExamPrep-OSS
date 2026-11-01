package com.exam_prep.api.user;

public enum UserRoleKey {

    ADMIN("ROLE_ADMIN"),
    DEV("ROLE_DEV");

    private final String key;

    UserRoleKey(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}
