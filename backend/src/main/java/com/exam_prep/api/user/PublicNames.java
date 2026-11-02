package com.exam_prep.api.user;

import java.util.UUID;

/** What other people may see of a study area's creator. */
public final class PublicNames {

    private PublicNames() {
    }

    /**
     * The creator's public name, or else the first word of their name. Email and full name stay private. Null when
     * the account has neither, so the app shows a neutral label.
     */
    public static String of(String publicName, String name) {
        if (publicName != null && !publicName.isBlank()) {
            return publicName.trim();
        }
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim().split("\\s+", 2)[0];
    }

    public static boolean isStaff(UserEntity user) {
        return user != null && ("ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole()));
    }

    /** Staff see the full name; everyone else sees the public name. */
    public static String creatorName(String publicName, String name, UserEntity viewer) {
        if (isStaff(viewer) && name != null && !name.isBlank()) {
            return name;
        }
        return of(publicName, name);
    }

    /** Only the creator and staff get the creator's id, so a public listing cannot link areas to one account. */
    public static UUID creatorId(UUID creatorId, UserEntity viewer) {
        return viewer != null && (creatorId.equals(viewer.getId()) || isStaff(viewer)) ? creatorId : null;
    }
}
