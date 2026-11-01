package com.exam_prep.api.aigen;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Arrays;

/** Upload checks: declared type, magic bytes, size, then a real parse for page count. */
@Component
public class AiPdfValidator {

    static final long MAX_BYTES = 32L * 1024 * 1024;
    static final int MAX_PAGES = 100;
    private static final byte[] MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    /** Checks that need no parsing, run before the file is written to disk. */
    public void checkUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AiGenException(AiErrorCode.AI_FILE_MISSING, HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > MAX_BYTES) {
            throw new AiGenException(AiErrorCode.AI_FILE_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE);
        }
        String type = file.getContentType();
        if (type == null || !type.toLowerCase().split(";")[0].trim().equals("application/pdf")) {
            throw new AiGenException(AiErrorCode.AI_FILE_NOT_PDF, HttpStatus.BAD_REQUEST);
        }
        try (InputStream in = file.getInputStream()) {
            if (!Arrays.equals(in.readNBytes(MAGIC.length), MAGIC)) {
                throw new AiGenException(AiErrorCode.AI_FILE_NOT_PDF, HttpStatus.BAD_REQUEST);
            }
        } catch (IOException e) {
            throw new AiGenException(AiErrorCode.AI_FILE_NOT_PDF, HttpStatus.BAD_REQUEST);
        }
    }

    /** Returns the page count. */
    public int checkDocument(Path pdf) {
        try (PDDocument document = Loader.loadPDF(pdf.toFile(), "", IOUtils.createTempFileOnlyStreamCache())) {
            if (document.isEncrypted()) {
                throw new AiGenException(AiErrorCode.AI_PDF_ENCRYPTED, HttpStatus.BAD_REQUEST);
            }
            int pages = document.getNumberOfPages();
            if (pages < 1) {
                throw new AiGenException(AiErrorCode.AI_FILE_NOT_PDF, HttpStatus.BAD_REQUEST);
            }
            if (pages > MAX_PAGES) {
                throw new AiGenException(AiErrorCode.AI_TOO_MANY_PAGES, HttpStatus.BAD_REQUEST);
            }
            return pages;
        } catch (InvalidPasswordException e) {
            throw new AiGenException(AiErrorCode.AI_PDF_ENCRYPTED, HttpStatus.BAD_REQUEST);
        } catch (IOException | RuntimeException e) {
            if (e instanceof AiGenException age) {
                throw age;
            }
            throw new AiGenException(AiErrorCode.AI_FILE_NOT_PDF, HttpStatus.BAD_REQUEST);
        }
    }
}
