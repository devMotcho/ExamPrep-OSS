package com.exam_prep.api.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/** One page of a list. {@code page} starts at 0. */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
