#!/usr/bin/env Rscript
# TCGA-GTEx Dual Panel Heatmap
# Generates combined heatmap showing TCGA log2FC (left) and GTEx expression (right)
#
# Usage:
#   Rscript tcga_gtex_heatmap.R [gene_list_file] [gtex_tsv_file] [output_file] [gene_annotation_file]
#
# Arguments:
#   gene_list_file      - Path to text file with HGNC gene symbols (one per line)
#   gtex_tsv_file       - Path to GTEx median expression TSV file
#   output_file         - Path to output PDF file (default: tcga_gtex_heatmap.pdf)
#   gene_annotation_file - Optional: Path to TSV/CSV file with Gene and Group/Category columns
#                          If provided, heatmap will be split by gene groups with annotations on the left

# Load required libraries
suppressPackageStartupMessages({
  library(httr)
  library(jsonlite)
  library(dplyr)
  library(tidyr)
  library(tibble)
  library(grid)
  library(gridExtra)
  library(RColorBrewer)
  library(readr)
  library(stringr)
  library(ComplexHeatmap)
  library(circlize)
  library(ggplot2)
})

# ============================================================================
# Configuration
# ============================================================================

# TCGA cohorts to include
TCGA_COHORTS <- c("ACC", "BLCA", "BRCA", "CESC", "CHOL", "COAD", 
                  "COADREAD", "DLBC", "ESCA", "FPPP", "GBM", "GBMLGG",
                  "HNSC", "KICH", "KIPAN", "KIRC", "KIRP", "LAML", 
                  "LGG", "LIHC", "LUAD", "LUSC", "MESO", "OV", 
                  "PAAD", "PCPG", "PRAD", "READ", "SARC", "SKCM",
                  "STAD", "STES", "TGCT", "THCA", "THYM", "UCEC", 
                  "UCS", "UVM")

# API endpoint
FIREBROWSE_BASE_URL <- "http://firebrowse.org/api/v1/Analyses/mRNASeq/Quartiles"

# Cache directory for storing API responses
CACHE_DIR <- "tcga_cache"

# Color scheme for TCGA log2FC bins
TCGA_COLOR_BINS <- c(
  "> 5" = "#B2182B",         # Dark Red
  "3 - 5" = "#D6604D",       # Medium Red
  "1 - 3" = "#F4A582",       # Orange-Red
  "0 - 1" = "#FDDBC7",       # Light Orange
  "< 0" = "#92C5DE",         # Light Blue
  "Not Available" = "#D3D3D3" # Light Gray
)

# Color scheme for GTEx expression levels
GTEX_COLORS <- c(
  "High" = "#8B0000",           # Dark red
  "Medium" = "#FF6347",         # Light red
  "Low" = "#FFD700",            # Yellow
  "Not Detected" = "#87CEEB",   # Light blue
  "Not Available" = "#D3D3D3"  # Light gray
)

# ============================================================================
# Helper Functions
# ============================================================================

# Initialize cache directory
init_cache_dir <- function(cache_dir = CACHE_DIR) {
  if (!dir.exists(cache_dir)) {
    dir.create(cache_dir, recursive = TRUE)
  }
}

# Get cache file path
get_cache_file_path <- function(gene_symbol, sample_type, cache_dir = CACHE_DIR) {
  file.path(cache_dir, sprintf("%s_%s.rds", gene_symbol, sample_type))
}

# Get combined cache file path
get_combined_cache_file_path <- function(gene_symbol, cache_dir = CACHE_DIR) {
  file.path(cache_dir, sprintf("%s_combined.rds", gene_symbol))
}

# Load from cache
load_from_cache <- function(gene_symbol, sample_type, cache_dir = CACHE_DIR) {
  cache_file <- get_cache_file_path(gene_symbol, sample_type, cache_dir)
  if (file.exists(cache_file)) {
    tryCatch({
      return(readRDS(cache_file))
    }, error = function(e) {
      return(NULL)
    })
  }
  return(NULL)
}

# Save to cache
save_to_cache <- function(data, gene_symbol, sample_type, cache_dir = CACHE_DIR) {
  if (is.null(data)) return(invisible(NULL))
  init_cache_dir(cache_dir)
  cache_file <- get_cache_file_path(gene_symbol, sample_type, cache_dir)
  tryCatch({
    saveRDS(data, cache_file)
    return(TRUE)
  }, error = function(e) {
    return(FALSE)
  })
}

# Load combined from cache
load_combined_from_cache <- function(gene_symbol, cache_dir = CACHE_DIR) {
  cache_file <- get_combined_cache_file_path(gene_symbol, cache_dir)
  if (file.exists(cache_file)) {
    tryCatch({
      return(readRDS(cache_file))
    }, error = function(e) {
      return(NULL)
    })
  }
  return(NULL)
}

# Save combined to cache
save_combined_to_cache <- function(data, gene_symbol, cache_dir = CACHE_DIR) {
  if (is.null(data)) return(invisible(NULL))
  init_cache_dir(cache_dir)
  cache_file <- get_combined_cache_file_path(gene_symbol, cache_dir)
  tryCatch({
    saveRDS(data, cache_file)
    return(TRUE)
  }, error = function(e) {
    return(FALSE)
  })
}

