package com.exam_prep.api.aigen;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AiQuotaRulesTest {

    @Test
    void anAmbiguousFailureKeepsItsReservation() {
        assertTrue(AiGenerationWorker.keepsReservation(AiErrorCode.AI_PROVIDER_CONNECTION, 0, 0));
        assertTrue(AiGenerationWorker.keepsReservation(AiErrorCode.AI_PROVIDER_UNAVAILABLE, 0, 0));
        assertTrue(AiGenerationWorker.keepsReservation(AiErrorCode.AI_INTERNAL, 0, 0));
    }

    @Test
    void aFailureThatCannotHaveCostReleasesIt() {
        assertFalse(AiGenerationWorker.keepsReservation(AiErrorCode.AI_PROVIDER_AUTH, 0, 0));
        assertFalse(AiGenerationWorker.keepsReservation(AiErrorCode.AI_BUSY, 0, 0));
    }

    @Test
    void knownUsageReplacesTheReservation() {
        assertFalse(AiGenerationWorker.keepsReservation(AiErrorCode.AI_TRUNCATED, 100, 200));
    }

    @Test
    void tooMuchExtractedTextIsRefused() {
        assertDoesNotThrow(() -> AiPdfValidator.checkTextSize(AiPdfValidator.MAX_TEXT_CHARS_PER_PAGE * 2L, 2));
        AiGenException e = assertThrows(AiGenException.class, () -> AiPdfValidator.checkTextSize(AiPdfValidator.MAX_TEXT_CHARS_PER_PAGE * 2L + 1, 2));
        assertEquals(AiErrorCode.AI_TOO_MUCH_TEXT, e.getCode());
    }
}
