package com.exam_prep.api.dto;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class ReorderRequest {
    private List<UUID> itemIds;
}