# Load gene list from file
load_gene_list <- function(file_path) {
  cat("Loading gene list from:", file_path, "\n")
  lines <- readLines(file_path, warn = FALSE)
  lines <- lines[!str_detect(str_trim(lines), "^#")]
  lines <- lines[str_trim(lines) != ""]
  gene_symbols <- str_trim(toupper(lines))
  gene_symbols <- unique(gene_symbols)
  cat("  Loaded", length(gene_symbols), "unique gene symbols\n")
  if (length(gene_symbols) == 0) {
    stop("No valid gene symbols found in file")
  }
  return(gene_symbols)
}

# Load gene annotations from file
load_gene_annotations <- function(file_path, gene_symbols) {
  cat("\nLoading gene annotations from:", file_path, "\n")
  
  if (!file.exists(file_path)) {
    stop("Gene annotation file not found: ", file_path)
  }
  
  # Try reading as TSV first, then CSV
  annotation_data <- tryCatch({
    read_tsv(file_path, show_col_types = FALSE)
  }, error = function(e) {
    read_csv(file_path, show_col_types = FALSE)
  })
  
  # Find gene column (flexible naming)
  possible_gene_cols <- c("Gene", "gene", "Gene_Symbol", "gene_symbol", 
                         "GeneSymbol", "HGNC", "hgnc_symbol", "Symbol", "symbol")
  gene_col <- NULL
  for (col in possible_gene_cols) {
    if (col %in% colnames(annotation_data)) {
      gene_col <- col
      break
    }
  }
  if (is.null(gene_col)) {
    # Fall back to first column
    gene_col <- colnames(annotation_data)[1]
    cat("  Warning: Using first column (", gene_col, ") for gene matching\n")
  }
  
  # Find group column (flexible naming)
  possible_group_cols <- c("Group", "group", "Category", "category", 
                          "Group_Category", "group_category", "Class", "class")
  group_col <- NULL
  for (col in possible_group_cols) {
    if (col %in% colnames(annotation_data)) {
      group_col <- col
      break
    }
  }
  if (is.null(group_col)) {
    # Try second column if first is gene column
    if (gene_col == colnames(annotation_data)[1] && ncol(annotation_data) >= 2) {
      group_col <- colnames(annotation_data)[2]
      cat("  Warning: Using second column (", group_col, ") for group matching\n")
    } else {
      stop("Could not find group/category column in annotation file. ",
           "Expected columns: Group, group, Category, or category")
    }
  }
  
  cat("  Using column '", gene_col, "' for gene matching\n")
  cat("  Using column '", group_col, "' for group assignment\n")
  
  # Normalize gene symbols to uppercase
  annotation_data[[gene_col]] <- toupper(trimws(as.character(annotation_data[[gene_col]])))
  gene_symbols_upper <- toupper(gene_symbols)
  
  # Create gene-to-group mapping
  # Use base R indexing to avoid tidyselect deprecation warnings
  gene_groups <- data.frame(
    gene = annotation_data[[gene_col]],
    group = annotation_data[[group_col]],
    stringsAsFactors = FALSE
  ) %>%
    filter(!is.na(gene), !is.na(group), gene != "", group != "") %>%
    distinct()
  
  # Match to input genes
  matched <- gene_groups %>%
    filter(gene %in% gene_symbols_upper)
  
  if (nrow(matched) == 0) {
    cat("  Warning: No matching genes found in annotation file\n")
    cat("  Sample annotation genes:", paste(head(unique(gene_groups$gene), 10), collapse = ", "), "\n")
    cat("  Sample input genes:", paste(head(gene_symbols_upper, 10), collapse = ", "), "\n")
    return(NULL)
  }
  
  # Create named vector: gene -> group
  group_mapping <- setNames(matched$group, matched$gene)
  
  cat("  Matched", length(group_mapping), "genes to groups\n")
  cat("  Groups found:", paste(unique(group_mapping), collapse = ", "), "\n")
  
  return(group_mapping)
}

# Fetch TCGA quartile data
fetch_tcga_quartiles <- function(gene_symbol, sample_type = "tumors", 
                                  cohorts = TCGA_COHORTS, 
                                  max_retries = 3, delay = 0.5,
                                  use_cache = TRUE, cache_dir = CACHE_DIR) {
  if (use_cache) {
    cached_data <- load_from_cache(gene_symbol, sample_type, cache_dir)
    if (!is.null(cached_data)) {
      return(cached_data)
    }
  }
  
  cohort_string <- paste(cohorts, collapse = "%2C")
  url <- sprintf(
    "%s?format=json&gene=%s&cohort=%s&protocol=RSEM&sample_type=%s",
    FIREBROWSE_BASE_URL,
    gene_symbol,
    cohort_string,
    sample_type
  )
  
  for (attempt in 1:max_retries) {
    tryCatch({
      response <- GET(url, timeout(30))
      if (status_code(response) != 200) {
        if (attempt < max_retries) {
          Sys.sleep(delay * attempt)
          next
        }
        return(NULL)
      }
      
      content <- content(response, "text", encoding = "UTF-8")
      data <- fromJSON(content)
      
      if (!is.null(data$mRNASeq_Quartiles) && length(data$mRNASeq_Quartiles) > 0) {
        quartiles <- data$mRNASeq_Quartiles
        
        # Check if quartiles data frame has the expected columns
        if (!"cohort" %in% colnames(quartiles) || !"median" %in% colnames(quartiles)) {
          warning(sprintf("Unexpected quartiles structure for %s (%s)", 
                         gene_symbol, sample_type))
          return(NULL)
        }
        
        result <- quartiles %>%
          select(cohort, median) %>%
          mutate(
            gene = gene_symbol,
            sample_type = sample_type
          )
        
        # Filter out rows with NA medians (but keep the structure)
        result <- result %>%
          filter(!is.na(median))
        
        if (nrow(result) > 0 && use_cache) {
          save_to_cache(result, gene_symbol, sample_type, cache_dir)
        }
        
        # Return result even if empty (will be handled by fetch_tcga_gene_data)
        return(result)
      } else {
        # API returned success but no quartiles data
        # Return empty data frame instead of NULL to allow partial data handling
        return(data.frame(cohort = character(0), median = numeric(0)))
      }
    }, error = function(e) {
      if (attempt < max_retries) {
        Sys.sleep(delay * attempt)
        return(NULL)
      }
      return(NULL)
    })
  }
  return(NULL)
}

