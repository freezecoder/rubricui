#!/usr/bin/env Rscript
# TCGA-GTEx Dual Panel Heatmap - Left Panel (TCGA)
# Generates heatmap showing log2 fold change (tumor vs normal) for genes across TCGA cohorts
#
# Usage:
#   Rscript tcga_heatmap_left_panel.R [gene_list_file] [output_file]
#
# Arguments:
#   gene_list_file - Path to text file with HGNC gene symbols (one per line)
#   output_file    - Path to output PDF file (default: tcga_heatmap.pdf)

# Load required libraries
suppressPackageStartupMessages({
  library(httr)
  library(jsonlite)
  library(dplyr)
  library(tidyr)
  library(tibble)
  library(grid)
  library(RColorBrewer)
  library(readr)
  library(stringr)
  library(ComplexHeatmap)
  library(circlize)
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

# Color scheme for log2FC bins (matching reference image)
TCGA_COLOR_BINS <- c(
  "> 5" = "#B2182B",         # Dark Red
  "3 - 5" = "#D6604D",       # Medium Red
  "1 - 3" = "#F4A582",       # Orange-Red
  "0 - 1" = "#92C5DE",       # Light Blue
  "< 0" = "#4393C3",         # Blue
  "P >= 0.05" = "#F7F7F7",   # Very Light Grey/White (for non-significant, not yet implemented)
  "Not Available" = "#F0F0F0" # Light Grey for missing data
)

# ============================================================================
# Function: Initialize cache directory
# ============================================================================
init_cache_dir <- function(cache_dir = CACHE_DIR) {
  if (!dir.exists(cache_dir)) {
    dir.create(cache_dir, recursive = TRUE)
    cat("Created cache directory:", cache_dir, "\n")
  }
  return(cache_dir)
}

# ============================================================================
# Function: Get cache file path for a gene and sample type (raw API data)
# ============================================================================
get_cache_file_path <- function(gene_symbol, sample_type, cache_dir = CACHE_DIR) {
  # Create safe filename (uppercase gene symbol, sample type)
  safe_gene <- toupper(gene_symbol)
  safe_sample <- tolower(sample_type)
  filename <- sprintf("%s_%s.rds", safe_gene, safe_sample)
  file.path(cache_dir, filename)
}

# ============================================================================
# Function: Get cache file path for combined gene data (with log2FC)
# ============================================================================
get_combined_cache_file_path <- function(gene_symbol, cache_dir = CACHE_DIR) {
  # Create safe filename for combined gene data
  safe_gene <- toupper(gene_symbol)
  filename <- sprintf("%s_combined.rds", safe_gene)
  file.path(cache_dir, filename)
}

# ============================================================================
# Function: Load data from cache
# ============================================================================
load_from_cache <- function(gene_symbol, sample_type, cache_dir = CACHE_DIR) {
  cache_file <- get_cache_file_path(gene_symbol, sample_type, cache_dir)
  
  if (file.exists(cache_file)) {
    tryCatch({
      cached_data <- readRDS(cache_file)
      return(cached_data)
    }, error = function(e) {
      warning(sprintf("Error reading cache file %s: %s", cache_file, e$message))
      return(NULL)
    })
  }
  
  return(NULL)
}

# ============================================================================
# Function: Save data to cache
# ============================================================================
save_to_cache <- function(data, gene_symbol, sample_type, cache_dir = CACHE_DIR) {
  if (is.null(data)) {
    return(invisible(NULL))
  }
  
  # Ensure cache directory exists
  init_cache_dir(cache_dir)
  
  cache_file <- get_cache_file_path(gene_symbol, sample_type, cache_dir)
  
  tryCatch({
    saveRDS(data, cache_file)
    return(TRUE)
  }, error = function(e) {
    warning(sprintf("Error saving cache file %s: %s", cache_file, e$message))
    return(FALSE)
  })
}

# ============================================================================
# Function: Load gene list from file
# ============================================================================
load_gene_list <- function(file_path) {
  cat("Loading gene list from:", file_path, "\n")
  
  # Read file
  lines <- readLines(file_path, warn = FALSE)
  
  # Remove empty lines and comments
  lines <- lines[!str_detect(str_trim(lines), "^#")]
  lines <- lines[str_trim(lines) != ""]
  
  # Extract gene symbols (uppercase, remove whitespace)
  gene_symbols <- str_trim(toupper(lines))
  gene_symbols <- unique(gene_symbols)
  
  cat("  Loaded", length(gene_symbols), "unique gene symbols\n")
  
  if (length(gene_symbols) == 0) {
    stop("No valid gene symbols found in file")
  }
  
  return(gene_symbols)
}

# ============================================================================
# Function: Fetch TCGA quartile data for a single gene (with caching)
# ============================================================================
fetch_tcga_quartiles <- function(gene_symbol, sample_type = "tumors", 
                                  cohorts = TCGA_COHORTS, 
                                  max_retries = 3, delay = 0.5,
                                  use_cache = TRUE, cache_dir = CACHE_DIR) {
  # Check cache first
  if (use_cache) {
    cached_data <- load_from_cache(gene_symbol, sample_type, cache_dir)
    if (!is.null(cached_data)) {
      return(cached_data)
    }
  }
  
  # Construct API URL
  cohort_string <- paste(cohorts, collapse = "%2C")  # URL encode comma
  url <- sprintf(
    "%s?format=json&gene=%s&cohort=%s&protocol=RSEM&sample_type=%s",
    FIREBROWSE_BASE_URL,
    gene_symbol,
    cohort_string,
    sample_type
  )
  
  # Retry logic
  result <- NULL
  for (attempt in 1:max_retries) {
    tryCatch({
      # Make API request
      response <- GET(url, timeout(30))
      
      # Check HTTP status
      if (status_code(response) != 200) {
        if (attempt < max_retries) {
          Sys.sleep(delay * attempt)
          next
        }
        warning(sprintf("API request failed for %s (%s): HTTP %d", 
                       gene_symbol, sample_type, status_code(response)))
        return(NULL)
      }
      
      # Parse JSON response
      content <- content(response, "text", encoding = "UTF-8")
      data <- fromJSON(content)
      
      # Extract quartiles data
      if (!is.null(data$mRNASeq_Quartiles) && length(data$mRNASeq_Quartiles) > 0) {
        quartiles <- data$mRNASeq_Quartiles
        
        # Extract relevant fields
        result <- quartiles %>%
          select(cohort, median) %>%
          mutate(
            gene = gene_symbol,
            sample_type = sample_type
          )
        
        # Save to cache
        if (use_cache) {
          save_to_cache(result, gene_symbol, sample_type, cache_dir)
        }
        
        return(result)
      } else {
        warning(sprintf("No quartiles data returned for %s (%s)", 
                       gene_symbol, sample_type))
        return(NULL)
      }
      
    }, error = function(e) {
      if (attempt < max_retries) {
        Sys.sleep(delay * attempt)
        return(NULL)  # Will retry
      }
      warning(sprintf("Error fetching data for %s (%s): %s", 
                     gene_symbol, sample_type, e$message))
      return(NULL)
    })
  }
  
  return(NULL)
}

# ============================================================================
# Function: Load combined gene data from cache (with log2FC already computed)
# ============================================================================
load_combined_from_cache <- function(gene_symbol, cache_dir = CACHE_DIR) {
  cache_file <- get_combined_cache_file_path(gene_symbol, cache_dir)
  
  if (file.exists(cache_file)) {
    tryCatch({
      cached_data <- readRDS(cache_file)
      return(cached_data)
    }, error = function(e) {
      warning(sprintf("Error reading combined cache file %s: %s", cache_file, e$message))
      return(NULL)
    })
  }
  
  return(NULL)
}

# ============================================================================
# Function: Save combined gene data to cache (with log2FC computed)
# ============================================================================
save_combined_to_cache <- function(data, gene_symbol, cache_dir = CACHE_DIR) {
  if (is.null(data)) {
    return(invisible(NULL))
  }
  
  # Ensure cache directory exists
  init_cache_dir(cache_dir)
  
  cache_file <- get_combined_cache_file_path(gene_symbol, cache_dir)
  
  tryCatch({
    saveRDS(data, cache_file)
    return(TRUE)
  }, error = function(e) {
    warning(sprintf("Error saving combined cache file %s: %s", cache_file, e$message))
    return(FALSE)
  })
}

# ============================================================================
# Function: Fetch TCGA data for tumor and normal samples and compute log2FC
# ============================================================================
fetch_tcga_gene_data <- function(gene_symbol, cohorts = TCGA_COHORTS, 
                                  delay = 0.5, use_cache = TRUE, cache_dir = CACHE_DIR) {
  cat("  Fetching TCGA data for", gene_symbol, "...")
  
  # Check if combined data is already cached (with log2FC computed)
  if (use_cache) {
    combined_cached <- load_combined_from_cache(gene_symbol, cache_dir)
    if (!is.null(combined_cached)) {
      cat(" (cached)\n")
      return(combined_cached)
    }
  }
  
  # Need to fetch from API - make 2 calls (tumors and normals)
  # Check if individual tumor/normal data is cached
  tumor_cached <- use_cache && !is.null(load_from_cache(gene_symbol, "tumors", cache_dir))
  
  # Fetch tumor data (will use cache if available)
  tumor_data <- fetch_tcga_quartiles(gene_symbol, "tumors", cohorts, 
                                      delay = delay, use_cache = use_cache, 
                                      cache_dir = cache_dir)
  
  # Only add delay if we actually made an API call (not from cache)
  if (!tumor_cached && !is.null(tumor_data)) {
    Sys.sleep(delay)  # Rate limiting only if we fetched from API
  }
  
  # Check if normal data is cached
  normal_cached <- use_cache && !is.null(load_from_cache(gene_symbol, "normals", cache_dir))
  
  # Fetch normal data (will use cache if available)
  normal_data <- fetch_tcga_quartiles(gene_symbol, "normals", cohorts, 
                                       delay = delay, use_cache = use_cache, 
                                       cache_dir = cache_dir)
  
  # Only add delay if we actually made an API call (not from cache)
  if (!normal_cached && !is.null(normal_data)) {
    Sys.sleep(delay)  # Rate limiting only if we fetched from API
  }
  
  # Combine data
  if (is.null(tumor_data) && is.null(normal_data)) {
    cat(" FAILED\n")
    return(NULL)
  }
  
  # Merge tumor and normal data by cohort
  if (!is.null(tumor_data) && !is.null(normal_data)) {
    combined <- tumor_data %>%
      select(cohort, median) %>%
      rename(tumor_median = median) %>%
      left_join(
        normal_data %>% 
          select(cohort, median) %>% 
          rename(normal_median = median),
        by = "cohort"
      ) %>%
      mutate(gene = gene_symbol)
  } else if (!is.null(tumor_data)) {
    # Only tumor data available
    combined <- tumor_data %>%
      select(cohort, median) %>%
      rename(tumor_median = median) %>%
      mutate(
        normal_median = NA_real_,
        gene = gene_symbol
      )
  } else {
    # Only normal data available (unlikely but handle it)
    combined <- normal_data %>%
      select(cohort, median) %>%
      rename(normal_median = median) %>%
      mutate(
        tumor_median = NA_real_,
        gene = gene_symbol
      )
  }
  
  # Calculate log2FC for each gene-cohort combination
  combined <- combined %>%
    mutate(
      log2fc = mapply(calculate_log2fc, tumor_median, normal_median),
      log2fc_bin = categorize_log2fc(log2fc)
    )
  
  # Cache the combined result (with log2FC computed)
  if (use_cache) {
    save_combined_to_cache(combined, gene_symbol, cache_dir)
  }
  
  cat(" OK\n")
  return(combined)
}

# ============================================================================
# Function: Calculate log2 fold change
# ============================================================================
calculate_log2fc <- function(tumor_median, normal_median, pseudocount = 0.01) {
  # Handle missing values
  if (is.na(tumor_median) || is.na(normal_median)) {
    return(NA_real_)
  }
  
  # Handle zero or negative values
  if (normal_median <= 0) {
    return(NA_real_)
  }
  
  if (tumor_median <= 0) {
    # Use pseudocount for very low expression
    tumor_median <- pseudocount
  }
  
  # Calculate log2 fold change
  log2fc <- log2(tumor_median / normal_median)
  
  return(log2fc)
}

# ============================================================================
# Function: Categorize log2FC into bins (vectorized)
# ============================================================================
categorize_log2fc <- function(log2fc) {
  # Vectorized version using ifelse (matching reference legend labels)
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

# ============================================================================
# Function: Process all genes and fetch TCGA data
# ============================================================================
process_tcga_data <- function(gene_symbols, cohorts = TCGA_COHORTS, 
                               delay = 0.5, show_progress = TRUE,
                               use_cache = TRUE, cache_dir = CACHE_DIR) {
  cat("\nProcessing", length(gene_symbols), "genes...\n")
  
  # Initialize cache directory
  if (use_cache) {
    init_cache_dir(cache_dir)
  }
  
  all_data <- list()
  cache_hits <- 0
  api_calls <- 0
  
  for (i in seq_along(gene_symbols)) {
    gene <- gene_symbols[i]
    
    if (show_progress) {
      cat(sprintf("[%d/%d] ", i, length(gene_symbols)))
    }
    
    # Check if combined data is cached (with log2FC already computed)
    combined_cached <- use_cache && !is.null(load_combined_from_cache(gene, cache_dir))
    
    if (combined_cached) {
      cache_hits <- cache_hits + 1
      if (show_progress) {
        cat("(cached) ")
      }
    } else {
      api_calls <- api_calls + 1
    }
    
    gene_data <- fetch_tcga_gene_data(gene, cohorts, delay = delay, 
                                      use_cache = use_cache, cache_dir = cache_dir)
    
    if (!is.null(gene_data)) {
      # log2FC is already computed in fetch_tcga_gene_data()
      all_data[[i]] <- gene_data
    }
    
    # Progress update
    if (show_progress && i %% 10 == 0) {
      cat(sprintf("\n  Progress: %d/%d genes processed\n", i, length(gene_symbols)))
    }
  }
  
  # Combine all data
  combined_data <- bind_rows(all_data)
  
  cat("\n  Total data points:", nrow(combined_data), "\n")
  cat("  Genes with data:", length(unique(combined_data$gene)), "\n")
  cat("  Cohorts with data:", length(unique(combined_data$cohort)), "\n")
  
  if (use_cache && show_progress) {
    cat("  Cache hits:", cache_hits, "genes\n")
    cat("  API calls:", api_calls, "genes\n")
  }
  
  return(combined_data)
}

# ============================================================================
# Function: Prepare data matrix for heatmap
# ============================================================================
prepare_heatmap_matrix <- function(tcga_data, gene_order = NULL, cohort_order = NULL) {
  # Use provided order or default to sorted
  if (is.null(gene_order)) {
    gene_order <- sort(unique(tcga_data$gene))
  }
  
  if (is.null(cohort_order)) {
    cohort_order <- sort(unique(tcga_data$cohort))
  }
  
  # Create matrix: genes (rows) x cohorts (columns)
  heatmap_matrix <- tcga_data %>%
    select(gene, cohort, log2fc) %>%
    pivot_wider(
      names_from = cohort,
      values_from = log2fc,
      values_fill = NA_real_
    ) %>%
    column_to_rownames("gene")
  
  # Reorder rows and columns
  heatmap_matrix <- heatmap_matrix[gene_order, cohort_order, drop = FALSE]
  
  return(heatmap_matrix)
}

# ============================================================================
# Function: Create TCGA heatmap visualization using ComplexHeatmap
# ============================================================================
create_tcga_heatmap <- function(tcga_data, 
                                gene_order = NULL,
                                cohort_order = NULL,
                                color_bins = TCGA_COLOR_BINS,
                                show_values = TRUE,
                                font_size = 7,
                                label_size = 8,
                                title = "TCGA Tumor Types - Log2 Fold Change") {
  
  # Prepare matrix
  log2fc_matrix <- prepare_heatmap_matrix(tcga_data, gene_order, cohort_order)
  
  # Ensure matrix is numeric
  log2fc_matrix <- as.matrix(log2fc_matrix)
  mode(log2fc_matrix) <- "numeric"
  
  # Create bin matrix for discrete colors
  bin_matrix <- log2fc_matrix
  bin_matrix[] <- categorize_log2fc(c(log2fc_matrix))
  
  # Convert bin matrix to factor with proper levels
  bin_matrix <- matrix(
    factor(bin_matrix, levels = names(color_bins)),
    nrow = nrow(bin_matrix),
    ncol = ncol(bin_matrix),
    dimnames = dimnames(bin_matrix)
  )
  
  # Create cell function for displaying values
  cell_fun <- NULL
  if (show_values) {
    cell_fun <- function(j, i, x, y, width, height, fill) {
      value <- log2fc_matrix[i, j]
      if (!is.na(value)) {
        grid.text(
          sprintf("%.2f", value),
          x, y,
          gp = gpar(fontsize = label_size, col = "black")
        )
      }
    }
  }
  
  # Create heatmap
  ht <- Heatmap(
    bin_matrix,
    name = "Log2 Fold Change",
    col = color_bins,
    cell_fun = cell_fun,
    cluster_rows = FALSE,
    cluster_columns = FALSE,
    row_names_gp = gpar(fontsize = font_size),
    column_names_gp = gpar(fontsize = 8),
    column_names_rot = 45,
    column_names_side = "bottom",
    row_names_side = "left",
    rect_gp = gpar(col = "black", lwd = 1),  # Solid black borders for grid
    heatmap_legend_param = list(
      title = "Log2 Fold\nChange",
      title_gp = gpar(fontsize = 10),
      labels_gp = gpar(fontsize = 9),
      legend_height = unit(4, "cm")
    ),
    column_title = title,
    column_title_gp = gpar(fontsize = 12, fontface = "bold")
  )
  
  return(ht)
}

# ============================================================================
# Function: Generate TCGA heatmap (main function)
# ============================================================================
generate_tcga_heatmap <- function(
  gene_list_file,
  output_file = "tcga_heatmap.pdf",
  cohorts = TCGA_COHORTS,
  width = 16,
  height = 10,
  delay = 0.5,
  show_progress = TRUE,
  save_data = TRUE,
  use_cache = TRUE,
  cache_dir = CACHE_DIR,
  label_size = 8
) {
  cat(paste0(rep("=", 60), collapse = ""), "\n")
  cat("TCGA Heatmap Generation\n")
  cat(paste0(rep("=", 60), collapse = ""), "\n\n")
  
  # Load gene list
  gene_symbols <- load_gene_list(gene_list_file)
  
  # Process TCGA data
  tcga_data <- process_tcga_data(gene_symbols, cohorts, delay, show_progress,
                                  use_cache = use_cache, cache_dir = cache_dir)
  
  if (is.null(tcga_data) || nrow(tcga_data) == 0) {
    stop("No TCGA data retrieved. Please check your gene list and network connection.")
  }
  
  # Create heatmap using ComplexHeatmap
  cat("\nCreating heatmap visualization...\n")
  cat("  Using ComplexHeatmap\n")
  
  ht <- create_tcga_heatmap(tcga_data, label_size = label_size)
  
  # Save ComplexHeatmap plot
  cat("Saving plot to:", output_file, "\n")
  pdf(output_file, width = width, height = height)
  draw(ht)
  dev.off()
  
  cat("  ✓ ComplexHeatmap saved successfully\n")
  
  # Save data if requested
  if (save_data) {
    data_file <- str_replace(output_file, "\\.pdf$", "_data.rds")
    cat("Saving data to:", data_file, "\n")
    saveRDS(tcga_data, data_file)
    
    csv_file <- str_replace(output_file, "\\.pdf$", "_data.csv")
    cat("Saving CSV to:", csv_file, "\n")
    write_csv(tcga_data, csv_file)
  }
  
  cat("\n✓ Complete!\n")
  
  return(list(
    plot = ht,
    data = tcga_data
  ))
}

# ============================================================================
# Main execution
# ============================================================================
if (!interactive()) {
  # Parse command line arguments
  args <- commandArgs(trailingOnly = TRUE)
  
  if (length(args) == 0) {
    # Default: use test genes
    cat("No arguments provided. Using default test gene list.\n")
    gene_list_file <- "test_genes.txt"
    
    # Create test gene file if it doesn't exist
    if (!file.exists(gene_list_file)) {
      test_genes <- c("EGFR", "MET", "ENPP3", "TACSTD2", "NECTIN4", "CD276", 
                     "EPHA10", "SEZ6L2", "MUC1", "CDH3", "TMPRSS4", "PLPP2",
                     "HAS3", "MUC21", "MUC3A", "HMMR", "PTPRH", "MUC16",
                     "CEACAM6", "CEACAM5", "TMC5", "DPP4", "GPRC5A", "SLC44A4",
                     "ST14", "CEACAM1", "EPCAM", "PTK7", "ACKR3", "CA6",
                     "SDK1", "PERP", "CDH1")
      writeLines(test_genes, gene_list_file)
      cat("Created test gene file:", gene_list_file, "\n")
    }
    
    output_file <- "tcga_heatmap.pdf"
  } else if (length(args) == 1) {
    gene_list_file <- args[1]
    output_file <- "tcga_heatmap.pdf"
  } else {
    gene_list_file <- args[1]
    output_file <- args[2]
  }
  
  # Generate heatmap
  result <- generate_tcga_heatmap(
    gene_list_file = gene_list_file,
    output_file = output_file
  )
}

