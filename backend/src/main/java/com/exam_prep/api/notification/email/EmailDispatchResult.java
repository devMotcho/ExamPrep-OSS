package com.exam_prep.api.notification.email;

import java.util.Map;

/**
 * Outcome of attempting to send an email to a batch of recipients.
 *
 * @param totalCount   number of recipients the dispatch was attempted for
 * @param successCount number of recipients the email was successfully sent to
 * @param failures     map of recipient email -> failure reason, for any that failed
 */
record EmailDispatchResult(int totalCount, int successCount, Map<String, String> failures) {

    boolean isFullSuccess() {
        return failures.isEmpty() && totalCount > 0;
    }

    boolean hasAnySuccess() {
        return successCount > 0;
    }

    boolean hasFailures() {
        return !failures.isEmpty();
    }
}