# Fetch TCGA gene data and compute log2FC
fetch_tcga_gene_data <- function(gene_symbol, cohorts = TCGA_COHORTS, 
                                  delay = 0.5, use_cache = TRUE, cache_dir = CACHE_DIR) {
  if (use_cache) {
    combined_cached <- load_combined_from_cache(gene_symbol, cache_dir)
    # Validate cached data - must have rows and at least some non-NA log2fc values
    if (!is.null(combined_cached) && nrow(combined_cached) > 0) {
      # Check if cached data has valid log2fc values
      if (sum(!is.na(combined_cached$log2fc)) > 0) {
        return(combined_cached)
      } else {
        # Cached data exists but has no valid log2fc - clear it and re-fetch
        cat("  Warning: Cached data for", gene_symbol, "has no valid log2fc values. Re-fetching...\n")
        cache_file <- get_combined_cache_file_path(gene_symbol, cache_dir)
        if (file.exists(cache_file)) {
          file.remove(cache_file)
        }
      }
    }
  }
  
  tumor_data <- fetch_tcga_quartiles(gene_symbol, "tumors", cohorts, 
                                     delay = delay, use_cache = use_cache, 
                                     cache_dir = cache_dir)
  normal_data <- fetch_tcga_quartiles(gene_symbol, "normals", cohorts, 
                                      delay = delay, use_cache = use_cache, 
                                      cache_dir = cache_dir)
  
  # Debug output for problematic genes
  if (gene_symbol == "CDH1" || gene_symbol == "cdh1") {
    cat("\n  DEBUG CDH1: tumor_data rows =", 
        ifelse(is.null(tumor_data), 0, nrow(tumor_data)),
        ", normal_data rows =",
        ifelse(is.null(normal_data), 0, nrow(normal_data)), "\n")
  }
  
  # Handle cases where we have partial data (tumor but no normal, or vice versa)
  # Return NULL only if BOTH are NULL or empty
  if ((is.null(tumor_data) || nrow(tumor_data) == 0) && 
      (is.null(normal_data) || nrow(normal_data) == 0)) {
    if (gene_symbol == "CDH1" || gene_symbol == "cdh1") {
      cat("  DEBUG CDH1: Both tumor and normal data are NULL/empty\n")
    }
    return(NULL)
  }
  
  # Create empty data frames if one is NULL or empty
  if (is.null(tumor_data) || nrow(tumor_data) == 0) {
    tumor_data <- data.frame(cohort = character(0), median = numeric(0))
  }
  if (is.null(normal_data) || nrow(normal_data) == 0) {
    normal_data <- data.frame(cohort = character(0), median = numeric(0))
  }
  
  # Merge tumor and normal data
  # Use full_join to keep all cohorts from both datasets
  merged <- tumor_data %>%
    select(cohort, median) %>%
    rename(tumor_median = median) %>%
    full_join(
      normal_data %>%
        select(cohort, median) %>%
        rename(normal_median = median),
      by = "cohort"
    ) %>%
    mutate(
      gene = gene_symbol,
      log2fc = calculate_log2fc(tumor_median, normal_median),
      log2fc_bin = categorize_log2fc(log2fc)
    )
  
  # Debug output for problematic genes
  if (gene_symbol == "CDH1" || gene_symbol == "cdh1") {
    cat("  DEBUG CDH1: merged rows =", nrow(merged), 
        ", cohorts with data =", sum(!is.na(merged$log2fc)), "\n")
  }
  
  # Only save if we have at least some data
  if (nrow(merged) > 0 && use_cache) {
    save_combined_to_cache(merged, gene_symbol, cache_dir)
  }
  
  return(merged)
}

# Calculate log2FC (vectorized)
calculate_log2fc <- function(tumor_median, normal_median) {
  # Vectorized version using ifelse
  result <- ifelse(
    is.na(normal_median) | normal_median == 0,
    NA_real_,
    ifelse(
      is.na(tumor_median) | tumor_median == 0,
      -10,
      log2(tumor_median / normal_median)
    )
  )
  return(result)
}

# Categorize log2FC
categorize_log2fc <- function(log2fc) {
  result <- ifelse(
    is.na(log2fc),
    "Not Available",
    ifelse(
      log2fc > 5,
      "> 5",
      ifelse(
        log2fc >= 3,
        "3 - 5",
        ifelse(
          log2fc >= 1,
          "1 - 3",
          ifelse(
            log2fc >= 0,
            "0 - 1",
            "< 0"
          )
        )
      )
    )
  )
  return(result)
}

# Process all TCGA genes
process_tcga_data <- function(gene_symbols, cohorts = TCGA_COHORTS, 
                               delay = 0.5, show_progress = TRUE,
                               use_cache = TRUE, cache_dir = CACHE_DIR) {
  cat("\nProcessing TCGA data for", length(gene_symbols), "genes...\n")
  init_cache_dir(cache_dir)
  
  all_data <- list()
  for (i in seq_along(gene_symbols)) {
    gene <- gene_symbols[i]
    if (show_progress) {
      cat(sprintf("[%d/%d] %s", i, length(gene_symbols), gene))
    }
    
    gene_data <- fetch_tcga_gene_data(gene, cohorts, delay = delay, 
                                      use_cache = use_cache, cache_dir = cache_dir)
    
    if (!is.null(gene_data)) {
      all_data[[i]] <- gene_data
      if (show_progress) cat(" ✓\n")
    } else {
      if (show_progress) cat(" ✗\n")
    }
    
    if (i < length(gene_symbols)) {
      Sys.sleep(delay)
    }
  }
  
  combined_data <- bind_rows(all_data)
  cat("\n  Processed", length(unique(combined_data$gene)), "genes\n")
  return(combined_data)
}

# Load GTEx median expression data
load_gtex_medians <- function(file_path, gene_symbols) {
  cat("\nLoading GTEx median expression data from:", file_path, "\n")
  
  gtex_data <- read_tsv(file_path, show_col_types = FALSE)
  
  # GTEx file structure: Name (col1), Description (col2), trim_Name (col3), then tissues
  # Gene symbols are in "Description" column (column 2)
  gene_col <- "Description"
  
  # Check if Description column exists, if not try other common names
  if (!gene_col %in% colnames(gtex_data)) {
    # Try alternative column names
    possible_cols <- c("Description", "Gene", "gene", "Gene_Symbol", "gene_symbol", 
                       "HGNC", "hgnc_symbol", "Symbol")
    gene_col <- NULL
    for (col in possible_cols) {
      if (col %in% colnames(gtex_data)) {
        gene_col <- col
        break
      }
    }
    if (is.null(gene_col)) {
      # Fall back to second column
      gene_col <- colnames(gtex_data)[2]
      cat("  Warning: Using column 2 (", gene_col, ") for gene matching\n")
    }
  }
  
  cat("  Using column '", gene_col, "' for gene matching\n")
  
  gene_symbols_upper <- toupper(gene_symbols)
  gtex_data[[gene_col]] <- toupper(trimws(as.character(gtex_data[[gene_col]])))
  
  # Filter to input genes
  gtex_filtered <- gtex_data %>%
    filter(.data[[gene_col]] %in% gene_symbols_upper)
  
  if (nrow(gtex_filtered) == 0) {
    cat("  Warning: No exact matches found. Checking first few genes in GTEx file:\n")
    cat("  Sample GTEx genes:", paste(head(unique(gtex_data[[gene_col]]), 10), collapse = ", "), "\n")
    cat("  Sample input genes:", paste(head(gene_symbols_upper, 10), collapse = ", "), "\n")
    stop("No matching genes found in GTEx TSV file. Check gene symbol format.")
  }
  
  cat("  Found", nrow(gtex_filtered), "matching genes out of", 
      length(gene_symbols_upper), "input genes\n")
  
  # Remove non-tissue columns (Name, Description, trim_Name, etc.)
  # Keep only tissue expression columns (numeric columns)
  tissue_cols <- sapply(gtex_filtered, is.numeric)
  gtex_matrix_raw <- as.matrix(gtex_filtered[, tissue_cols, drop = FALSE])
  rownames(gtex_matrix_raw) <- gtex_filtered[[gene_col]]
  
  # Create matrix with all input genes in order (fill missing with NA)
  gtex_matrix <- matrix(NA, 
                       nrow = length(gene_symbols_upper), 
                       ncol = ncol(gtex_matrix_raw),
                       dimnames = list(gene_symbols_upper, colnames(gtex_matrix_raw)))
  
  # Fill in available data
  available_genes <- intersect(gene_symbols_upper, rownames(gtex_matrix_raw))
  gtex_matrix[available_genes, ] <- gtex_matrix_raw[available_genes, ]
  
  cat("  Loaded data for", length(available_genes), "genes (", 
      length(gene_symbols_upper) - length(available_genes), 
      "missing) and", ncol(gtex_matrix), "tissues\n")
  
  return(gtex_matrix)
}

# Process GTEx data - scale and convert TPM to categories
process_gtex_data <- function(gtex_medians_file, gene_symbols) {
  gtex_raw <- load_gtex_medians(gtex_medians_file, gene_symbols)
  
  cat("\nScaling GTEx expression values...\n")
  
  # Scale GTEx values: log2 transform first, then z-score normalize per gene (row-wise)
  # This shows relative expression across tissues for each gene
  gtex_log2 <- log2(gtex_raw + 0.01)  # Add small pseudocount to avoid log(0)
  
  # Z-score normalization per gene (row-wise)
  # For each gene, normalize across all tissues
  gtex_scaled <- t(apply(gtex_log2, 1, function(x) {
    if (sum(!is.na(x)) < 2) {
      return(x)  # Not enough data to scale
    }
    x_mean <- mean(x, na.rm = TRUE)
    x_sd <- sd(x, na.rm = TRUE)
    if (is.na(x_sd) || x_sd == 0) {
      return(x - x_mean)  # Center only if no variance
    }
    return((x - x_mean) / x_sd)
  }))
  
  dimnames(gtex_scaled) <- dimnames(gtex_raw)
  
  cat("  Applied log2 transformation and z-score normalization per gene\n")
  cat("  Scaled value range:", round(min(gtex_scaled, na.rm = TRUE), 2), "to", 
      round(max(gtex_scaled, na.rm = TRUE), 2), "\n")
  
  # Convert scaled z-scores to categories based on thresholds
  # High: z-score >= 1 (above average)
  # Medium: 0 <= z-score < 1 (near average to above average)
  # Low: -1 <= z-score < 0 (below average)
  # Not Detected: z-score < -1 (very low)
  # Not Available: NA
  gtex_categorical <- apply(gtex_scaled, c(1, 2), function(x) {
    if (is.na(x) || is.null(x)) {
      return("Not Available")
    } else if (x >= 1) {
      return("High")
    } else if (x >= 0) {
      return("Medium")
    } else if (x >= -1) {
      return("Low")
    } else {
      return("Not Detected")
    }
  })
  
  gtex_matrix <- matrix(
    as.character(gtex_categorical),
    nrow = nrow(gtex_categorical),
    ncol = ncol(gtex_categorical),
    dimnames = dimnames(gtex_categorical)
  )
  
  return(gtex_matrix)
}

# Prepare TCGA matrix for heatmap
prepare_tcga_matrix <- function(tcga_data, gene_symbols, cohorts = TCGA_COHORTS) {
  cat("\nPreparing TCGA data matrix...\n")
  
  # Debug: Check if CDH1 is in the data
  if ("CDH1" %in% gene_symbols) {
    cdh1_data <- tcga_data %>% filter(gene == "CDH1")
    cat("  DEBUG CDH1: Found", nrow(cdh1_data), "rows in tcga_data\n")
    if (nrow(cdh1_data) > 0) {
      cat("  DEBUG CDH1: Cohorts with data:", 
          paste(unique(cdh1_data$cohort), collapse = ", "), "\n")
      cat("  DEBUG CDH1: Non-NA log2fc values:", 
          sum(!is.na(cdh1_data$log2fc)), "\n")
    }
  }
  
  tcga_wide <- tcga_data %>%
    select(gene, cohort, log2fc) %>%
    pivot_wider(names_from = cohort, values_from = log2fc) %>%
    column_to_rownames("gene")
  
  # Ensure all genes and cohorts are present
  tcga_matrix <- matrix(NA, nrow = length(gene_symbols), ncol = length(cohorts),
                       dimnames = list(gene_symbols, cohorts))
  
  for (gene in gene_symbols) {
    if (gene %in% rownames(tcga_wide)) {
      for (cohort in cohorts) {
        if (cohort %in% colnames(tcga_wide)) {
          tcga_matrix[gene, cohort] <- tcga_wide[gene, cohort]
        }
      }
    }
  }
  
  # Debug: Check CDH1 in final matrix
  if ("CDH1" %in% gene_symbols) {
    cdh1_row <- tcga_matrix["CDH1", ]
    cat("  DEBUG CDH1: Final matrix - Non-NA values:", 
        sum(!is.na(cdh1_row)), "out of", length(cdh1_row), "cohorts\n")
  }
  
  # Remove columns (cohorts) where all genes are NA
  cols_all_na <- colSums(!is.na(tcga_matrix)) == 0
  if (sum(cols_all_na) > 0) {
    removed_cohorts <- colnames(tcga_matrix)[cols_all_na]
    cat("  Removing", sum(cols_all_na), "cohorts with no data:", 
        paste(removed_cohorts, collapse = ", "), "\n")
    tcga_matrix <- tcga_matrix[, !cols_all_na, drop = FALSE]
  }
  
  cat("  Matrix dimensions:", nrow(tcga_matrix), "genes x", 
      ncol(tcga_matrix), "cohorts\n")
  
  return(tcga_matrix)
}

# Create TCGA heatmap (ComplexHeatmap)
create_tcga_heatmap <- function(tcga_matrix, 
                                color_bins = TCGA_COLOR_BINS,
                                show_row_names = TRUE,
                                show_column_names = TRUE,
                                row_names_size = 8,
                                column_names_size = 6,
                                column_names_rot = 45,
                                row_groups = NULL,
                                highlight_cohorts = NULL) {
  cat("\nCreating TCGA heatmap...\n")
  
  # Convert log2FC to bins for coloring
  tcga_bins <- apply(tcga_matrix, c(1, 2), categorize_log2fc)
  
  # Calculate dimensions for square cells
  n_rows <- nrow(tcga_matrix)
  n_cols <- ncol(tcga_matrix)
  
  # Set equal unit size for rows and columns to make cells square
  # Use the same unit size per cell for both dimensions
  cell_size <- 0.5  # Size in cm per cell
  
  # Prepare column highlighting if cohorts are specified
  if (!is.null(highlight_cohorts) && length(highlight_cohorts) > 0) {
    # Match highlighted cohorts to actual column names
    cohort_names <- colnames(tcga_matrix)
    highlighted <- cohort_names %in% highlight_cohorts
    
    if (sum(highlighted) > 0) {
      cat("  Highlighting", sum(highlighted), "cohorts:", 
          paste(cohort_names[highlighted], collapse = ", "), "\n")
    }
  }
  
  # Prepare row splitting if groups are provided
  row_split <- NULL
  row_annotation <- NULL
  
  if (!is.null(row_groups)) {
    # Match genes in matrix to groups (all genes, including those without groups)
    gene_names <- rownames(tcga_matrix)
    matched_groups <- row_groups[gene_names]
    
    # Count genes with and without groups
    has_group <- !is.na(matched_groups)
    
    if (sum(has_group) > 0) {
      # Create row split vector for ALL genes (must match matrix row order)
      # Convert to character, keeping NA values as NA (not "NA" string)
      # Genes without groups will have NA and won't be split
      row_split <- matched_groups
      # Convert to character vector, preserving NA values
      row_split <- ifelse(is.na(row_split), NA_character_, as.character(row_split))
      # Remove names to avoid issues with ComplexHeatmap
      names(row_split) <- NULL
      
      # Create row annotation data frame for ALL genes
      row_annotation_df <- data.frame(
        Group = matched_groups,
        row.names = gene_names,
        stringsAsFactors = FALSE
      )
      
      # Create row annotation with colors
      # Generate distinct, readable colors for each group
      # Use a better color palette than rainbow for better distinction
      unique_groups <- sort(unique(matched_groups[has_group]))  # Sort for consistent ordering
      n_groups <- length(unique_groups)
      
      # Use a more distinct color palette
      if (n_groups <= 8) {
        # Use RColorBrewer Set2 or Set3 for better distinction
        group_colors <- RColorBrewer::brewer.pal(max(3, n_groups), "Set2")[1:n_groups]
      } else if (n_groups <= 12) {
        group_colors <- RColorBrewer::brewer.pal(n_groups, "Set3")
      } else {
        # For many groups, use a combination of Set2 and Set3
        group_colors <- c(
          RColorBrewer::brewer.pal(8, "Set2"),
          RColorBrewer::brewer.pal(min(12, n_groups - 8), "Set3")
        )[1:n_groups]
      }
      names(group_colors) <- unique_groups
      
      # Create row annotation - pass vector directly, not data frame column
      row_annotation <- rowAnnotation(
        "Gene Group" = matched_groups,  # Pass vector directly
        col = list("Gene Group" = group_colors),
        show_annotation_name = FALSE,  # Hide annotation name label on the left
        width = unit(0.8, "cm"),  # Wider annotation bar for better visibility
        na_col = "lightgray",  # Light gray for genes without groups
        # Explicit legend parameters - match font sizes with other legends
        annotation_legend_param = list(
          "Gene Group" = list(
            title = "Gene Group",
            title_position = "topcenter",
            direction = "horizontal",  # Arrange horizontally when at bottom
            nrow = 1,  # Single row for horizontal layout
            grid_height = unit(0.8, "cm"),  # 20% smaller than before (was 1.0cm)
            grid_width = unit(0.8, "cm")   # 20% smaller than before (was 1.0cm)
            # Use default font sizes to match other legends
          )
        ),
        # Ensure legend is shown
        show_legend = TRUE
      )
      
      cat("  Splitting", sum(has_group), "genes into", n_groups, "groups")
      if (sum(!has_group) > 0) {
        cat(" (", sum(!has_group), "genes without groups)\n", sep = "")
      } else {
        cat("\n")
      }
    } else {
      cat("  Warning: No genes matched to groups, skipping row splitting\n")
    }
  }
  
  # Create heatmap with categorical colors
  ht_tcga <- Heatmap(
    tcga_bins,
    name = "Log2FC",
    col = color_bins,
    cluster_rows = FALSE,
    cluster_columns = FALSE,
    show_row_names = show_row_names,
    row_names_side = "right",  # Gene labels on the right
    show_column_names = show_column_names,
    row_names_gp = gpar(fontsize = row_names_size),
    column_names_gp = gpar(fontsize = column_names_size),
    column_names_rot = column_names_rot,  # Rotate column names (45 degrees)
    rect_gp = gpar(col = "white", lwd = 0.5),
    # Set equal unit sizes for rows and columns to make cells square
    width = n_cols * unit(cell_size, "cm"),
    height = n_rows * unit(cell_size, "cm"),
    # Row splitting by groups
    row_split = row_split,
    # Hide row split titles (group names on the far left)
    row_title = NULL,  # Remove group name labels
    # Row annotation on the left
    left_annotation = row_annotation,
    heatmap_legend_param = list(
      title = "Log2 Fold Change",
      at = names(color_bins),
      labels = names(color_bins),
      title_position = "topcenter",
      direction = "horizontal",  # Arrange horizontally when at bottom
      nrow = 1  # Single row for horizontal layout
    ),
    # Add text annotations with actual log2FC values and column borders
    cell_fun = function(j, i, x, y, width, height, fill) {
      log2fc_val <- tcga_matrix[i, j]
      if (!is.na(log2fc_val)) {
        grid.text(sprintf("%.2f", log2fc_val), x, y, 
                 gp = gpar(fontsize = 5, col = "black"))
      }
      
      # Draw black border around highlighted columns
      if (!is.null(highlight_cohorts) && length(highlight_cohorts) > 0) {
        cohort_name <- colnames(tcga_matrix)[j]
        if (cohort_name %in% highlight_cohorts) {
          # Draw thick black border around the entire column
          grid.rect(x, y, width, height, 
                   gp = gpar(fill = NA, col = "black", lwd = 2))
        }
      }
    }
  )
  
  return(ht_tcga)
}

# Create GTEx heatmap (ComplexHeatmap)
create_gtex_heatmap <- function(gtex_matrix,
                               color_map = GTEX_COLORS,
                               show_row_names = FALSE,
                               show_column_names = TRUE,
                               row_names_size = 8,
                               column_names_size = 6,
                               column_names_rot = 45,
                               row_groups = NULL,
                               highlight_tissues = NULL) {
  cat("\nCreating GTEx heatmap...\n")
  
  # Calculate dimensions for square cells
  n_rows <- nrow(gtex_matrix)
  n_cols <- ncol(gtex_matrix)
  
  # Set equal unit size for rows and columns to make cells square
  cell_size <- 0.5  # Size in cm per cell (same as TCGA panel)
  
  # Prepare column highlighting if tissues are specified
  if (!is.null(highlight_tissues) && length(highlight_tissues) > 0) {
    # Match highlighted tissues to actual column names
    tissue_names <- colnames(gtex_matrix)
    highlighted <- tissue_names %in% highlight_tissues
    
    if (sum(highlighted) > 0) {
      cat("  Highlighting", sum(highlighted), "tissues:", 
          paste(tissue_names[highlighted], collapse = ", "), "\n")
    }
  }
  
  # Prepare row splitting if groups are provided (must match TCGA heatmap)
  row_split <- NULL
  
  if (!is.null(row_groups)) {
    # Match genes in matrix to groups (all genes, including those without groups)
    gene_names <- rownames(gtex_matrix)
    matched_groups <- row_groups[gene_names]
    
    # Create row split vector for ALL genes (must match matrix row order and TCGA heatmap)
    # Convert to character, preserving NA values
    # Genes without groups will have NA and won't be split
    if (sum(!is.na(matched_groups)) > 0) {
      row_split <- matched_groups
      # Convert to character vector, preserving NA values
      row_split <- ifelse(is.na(row_split), NA_character_, as.character(row_split))
      names(row_split) <- NULL
      cat("  Using same row splitting as TCGA heatmap\n")
    }
  }
  
  ht_gtex <- Heatmap(
    gtex_matrix,
    name = "Expression Level",
    col = color_map,
    cluster_rows = FALSE,
    cluster_columns = FALSE,
    show_row_names = TRUE,  # Show gene names on GTEx panel
    row_names_side = "right",  # Gene labels on the right
    show_column_names = show_column_names,
    row_names_gp = gpar(fontsize = row_names_size),
    column_names_gp = gpar(fontsize = column_names_size),
    column_names_rot = column_names_rot,  # Rotate column names (45 degrees)
    rect_gp = gpar(col = "white", lwd = 0.5),
    # Set equal unit sizes for rows and columns to make cells square
    width = n_cols * unit(cell_size, "cm"),
    height = n_rows * unit(cell_size, "cm"),
    # Row splitting by groups (must match TCGA heatmap for alignment)
    row_split = row_split,
    # Hide row split titles (group names on the far left)
    row_title = NULL,  # Remove group name labels
    heatmap_legend_param = list(
      title = "Expression Level",
      at = names(color_map),
      labels = names(color_map),
      title_position = "topcenter",
      direction = "horizontal",  # Arrange horizontally when at bottom
      nrow = 1  # Single row for horizontal layout
    ),
    # Draw black borders around highlighted columns
    cell_fun = function(j, i, x, y, width, height, fill) {
      # Draw black border around highlighted columns
      if (!is.null(highlight_tissues) && length(highlight_tissues) > 0) {
        tissue_name <- colnames(gtex_matrix)[j]
        if (tissue_name %in% highlight_tissues) {
          # Draw thick black border around the entire column
          grid.rect(x, y, width, height, 
                   gp = gpar(fill = NA, col = "black", lwd = 2))
        }
      }
    }
  )
  
  return(ht_gtex)
}

# Combine panels and save
combine_and_save <- function(tcga_heatmap, gtex_heatmap, 
                             output_file = "tcga_gtex_heatmap.pdf",
                             width = 20, height = 12) {
  cat("\nCombining panels and saving to:", output_file, "\n")
  
  pdf(output_file, width = width, height = height)
  
  # Draw both heatmaps side by side with legends below
  draw(
    tcga_heatmap + gtex_heatmap,
    # Position legends below the heatmaps
    heatmap_legend_side = "bottom",
    annotation_legend_side = "bottom",
    ht_gap = unit(0.5, "cm"),
    # Increase bottom padding for legends, reduce right padding
    padding = unit(c(2, 1, 6, 2), "cm")  # top, right, bottom, left
  )
  
  dev.off()
  
  cat("  Saved successfully!\n")
}

# ============================================================================
# Main Function
# ============================================================================
 
generate_tcga_gtex_heatmap <- function(
  gene_list_file,
  gtex_tsv_file="gtex_data_in.medians.tsv",
  output_file = "tcga_gtex_heatmap.pdf",
  tcga_cohorts = TCGA_COHORTS,
  delay = 0.5,
  use_cache = TRUE,
  width = 20,
  height = 12,
  show_progress = TRUE,
  gene_annotation_file = NULL,
  highlight_cohorts = NULL,
  highlight_tissues = NULL
) {
  if (!file.exists(gtex_tsv_file)){
    log_info("no gtex file")
    stop()
  }
  cat("=", rep("=", 70), "\n", sep = "")
  cat("TCGA-GTEx Dual Panel Heatmap Generation\n")
  cat("=", rep("=", 70), "\n", sep = "")
  
  # 1. Load gene list
  gene_symbols <- load_gene_list(gene_list_file)
  
  # 2. Load gene annotations if provided
  row_groups <- NULL
  if (!is.null(gene_annotation_file) && gene_annotation_file != "") {
    row_groups <- load_gene_annotations(gene_annotation_file, gene_symbols)
    if (is.null(row_groups)) {
      cat("  Warning: No valid gene-group mappings found. Proceeding without row splitting.\n")
    }
  }
  
  # 3. Process TCGA data
  tcga_data <- process_tcga_data(gene_symbols, cohorts = tcga_cohorts, 
                                 delay = delay, show_progress = show_progress,
                                 use_cache = use_cache)
  
  # 4. Process GTEx data
  gtex_matrix <- process_gtex_data(gtex_tsv_file, gene_symbols)
  
  # 5. Prepare TCGA matrix (ensure same gene order)
  tcga_matrix <- prepare_tcga_matrix(tcga_data, gene_symbols, tcga_cohorts)
  
  # 6. Ensure both matrices have identical gene order
  cat("\nEnsuring consistent gene ordering between panels...\n")
  common_genes <- intersect(rownames(tcga_matrix), rownames(gtex_matrix))
  cat("  Common genes:", length(common_genes), "\n")
  
  # Reorder both matrices to match input gene order
  tcga_matrix <- tcga_matrix[gene_symbols, , drop = FALSE]
  gtex_matrix <- gtex_matrix[gene_symbols, , drop = FALSE]
  
  # Remove rows that are all NA (genes with no data)
  tcga_has_data <- rowSums(!is.na(tcga_matrix)) > 0
  gtex_has_data <- rowSums(!is.na(gtex_matrix)) > 0
  genes_with_data <- gene_symbols[tcga_has_data | gtex_has_data]
  
  if (length(genes_with_data) < length(gene_symbols)) {
    cat("  Filtering to", length(genes_with_data), "genes with data\n")
    tcga_matrix <- tcga_matrix[genes_with_data, , drop = FALSE]
    gtex_matrix <- gtex_matrix[genes_with_data, , drop = FALSE]
  }
  
  # 7. Prepare row groups for heatmaps (filter to genes with data)
  if (!is.null(row_groups)) {
    # Filter row_groups to only include genes that have data
    row_groups_filtered <- row_groups[names(row_groups) %in% genes_with_data]
    if (length(row_groups_filtered) > 0) {
      row_groups <- row_groups_filtered
      # Reorder to match matrix row order
      row_groups <- row_groups[genes_with_data]
    } else {
      row_groups <- NULL
    }
  }
  
  # 8. Create heatmaps with row splitting if groups are provided
  tcga_heatmap <- create_tcga_heatmap(tcga_matrix, 
                                      row_groups = row_groups,
                                      highlight_cohorts = highlight_cohorts)
  gtex_heatmap <- create_gtex_heatmap(gtex_matrix, 
                                      row_groups = row_groups,
                                      highlight_tissues = highlight_tissues)
  
  # 9. Combine and save
  combine_and_save(tcga_heatmap, gtex_heatmap, output_file, width, height)
  
  cat("\nDone!\n")
  
  return(list(
    tcga_data = tcga_data,
    gtex_matrix = gtex_matrix,
    tcga_matrix = tcga_matrix,
    tcga_heatmap = tcga_heatmap,
    gtex_heatmap = gtex_heatmap,
    row_groups = row_groups
  ))
}

# Parse comma-separated list from command line
parse_comma_list <- function(arg_string) {
  if (is.null(arg_string) || arg_string == "" || arg_string == "NULL") {
    return(NULL)
  }
  # Split by comma and trim whitespace
  items <- strsplit(arg_string, ",")[[1]]
  items <- trimws(items)
  items <- items[items != ""]
  if (length(items) == 0) {
    return(NULL)
  }
  return(items)
}

# ============================================================================
# Command-line execution
# ============================================================================

main <- function() {
  args <- commandArgs(trailingOnly = TRUE)
  
  if (length(args) < 2) {
    stop("Usage: Rscript tcga_gtex_heatmap.R <gene_list_file> <gtex_tsv_file> [output_file] [gene_annotation_file] [highlight_cohorts] [highlight_tissues]\n",
         "  gene_list_file      - Path to text file with HGNC gene symbols (one per line)\n",
         "  gtex_tsv_file       - Path to GTEx median expression TSV file\n",
         "  output_file         - Path to output PDF file (default: tcga_gtex_heatmap.pdf)\n",
         "  gene_annotation_file - Optional: Path to TSV/CSV file with Gene and Group/Category columns\n",
         "  highlight_cohorts   - Optional: Comma-separated list of TCGA cohorts to highlight (e.g., \"LUAD,LUSC\")\n",
         "  highlight_tissues   - Optional: Comma-separated list of GTEx tissues to highlight (e.g., \"Lung\")")
  }
  
  gene_list_file <- args[1]
  gtex_tsv_file <- args[2]
  output_file <- if (length(args) >= 3) args[3] else "tcga_gtex_heatmap.pdf"
  gene_annotation_file <- if (length(args) >= 4) args[4] else NULL
  highlight_cohorts <- if (length(args) >= 5) parse_comma_list(args[5]) else NULL
  highlight_tissues <- if (length(args) >= 6) parse_comma_list(args[6]) else NULL
  
  if (!file.exists(gene_list_file)) {
    stop("Gene list file not found: ", gene_list_file)
  }
  
  if (!file.exists(gtex_tsv_file)) {
    stop("GTEx TSV file not found: ", gtex_tsv_file)
  }
  
  result <- generate_tcga_gtex_heatmap(
    gene_list_file = gene_list_file,
    gtex_tsv_file = gtex_tsv_file,
    output_file = output_file,
    gene_annotation_file = gene_annotation_file,
    highlight_cohorts = highlight_cohorts,
    highlight_tissues = highlight_tissues
  )
}

if (!interactive()) {
  main()
}

