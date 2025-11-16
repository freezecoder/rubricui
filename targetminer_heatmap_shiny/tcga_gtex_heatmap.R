#!/usr/bin/env Rscript
# TCGA-GTEx Dual Panel Heatmap (with optional Rubric mode and Partner mode)
# Generates combined heatmap showing TCGA log2FC (left) and GTEx expression (right)
# In rubric mode: adds Rubric Score heatmap as leftmost panel
# In partner mode: generates separate heatmap for each anchor gene using partner genes (gene2_name)
#
# Usage:
#   Normal mode: Rscript tcga_gtex_heatmap.R --gene-list <file> --gtex-file <file> [options]
#   Rubric mode: Rscript tcga_gtex_heatmap.R --rubric <excel_file> --gtex-file <file> [options]
#   Partner mode: Rscript tcga_gtex_heatmap.R --partnerfile <excel_file> --gtex-file <file> [options]
#
# Required Arguments (one of):
#   --gene-list, -g     Path to text file with HGNC gene symbols (one per line) [required in normal mode]
#   --rubric            Path to rubric Excel file (triggers rubric mode - uses gene_symbol from rubric)
#   --partnerfile       Path to anchor partner Excel file (triggers partner mode - uses gene2_name as gene list per anchor)
#   --gtex-file, -x     Path to GTEx median expression TSV file
#
# Optional Arguments:
#   --output, -o         Path to output PDF file (default: tcga_gtex_heatmap.pdf)
#                        In partner mode, all anchor gene heatmaps are written to the same PDF file (one per page)
#   --title              Custom title for the heatmap chart
#   --gene-annotation    Path to TSV/CSV file with Gene and Group/Category columns
#   --highlight-cohorts Comma-separated list of TCGA cohorts to highlight (e.g., "LUAD,LUSC")
#   --highlight-tissues  Comma-separated list of GTEx tissues to highlight (e.g., "Lung")
#   --synonyms           Path to TSV/CSV file with gene synonyms (first col=gene, rest=synonyms)
#   --tcga-rds           Path to TCGA RDS file with pre-computed log2FC (default: tcga_log2data.RDS)
#                        Set to "NULL" to use API instead
#   --box-genes          Comma-separated list of genes to draw horizontal boxes around (e.g., "GeneA,GeneB")
#   --no-collapse        Disable collapsing GTEx tissues by top-level name (default: tissues are collapsed)
#   --topn               Number of top genes to select (default: 35 for rubric mode, 30 for partner mode)
#                        In rubric mode: sorted by SCORE_total
#                        In partner mode: top N partner genes per anchor gene
#   --rubric-zscore     Enable z-score normalization for rubric scores (default: normalization disabled)
#                        Only applies in rubric/partner mode. Total score (SCORE_total or SCORE_SUM_ANC_PARTNER) is never normalized.
#   --help, -h           Show this help message

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
  library(optparse)
  library(readxl)
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


read_rubric_data<-function(rubricfile="Scoring_Rubric_HNSC_HPV_Negative_V0.6-CPM_results_tables.xlsx",sheetname="Summary"){
  # Suppress warnings about column type guessing (some columns may have mixed types)
  # We only need gene_symbol and SCORE_ columns, so warnings about other columns are harmless
  scoredat <- suppressWarnings({
    read_xlsx(rubricfile, sheet = sheetname)
  }) %>% dplyr::select(gene_symbol, contains("SCORE_"))
  return(scoredat)
}

read_anchor_data<-function(rubricfile="/Users/zayed/Downloads/Scoring_Rubric_HNSC_HPV_Negative_Anchor_Partners_V0.5.1-CPM_results_tables.xlsx",sheetname="Summary",topN=30){
  # Suppress warnings about column type guessing (some columns may have mixed types)
  # We need gene_symbol, gene2_name, and SCORE_ columns
  scoredat <- suppressWarnings({
    read_xlsx(rubricfile, sheet = sheetname)
  }) %>% dplyr::select(gene_symbol, gene2_name, contains("SCORE_")) %>%
   group_by(gene_symbol) %>% slice_head(n=topN) 
    
  return(scoredat)
}




# Load anchor partner data and extract partner genes per anchor
load_anchor_partner_data <- function(partner_file, sheetname = "Summary", topn = 30) {
  cat("Loading anchor partner data from:", partner_file, "\n")
  
  if (!file.exists(partner_file)) {
    stop("Partner file not found: ", partner_file)
  }
  
  anchor_data <- read_anchor_data(partner_file, sheetname = sheetname, topN = topn)
  
  # Check required columns
  if (!"gene_symbol" %in% colnames(anchor_data)) {
    stop("Partner file must contain 'gene_symbol' column")
  }
  if (!"gene2_name" %in% colnames(anchor_data)) {
    stop("Partner file must contain 'gene2_name' column")
  }
  
  # Normalize gene symbols
  anchor_data$gene_symbol <- toupper(trimws(as.character(anchor_data$gene_symbol)))
  anchor_data$gene2_name <- toupper(trimws(as.character(anchor_data$gene2_name)))
  
  # Remove rows with missing values
  anchor_data <- anchor_data[!is.na(anchor_data$gene_symbol) & anchor_data$gene_symbol != "" &
                             !is.na(anchor_data$gene2_name) & anchor_data$gene2_name != "", ]
  
  # Get unique anchor genes
  anchor_genes <- unique(anchor_data$gene_symbol)
  cat("  Found", length(anchor_genes), "unique anchor genes\n")
  
  # Create list: anchor_gene -> list of partner genes
  anchor_partner_list <- list()
  for (anchor in anchor_genes) {
    partner_genes <- unique(anchor_data$gene2_name[anchor_data$gene_symbol == anchor])
    anchor_partner_list[[anchor]] <- list(
      anchor = anchor,
      partners = partner_genes,
      data = anchor_data[anchor_data$gene_symbol == anchor, ]
    )
    cat("  Anchor", anchor, ":", length(partner_genes), "partner genes\n")
  }
  
  return(anchor_partner_list)
}

# Load gene list from rubric file
load_gene_list_from_rubric <- function(rubric_file, sheetname = "Summary", topn = 35) {
  cat("Loading gene list from rubric file:", rubric_file, "\n")
  
  if (!file.exists(rubric_file)) {
    stop("Rubric file not found: ", rubric_file)
  }
  
  rubric_data <- read_rubric_data(rubric_file, sheetname = sheetname)
  
  # Extract gene symbols
  if (!"gene_symbol" %in% colnames(rubric_data)) {
    stop("Rubric file must contain 'gene_symbol' column")
  }
  
  # Normalize gene symbols
  rubric_data$gene_symbol <- toupper(trimws(as.character(rubric_data$gene_symbol)))
  rubric_data <- rubric_data[!is.na(rubric_data$gene_symbol) & rubric_data$gene_symbol != "", ]
  
  # Check if SCORE_total exists for sorting
  if ("SCORE_total" %in% colnames(rubric_data)) {
    cat("  Sorting by SCORE_total and selecting top", topn, "genes...\n")
    # Sort by SCORE_total descending, handling NA values
    rubric_data <- rubric_data %>%
      arrange(desc(SCORE_total)) %>%
      slice_head(n = topn)
    cat("  Selected top", nrow(rubric_data), "genes by SCORE_total\n")
  } else {
    # If no SCORE_total, just take first topn genes
    cat("  Warning: SCORE_total not found. Selecting first", topn, "genes...\n")
    rubric_data <- rubric_data %>%
      slice_head(n = topn)
  }
  
  gene_symbols <- rubric_data$gene_symbol
  gene_symbols <- unique(gene_symbols)
  
  cat("  Loaded", length(gene_symbols), "unique gene symbols from rubric\n")
  if (length(gene_symbols) == 0) {
    stop("No valid gene symbols found in rubric file")
  }
  
  return(list(genes = gene_symbols, rubric_data = rubric_data))
}

# Prepare rubric score matrix for heatmap
prepare_rubric_matrix <- function(rubric_data, gene_symbols, zscore = TRUE, total_score_col = "SCORE_total") {
  cat("\nPreparing rubric score matrix...\n")
  
  # Get score columns (all columns containing "SCORE_")
  score_cols <- colnames(rubric_data)[grepl("SCORE_", colnames(rubric_data), ignore.case = TRUE)]
  
  if (length(score_cols) == 0) {
    stop("No SCORE_ columns found in rubric data")
  }
  
  # Separate total score column from other scores
  # Also exclude other total columns (e.g., SCORE_total_Partner, SCORE_total_anchor)
  has_total <- total_score_col %in% score_cols
  
  # Identify all total columns (main total + any columns matching total_Partner, total_anchor, etc.)
  total_pattern <- grepl("^SCORE_total$|^SCORE_total_|^SCORE_SUM_", score_cols, ignore.case = TRUE)
  total_cols <- score_cols[total_pattern]
  other_score_cols <- score_cols[!total_pattern]
  
  if (length(total_cols) > 1) {
    cat("  Found", length(total_cols), "total columns:", paste(total_cols, collapse = ", "), "\n")
    cat("  Excluding", length(total_cols) - 1, "additional total columns from rubric scores heatmap\n")
  }
  
  # Normalize gene symbols
  rubric_data$gene_symbol <- toupper(trimws(as.character(rubric_data$gene_symbol)))
  gene_symbols_upper <- toupper(gene_symbols)
  
  # Filter to input genes
  rubric_filtered <- rubric_data %>%
    filter(gene_symbol %in% gene_symbols_upper)
  
  if (nrow(rubric_filtered) == 0) {
    stop("No matching genes found in rubric data")
  }
  
  # Prepare matrices for both total and other scores
  total_matrix <- NULL
  other_matrix <- NULL
  
  # Process total score column if it exists
  if (has_total) {
    total_matrix <- as.matrix(rubric_filtered[, total_score_col, drop = FALSE])
    rownames(total_matrix) <- rubric_filtered$gene_symbol
    
    # Create full matrix for total score
    total_matrix_full <- matrix(NA, 
                               nrow = length(gene_symbols_upper), 
                               ncol = 1,
                               dimnames = list(gene_symbols_upper, total_score_col))
    available_genes <- intersect(gene_symbols_upper, rownames(total_matrix))
    total_matrix_full[available_genes, ] <- total_matrix[available_genes, ]
    total_matrix <- total_matrix_full
    
    cat("  Prepared", total_score_col, "matrix:", nrow(total_matrix), "genes x 1 column\n")
  }
  
  # Process other scores
  if (length(other_score_cols) > 0) {
    other_matrix <- as.matrix(rubric_filtered[, other_score_cols, drop = FALSE])
    rownames(other_matrix) <- rubric_filtered$gene_symbol
    
    # Apply z-score normalization if requested
    # Exclude tumor expression columns from normalization (keep raw values for better visibility)
    if (zscore) {
      cat("  Applying z-score normalization to scores...\n")
      
      # Identify tumor expression columns (columns that don't match GTEx/HPA/DepMap patterns)
      col_names <- other_score_cols
      healthy_expr_pattern <- grepl("gtex|hpa|keytissues|key.tissues|key.tissue", col_names, ignore.case = TRUE)
      dependency_pattern <- grepl("depmap|dependency", col_names, ignore.case = TRUE) & !healthy_expr_pattern
      tumor_pattern <- !healthy_expr_pattern & !dependency_pattern
      
      # Apply z-score normalization column-wise (per score type)
      # Skip normalization for tumor expression columns to preserve their raw scale
      normalized_count <- 0
      tumor_count <- 0
      for (col in other_score_cols) {
        col_idx <- which(other_score_cols == col)
        is_tumor_col <- tumor_pattern[col_idx]
        
        if (!is_tumor_col) {
          # Normalize non-tumor columns (dependency, healthy expression)
          col_data <- other_matrix[, col]
          col_mean <- mean(col_data, na.rm = TRUE)
          col_sd <- sd(col_data, na.rm = TRUE)
          
          if (!is.na(col_sd) && col_sd > 0) {
            other_matrix[, col] <- (col_data - col_mean) / col_sd
            normalized_count <- normalized_count + 1
          } else {
            # If no variance, just center the data
            other_matrix[, col] <- col_data - col_mean
            normalized_count <- normalized_count + 1
          }
        } else {
          # Keep tumor expression columns as raw values (not normalized)
          tumor_count <- tumor_count + 1
        }
      }
      if (tumor_count > 0) {
        cat("  Normalized", normalized_count, "score columns; kept", tumor_count, 
            "tumor expression columns as raw values (not normalized)\n")
      } else {
        cat("  Normalized", normalized_count, "score columns\n")
      }
    } else {
      cat("  Skipping z-score normalization\n")
    }
    
    # Create full matrix for other scores
    other_matrix_full <- matrix(NA, 
                               nrow = length(gene_symbols_upper), 
                               ncol = length(other_score_cols),
                               dimnames = list(gene_symbols_upper, other_score_cols))
    available_genes <- intersect(gene_symbols_upper, rownames(other_matrix))
    other_matrix_full[available_genes, ] <- other_matrix[available_genes, ]
    other_matrix <- other_matrix_full
    
    cat("  Prepared other scores matrix:", nrow(other_matrix), "genes x", 
        ncol(other_matrix), "scores\n")
    cat("  Score columns:", paste(other_score_cols, collapse = ", "), "\n")
  }
  
  return(list(total = total_matrix, other = other_matrix))
}

# Create rubric heatmap (ComplexHeatmap)
create_rubric_heatmap <- function(rubric_matrix,
                                  show_row_names = FALSE,
                                  show_column_names = TRUE,
                                  column_names_size = 6,
                                  column_names_rot = 45,
                                  row_groups = NULL,
                                  box_genes = NULL,
                                  panel_title = NULL,
                                  heatmap_name = "Rubric Score",
                                  show_legend = TRUE) {
  cat("\nCreating rubric score heatmap...\n")
  
  # Remove "SCORE_" prefix from column names
  score_names <- colnames(rubric_matrix)
  display_names <- gsub("^SCORE_", "", score_names)
  colnames(rubric_matrix) <- display_names
  
  # Calculate dimensions for square cells
  n_rows <- nrow(rubric_matrix)
  n_cols <- ncol(rubric_matrix)
  
  # Set equal unit size for rows and columns to make cells square
  cell_size <- 0.5  # Size in cm per cell (same as other panels)
  
  # Prepare gene boxing if genes are specified (must match other heatmaps)
  box_genes_upper <- NULL
  if (!is.null(box_genes) && length(box_genes) > 0) {
    box_genes_upper <- toupper(box_genes)
    gene_names <- rownames(rubric_matrix)
    matched_genes <- gene_names[toupper(gene_names) %in% box_genes_upper]
    if (length(matched_genes) > 0) {
      cat("  Boxing", length(matched_genes), "genes in rubric panel\n")
    }
  }
  
  # Prepare row splitting if groups are provided (must match other heatmaps)
  row_split <- NULL
  
  if (!is.null(row_groups)) {
    # Match genes in matrix to groups (all genes, including those without groups)
    gene_names <- rownames(rubric_matrix)
    matched_groups <- row_groups[gene_names]
    
    # Create row split vector for ALL genes (must match matrix row order and other heatmaps)
    # Convert to character, preserving NA values
    # Genes without groups will have NA and won't be split
    if (sum(!is.na(matched_groups)) > 0) {
      row_split <- matched_groups
      # Convert to character vector, preserving NA values
      row_split <- ifelse(is.na(row_split), NA_character_, as.character(row_split))
      names(row_split) <- NULL
      cat("  Using same row splitting as other heatmaps\n")
    }
  }
  
  # Prepare column splitting: separate columns into Healthy Expression, Dependency, and Tumor Expression
  column_split <- NULL
  col_names <- colnames(rubric_matrix)
  
  # Check for columns matching different patterns (case-insensitive)
  # Healthy Expression: GTEx, HPA, KeyTissues patterns
  healthy_expr_pattern <- grepl("gtex|hpa|keytissues|key.tissues|key.tissue", col_names, ignore.case = TRUE)
  
  # Dependency: DepMap, dependency patterns (excluding those already matched as Healthy Expression)
  dependency_pattern <- grepl("depmap|dependency", col_names, ignore.case = TRUE) & !healthy_expr_pattern
  
  # Create column split vector with three groups
  if (sum(healthy_expr_pattern) > 0 || sum(dependency_pattern) > 0) {
    # Determine which columns don't match any pattern (these are Tumor Expression)
    tumor_pattern <- !healthy_expr_pattern & !dependency_pattern
    
    # Create column_split: only assign groups for columns that match patterns
    # Columns that don't match are Tumor Expression
    column_split <- rep(NA_character_, length(col_names))
    column_split[healthy_expr_pattern] <- "Healthy Expression"
    column_split[dependency_pattern] <- "Dependency"
    column_split[tumor_pattern] <- "Tumor Expression"
    names(column_split) <- NULL
    
    # Get column indices for each group
    tumor_indices <- which(column_split == "Tumor Expression")
    dependency_indices <- which(column_split == "Dependency")
    healthy_indices <- which(column_split == "Healthy Expression")
    
    # Create new column order: Dependency first, then Healthy Expression (if no Tumor Expression)
    # Otherwise: Tumor Expression, Dependency, Healthy Expression
    if (length(tumor_indices) == 0) {
      # No Tumor Expression columns: order as Dependency, Healthy Expression
      new_order <- c(dependency_indices, healthy_indices)
    } else {
      # Has Tumor Expression columns: order as Tumor Expression, Dependency, Healthy Expression
      new_order <- c(tumor_indices, dependency_indices, healthy_indices)
    }
    
    # Reorder matrix and column_split
    rubric_matrix <- rubric_matrix[, new_order, drop = FALSE]
    column_split <- column_split[new_order]
    
    # Only create column_split if we have at least 2 groups (otherwise no need to split)
    unique_groups <- unique(column_split[!is.na(column_split)])
    if (length(unique_groups) < 2) {
      column_split <- NULL
      cat("  Single group detected, no column splitting\n")
    } else {
      cat("  Splitting columns:", sum(column_split == "Tumor Expression", na.rm = TRUE), "Tumor Expression,",
          sum(column_split == "Dependency", na.rm = TRUE), "Dependency,",
          sum(column_split == "Healthy Expression", na.rm = TRUE), "Healthy Expression (GTEx/HPA/KeyTissues)\n")
    }
  }
  
  # Determine color scale based on score range
  score_range <- range(rubric_matrix, na.rm = TRUE)
  cat("  Score range:", round(score_range[1], 2), "to", round(score_range[2], 2), "\n")
  
  # Create base color scale for most columns (avoid white for visibility on white background)
  if (score_range[1] < 0 && score_range[2] > 0) {
    # Bipolar scale: blue (negative) -> light gray (zero) -> red (positive)
    base_colors <- colorRamp2(
      breaks = c(score_range[1], 0, score_range[2]),
      colors = c("#2166AC", "#E0E0E0", "#B2182B")  # Blue -> Light Gray -> Red
    )
    # Inverted scale for Healthy Expression: red (negative) -> light gray (zero) -> blue (positive)
    inverted_colors <- colorRamp2(
      breaks = c(score_range[1], 0, score_range[2]),
      colors = c("#B2182B", "#E0E0E0", "#2166AC")  # Red -> Light Gray -> Blue (inverted)
    )
  } else if (score_range[1] >= 0) {
    # Unipolar scale: light blue (low) -> red (high)
    base_colors <- colorRamp2(
      breaks = c(score_range[1], score_range[2]),
      colors = c("#D1E5F0", "#B2182B")  # Light Blue -> Red
    )
    # Inverted scale for Healthy Expression: red (low) -> light blue (high)
    inverted_colors <- colorRamp2(
      breaks = c(score_range[1], score_range[2]),
      colors = c("#B2182B", "#D1E5F0")  # Red -> Light Blue (inverted)
    )
  } else {
    # All negative: blue (low) -> light blue (high)
    base_colors <- colorRamp2(
      breaks = c(score_range[1], score_range[2]),
      colors = c("#2166AC", "#D1E5F0")  # Blue -> Light Blue
    )
    # Inverted scale for Healthy Expression: light blue (low) -> blue (high)
    inverted_colors <- colorRamp2(
      breaks = c(score_range[1], score_range[2]),
      colors = c("#D1E5F0", "#2166AC")  # Light Blue -> Blue (inverted)
    )
  }
  
  # Use base colors as the main color mapping
  # cell_fun will override colors for Healthy Expression columns
  score_colors <- base_colors
  
  ht_rubric <- Heatmap(
    rubric_matrix,
    name = heatmap_name,
    col = score_colors,
    cluster_rows = FALSE,
    cluster_columns = FALSE,
    show_row_names = show_row_names,  # No row names in rubric panel
    show_column_names = show_column_names,
    column_names_gp = gpar(fontsize = column_names_size),
    column_names_rot = column_names_rot,  # Rotate column names (45 degrees)
    # Note: rect_gp removed because cell_fun handles all cell drawing
    # Set equal unit sizes for rows and columns to make cells square
    width = n_cols * unit(cell_size, "cm"),
    height = n_rows * unit(cell_size, "cm"),
    # Row splitting by groups (must match other heatmaps for alignment)
    row_split = row_split,
    # Hide row split titles (group names on the far left)
    row_title = NULL,  # Remove group name labels
    # Column splitting: separate into Tumor Expression, Dependency, and Healthy Expression
    column_split = column_split,
    # Panel title: when column_split exists, explicitly provide group names as column titles
    # ComplexHeatmap will use these for each group in the split
    column_title = if (!is.null(column_split)) {
      # Get unique group names in order of appearance (preserves: Tumor Expression, Dependency, Healthy Expression)
      unique(column_split[!is.na(column_split)])
    } else {
      panel_title
    },
    # Font settings for column titles (applies to both split group titles and single panel title)
    column_title_gp = gpar(fontsize = if (!is.null(column_split)) 11 else 12, fontface = "bold"),
    # Rotation: 45 degrees for all column titles (both split group titles and single panel title)
    column_title_rot = 45,
    # Control legend visibility
    show_heatmap_legend = show_legend,
    heatmap_legend_param = list(
      title = heatmap_name,
      title_position = "topcenter",
      direction = "horizontal",  # Arrange horizontally when at bottom
      nrow = 1  # Single row for horizontal layout
    ),
    # Draw cells with inverted colors for Healthy Expression columns and black borders for boxed genes
    cell_fun = function(j, i, x, y, width, height, fill) {
      # Override color for Healthy Expression columns (invert the color scale)
      if (!is.null(column_split) && j <= length(column_split) && column_split[j] == "Healthy Expression") {
        # Get the actual value from the matrix
        cell_value <- rubric_matrix[i, j]
        # Use inverted color mapping
        fill <- inverted_colors(cell_value)
      }
      
      # Draw the cell with the (possibly overridden) fill color
      grid.rect(x, y, width, height, gp = gpar(fill = fill, col = "white", lwd = 0.5))
      
      # Draw black border around boxed genes (rows)
      if (!is.null(box_genes_upper)) {
        gene_name <- rownames(rubric_matrix)[i]
        if (toupper(gene_name) %in% box_genes_upper) {
          # Draw thick black border around the entire row
          grid.rect(x, y, width, height, 
                   gp = gpar(fill = NA, col = "black", lwd = 2))
        }
      }
    }
  )
  
  return(ht_rubric)
}

# Create rubric total score heatmap (separate heatmap for SCORE_total)
create_rubric_total_heatmap <- function(total_matrix,
                                       show_row_names = FALSE,
                                       show_column_names = TRUE,
                                       column_names_size = 6,
                                       column_names_rot = 45,
                                       row_groups = NULL,
                                       box_genes = NULL) {
  cat("\nCreating rubric total score heatmap...\n")
  
  # Remove "SCORE_" prefix from column name
  score_names <- colnames(total_matrix)
  display_names <- gsub("^SCORE_", "", score_names)
  colnames(total_matrix) <- display_names
  
  # Calculate dimensions for square cells
  n_rows <- nrow(total_matrix)
  n_cols <- ncol(total_matrix)
  
  # Set equal unit size for rows and columns to make cells square
  cell_size <- 0.5  # Size in cm per cell (same as other panels)
  
  # Prepare gene boxing if genes are specified (must match other heatmaps)
  box_genes_upper <- NULL
  if (!is.null(box_genes) && length(box_genes) > 0) {
    box_genes_upper <- toupper(box_genes)
    gene_names <- rownames(total_matrix)
    matched_genes <- gene_names[toupper(gene_names) %in% box_genes_upper]
    if (length(matched_genes) > 0) {
      cat("  Boxing", length(matched_genes), "genes in total score panel\n")
    }
  }
  
  # Prepare row splitting if groups are provided (must match other heatmaps)
  row_split <- NULL
  
  if (!is.null(row_groups)) {
    # Match genes in matrix to groups (all genes, including those without groups)
    gene_names <- rownames(total_matrix)
    matched_groups <- row_groups[gene_names]
    
    # Create row split vector for ALL genes (must match matrix row order and other heatmaps)
    # Convert to character, preserving NA values
    # Genes without groups will have NA and won't be split
    if (sum(!is.na(matched_groups)) > 0) {
      row_split <- matched_groups
      # Convert to character vector, preserving NA values
      row_split <- ifelse(is.na(row_split), NA_character_, as.character(row_split))
      names(row_split) <- NULL
      cat("  Using same row splitting as other heatmaps\n")
    }
  }
  
  # Determine color scale based on score range (for total score, typically unipolar)
  score_range <- range(total_matrix, na.rm = TRUE)
  cat("  Total score range:", round(score_range[1], 2), "to", round(score_range[2], 2), "\n")
  
  # Use a color scale appropriate for total scores (avoid white for visibility on white background)
  if (score_range[1] < 0 && score_range[2] > 0) {
    # Bipolar scale: blue (negative) -> light gray (zero) -> red (positive)
    score_colors <- colorRamp2(
      breaks = c(score_range[1], 0, score_range[2]),
      colors = c("#2166AC", "#E0E0E0", "#B2182B")  # Blue -> Light Gray -> Red
    )
  } else if (score_range[1] >= 0) {
    # Unipolar scale: light blue (low) -> red (high)
    score_colors <- colorRamp2(
      breaks = c(score_range[1], score_range[2]),
      colors = c("#D1E5F0", "#B2182B")  # Light Blue -> Red
    )
  } else {
    # All negative: blue (low) -> light blue (high)
    score_colors <- colorRamp2(
      breaks = c(score_range[1], score_range[2]),
      colors = c("#2166AC", "#D1E5F0")  # Blue -> Light Blue
    )
  }
  
  ht_total <- Heatmap(
    total_matrix,
    name = NULL,  # No name/legend for Total Score
    col = score_colors,
    cluster_rows = FALSE,
    cluster_columns = FALSE,
    show_row_names = show_row_names,  # No row names in total score panel
    show_column_names = show_column_names,
    column_names_gp = gpar(fontsize = column_names_size),
    column_names_rot = column_names_rot,  # Rotate column names (45 degrees)
    rect_gp = gpar(col = "white", lwd = 0.5),
    # Set equal unit sizes for rows and columns to make cells square
    width = n_cols * unit(cell_size, "cm"),
    height = n_rows * unit(cell_size, "cm"),
    # Row splitting by groups (must match other heatmaps for alignment)
    row_split = row_split,
    # Hide row split titles (group names on the far left)
    row_title = NULL,  # Remove group name labels
    # Explicitly hide legend for Total Score
    show_heatmap_legend = FALSE,
    # Draw black borders around boxed genes (rows)
    cell_fun = function(j, i, x, y, width, height, fill) {
      # Draw black border around boxed genes (rows)
      if (!is.null(box_genes_upper)) {
        gene_name <- rownames(total_matrix)[i]
        if (toupper(gene_name) %in% box_genes_upper) {
          # Draw thick black border around the entire row
          grid.rect(x, y, width, height, 
                   gp = gpar(fill = NA, col = "black", lwd = 2))
        }
      }
    }
  )
  
  return(ht_total)
}


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

# Load gene synonyms from file
load_gene_synonyms <- function(file_path) {
  cat("\nLoading gene synonyms from:", file_path, "\n")
  
  if (!file.exists(file_path)) {
    cat("  Warning: Synonyms file not found. Proceeding without synonym support.\n")
    return(NULL)
  }
  
  # Try reading as TSV first, then CSV, then space-separated
  synonym_data <- tryCatch({
    read_tsv(file_path, show_col_types = FALSE, col_names = FALSE)
  }, error = function(e) {
    tryCatch({
      read_csv(file_path, show_col_types = FALSE, col_names = FALSE)
    }, error = function(e2) {
      read.table(file_path, sep = "\t", stringsAsFactors = FALSE, header = FALSE)
    })
  })
  
  # Create synonym mapping: primary_gene -> list of synonyms
  synonym_map <- list()
  
  for (i in 1:nrow(synonym_data)) {
    row <- as.character(synonym_data[i, ])
    row <- row[!is.na(row) & row != ""]
    
    if (length(row) < 2) next
    
    # First column is primary gene, rest are synonyms
    primary_gene <- toupper(trimws(row[1]))
    synonyms <- toupper(trimws(row[-1]))
    
    # Store synonyms for this primary gene
    synonym_map[[primary_gene]] <- synonyms
  }
  
  cat("  Loaded synonyms for", length(synonym_map), "primary genes\n")
  
  return(synonym_map)
}

# Get synonyms for a gene symbol
get_gene_synonyms <- function(gene_symbol, synonym_map) {
  if (is.null(synonym_map)) return(NULL)
  
  gene_upper <- toupper(gene_symbol)
  
  # Check if gene has synonyms
  if (gene_upper %in% names(synonym_map)) {
    syns <- synonym_map[[gene_upper]]
    # Filter out the gene itself
    syns <- syns[syns != gene_upper]
    if (length(syns) > 0) {
      return(syns)
    }
  }
  
  return(NULL)
}

# Load TCGA log2FC data from local RDS file
load_tcga_rds_data <- function(tcga_data_list, gene_symbol, cohorts = TCGA_COHORTS) {
  # tcga_data_list should already be loaded from readRDS()
  # Check if it's a list
  if (!is.list(tcga_data_list)) {
    stop("TCGA RDS file must contain a list with cohort names as keys")
  }
  
  # Normalize gene symbol to uppercase
  gene_upper <- toupper(gene_symbol)
  
  # Collect data from all requested cohorts
  all_cohort_data <- list()
  
  for (cohort in cohorts) {
    # Check if cohort exists in the list
    if (!cohort %in% names(tcga_data_list)) {
      next  # Skip if cohort not available
    }
    
    cohort_df <- tcga_data_list[[cohort]]
    
    # Check if it's a data frame with required columns
    if (!is.data.frame(cohort_df)) {
      warning(sprintf("Cohort %s in RDS file is not a data frame", cohort))
      next
    }
    
    # Find gene column (flexible naming)
    possible_gene_cols <- c("gene", "Gene", "GENE", "gene_symbol", "Gene_Symbol", 
                           "GENE_SYMBOL", "hgnc_symbol", "HGNC", "Symbol", "symbol")
    gene_col <- NULL
    for (col in possible_gene_cols) {
      if (col %in% colnames(cohort_df)) {
        gene_col <- col
        break
      }
    }
    
    if (is.null(gene_col)) {
      warning(sprintf("Could not find gene column in cohort %s", cohort))
      next
    }
    
    # Find log_fc column (flexible naming)
    possible_logfc_cols <- c("log_fc", "log2fc", "log2_fc", "logFC", 
                            "log2FC", "Log2FC", "fold_change", "foldChange")
    logfc_col <- NULL
    for (col in possible_logfc_cols) {
      if (col %in% colnames(cohort_df)) {
        logfc_col <- col
        break
      }
    }
    
    if (is.null(logfc_col)) {
      warning(sprintf("Could not find log_fc column in cohort %s", cohort))
      next
    }
    
    # Filter for the gene (case-insensitive)
    cohort_df[[gene_col]] <- toupper(trimws(as.character(cohort_df[[gene_col]])))
    gene_row <- cohort_df[cohort_df[[gene_col]] == gene_upper, ]
    
    if (nrow(gene_row) > 0) {
      log2fc_val <- gene_row[[logfc_col]][1]  # Take first match if multiple
      if (!is.na(log2fc_val)) {
        all_cohort_data[[cohort]] <- data.frame(
          cohort = cohort,
          log2fc = as.numeric(log2fc_val),
          stringsAsFactors = FALSE
        )
      }
    }
  }
  
  # Combine all cohort data
  if (length(all_cohort_data) > 0) {
    result <- bind_rows(all_cohort_data) %>%
      mutate(
        gene = gene_symbol,
        log2fc_bin = categorize_log2fc(log2fc)
      )
    return(result)
  } else {
    return(NULL)
  }
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
                                  delay = 0.5, use_cache = TRUE, cache_dir = CACHE_DIR,
                                  synonym_map = NULL, tcga_rds_data = NULL) {
  original_gene <- gene_symbol  # Keep original for display
  
  # If RDS data is provided, use it as the data source
  if (!is.null(tcga_rds_data)) {
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
    
    # Load from RDS data
    rds_data <- load_tcga_rds_data(tcga_rds_data, gene_symbol, cohorts)
    
    if (!is.null(rds_data) && nrow(rds_data) > 0) {
      # Save to cache if enabled
      if (use_cache && nrow(rds_data) > 0) {
        save_combined_to_cache(rds_data, gene_symbol, cache_dir)
      }
      return(rds_data)
    }
    
    # If RDS data didn't have data, try synonyms if available
    if (!is.null(synonym_map)) {
      synonyms <- get_gene_synonyms(gene_symbol, synonym_map)
      if (!is.null(synonyms) && length(synonyms) > 0) {
        cat("  No data for", gene_symbol, "in RDS - trying synonyms:", 
            paste(synonyms, collapse = ", "), "\n")
        
        # Try each synonym until we find data
        for (syn in synonyms) {
          syn_rds_data <- load_tcga_rds_data(tcga_rds_data, syn, cohorts)
          if (!is.null(syn_rds_data) && nrow(syn_rds_data) > 0) {
            cat("  Found data using synonym:", syn, "\n")
            # Update gene symbol to original for display
            syn_rds_data$gene <- original_gene
            if (use_cache) {
              save_combined_to_cache(syn_rds_data, gene_symbol, cache_dir)
            }
            return(syn_rds_data)
          }
        }
      }
    }
    
    # If no data found in RDS (even with synonyms), return NULL
    return(NULL)
  }
  
  # Fall back to API-based quartiles method
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
    # Try synonyms if primary gene failed
    if (!is.null(synonym_map)) {
      synonyms <- get_gene_synonyms(gene_symbol, synonym_map)
      if (!is.null(synonyms) && length(synonyms) > 0) {
        cat("  No data for", gene_symbol, "- trying synonyms:", 
            paste(synonyms, collapse = ", "), "\n")
        
        # Try each synonym until we find data
        for (syn in synonyms) {
          syn_tumor <- fetch_tcga_quartiles(syn, "tumors", cohorts, 
                                           delay = delay, use_cache = use_cache, 
                                           cache_dir = cache_dir)
          syn_normal <- fetch_tcga_quartiles(syn, "normals", cohorts, 
                                            delay = delay, use_cache = use_cache, 
                                            cache_dir = cache_dir)
          
          # If we found data with this synonym, use it
          if ((!is.null(syn_tumor) && nrow(syn_tumor) > 0) || 
              (!is.null(syn_normal) && nrow(syn_normal) > 0)) {
            cat("  Found data using synonym:", syn, "\n")
            tumor_data <- syn_tumor
            normal_data <- syn_normal
            # Keep original gene symbol for display, but use synonym for data
            gene_symbol <- original_gene
            break
          }
        }
      }
    }
    
    # Check again after trying synonyms
    if ((is.null(tumor_data) || nrow(tumor_data) == 0) && 
        (is.null(normal_data) || nrow(normal_data) == 0)) {
      if (gene_symbol == "CDH1" || gene_symbol == "cdh1") {
        cat("  DEBUG CDH1: Both tumor and normal data are NULL/empty after synonyms\n")
      }
      return(NULL)
    }
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
                               use_cache = TRUE, cache_dir = CACHE_DIR,
                               synonym_map = NULL, tcga_rds_file = NULL) {
  cat("\nProcessing TCGA data for", length(gene_symbols), "genes...\n")
  
  # Load RDS file once if provided
  tcga_rds_data <- NULL
  if (!is.null(tcga_rds_file) && file.exists(tcga_rds_file)) {
    cat("  Loading TCGA RDS file:", tcga_rds_file, "\n")
    tcga_rds_data <- readRDS(tcga_rds_file)
    if (!is.list(tcga_rds_data)) {
      stop("TCGA RDS file must contain a list with cohort names as keys")
    }
    cat("  Loaded", length(tcga_rds_data), "cohorts from RDS file\n")
  } else if (!is.null(tcga_rds_file)) {
    cat("  Warning: TCGA RDS file not found:", tcga_rds_file, "\n")
    cat("  Falling back to TCGA API (quartiles method)\n")
  } else {
    cat("  Using TCGA API (quartiles method)\n")
  }
  
  init_cache_dir(cache_dir)
  
  all_data <- list()
  for (i in seq_along(gene_symbols)) {
    gene <- gene_symbols[i]
    if (show_progress) {
      cat(sprintf("[%d/%d] %s", i, length(gene_symbols), gene))
    }
    
    gene_data <- fetch_tcga_gene_data(gene, cohorts, delay = delay, 
                                      use_cache = use_cache, cache_dir = cache_dir,
                                      synonym_map = synonym_map, tcga_rds_data = tcga_rds_data)
    
    if (!is.null(gene_data)) {
      all_data[[i]] <- gene_data
      if (show_progress) cat(" ✓\n")
    } else {
      if (show_progress) cat(" ✗\n")
    }
    
    # Only sleep if using API (not needed for RDS file)
    if (is.null(tcga_rds_data) && i < length(gene_symbols)) {
      Sys.sleep(delay)
    }
  }
  
  combined_data <- bind_rows(all_data)
  cat("\n  Processed", length(unique(combined_data$gene)), "genes\n")
  return(combined_data)
}

# Load GTEx median expression data
load_gtex_medians <- function(file_path, gene_symbols, collapse_tissues = FALSE) {
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
  
  # Collapse tissues by top-level name if requested
  if (collapse_tissues) {
    cat("  Collapsing tissues by top-level name...\n")
    tissue_names <- colnames(gtex_matrix_raw)
    
    # Extract top-level tissue names (before " - " separator)
    # Handle various formats: "Brain - Cerebellum" -> "Brain", "Adipose_Subcutaneous" -> "Adipose"
    top_level_tissues <- sapply(tissue_names, function(tissue) {
      # Split on " - " first (most common GTEx format)
      if (grepl(" - ", tissue)) {
        return(strsplit(tissue, " - ")[[1]][1])
      }
      # If no " - ", try splitting on underscore and take first part
      if (grepl("_", tissue)) {
        parts <- strsplit(tissue, "_")[[1]]
        # If first part is a common top-level (like "Adipose", "Brain", etc.), use it
        # Otherwise, might be a single-word tissue name
        return(parts[1])
      }
      # Single word tissue name
      return(tissue)
    })
    
    # Group columns by top-level tissue and average
    unique_top_levels <- unique(top_level_tissues)
    cat("  Found", length(unique_top_levels), "top-level tissues from", 
        length(tissue_names), "original tissues\n")
    
    # Create collapsed matrix
    collapsed_matrix <- matrix(NA, 
                              nrow = nrow(gtex_matrix_raw),
                              ncol = length(unique_top_levels),
                              dimnames = list(rownames(gtex_matrix_raw), unique_top_levels))
    
    for (top_level in unique_top_levels) {
      # Find all columns belonging to this top-level tissue
      matching_cols <- which(top_level_tissues == top_level)
      
      if (length(matching_cols) == 1) {
        # Single column, just copy it
        collapsed_matrix[, top_level] <- gtex_matrix_raw[, matching_cols]
      } else {
        # Multiple columns, average them (row-wise mean, ignoring NA)
        collapsed_matrix[, top_level] <- rowMeans(gtex_matrix_raw[, matching_cols, drop = FALSE], 
                                                   na.rm = TRUE)
        # If all values were NA, set to NA
        all_na <- rowSums(!is.na(gtex_matrix_raw[, matching_cols, drop = FALSE])) == 0
        collapsed_matrix[all_na, top_level] <- NA
      }
    }
    
    gtex_matrix_raw <- collapsed_matrix
    cat("  Collapsed to", ncol(gtex_matrix_raw), "top-level tissues\n")
  }
  
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
process_gtex_data <- function(gtex_medians_file, gene_symbols, collapse_tissues = FALSE) {
  gtex_raw <- load_gtex_medians(gtex_medians_file, gene_symbols, collapse_tissues = collapse_tissues)
  
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
                                highlight_cohorts = NULL,
                                box_genes = NULL) {
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
  
  # Prepare gene boxing if genes are specified
  box_genes_upper <- NULL
  if (!is.null(box_genes) && length(box_genes) > 0) {
    box_genes_upper <- toupper(box_genes)
    gene_names <- rownames(tcga_matrix)
    matched_genes <- gene_names[toupper(gene_names) %in% box_genes_upper]
    if (length(matched_genes) > 0) {
      cat("  Boxing", length(matched_genes), "genes:", 
          paste(matched_genes, collapse = ", "), "\n")
    } else {
      cat("  Warning: No matching genes found for boxing\n")
      box_genes_upper <- NULL
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
    # Panel title
    column_title = "Pan Cancer",
    column_title_gp = gpar(fontsize = 12, fontface = "bold"),
    column_title_rot = 0,  # Horizontal title
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
      
      # Draw black border around boxed genes (rows)
      if (!is.null(box_genes_upper)) {
        gene_name <- rownames(tcga_matrix)[i]
        if (toupper(gene_name) %in% box_genes_upper) {
          # Draw thick black border around the entire row
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
                               highlight_tissues = NULL,
                               box_genes = NULL) {
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
  
  # Prepare gene boxing if genes are specified (must match TCGA heatmap)
  box_genes_upper <- NULL
  if (!is.null(box_genes) && length(box_genes) > 0) {
    box_genes_upper <- toupper(box_genes)
    gene_names <- rownames(gtex_matrix)
    matched_genes <- gene_names[toupper(gene_names) %in% box_genes_upper]
    if (length(matched_genes) > 0) {
      cat("  Boxing", length(matched_genes), "genes in GTEx panel\n")
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
    # Panel title
    column_title = "Healthy Expression (GTEx)",
    column_title_gp = gpar(fontsize = 12, fontface = "bold"),
    column_title_rot = 0,  # Horizontal title
    heatmap_legend_param = list(
      title = "Expression Level",
      at = names(color_map),
      labels = names(color_map),
      title_position = "topcenter",
      direction = "horizontal",  # Arrange horizontally when at bottom
      nrow = 1  # Single row for horizontal layout
    ),
    # Draw black borders around highlighted columns and boxed genes
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
      
      # Draw black border around boxed genes (rows)
      if (!is.null(box_genes_upper)) {
        gene_name <- rownames(gtex_matrix)[i]
        if (toupper(gene_name) %in% box_genes_upper) {
          # Draw thick black border around the entire row
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
                             width = 20, height = 12,
                             rubric_total_heatmap = NULL,
                             rubric_tumor_heatmap = NULL,
                             rubric_heatmap = NULL,
                             chart_title = NULL,
                             append_to_pdf = FALSE) {
  cat("\nCombining panels and saving to:", output_file, "\n")
  
  # If append_to_pdf is TRUE, assume PDF is already open; otherwise open a new one
  if (!append_to_pdf) {
    pdf(output_file, width = width, height = height)
    close_device <- TRUE
  } else {
    close_device <- FALSE
  }
  
  # Adjust padding to account for title if provided
  if (!is.null(chart_title) && chart_title != "") {
    top_padding <- 4  # 2cm base + 2cm for title
  } else {
    top_padding <- 2
  }
  
  # Draw heatmaps side by side with legends below
  # Order: Total, Tumor Expression, Other scores (Dependency + Healthy), TCGA, GTEx
  if (!is.null(rubric_total_heatmap) && !is.null(rubric_tumor_heatmap) && !is.null(rubric_heatmap)) {
    # Five panels: total, tumor, other scores, TCGA, GTEx
    draw(
      rubric_total_heatmap + rubric_tumor_heatmap + rubric_heatmap + tcga_heatmap + gtex_heatmap,
      # Position legends below the heatmaps
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      # Increase top padding for title, bottom padding for legends
      padding = unit(c(top_padding, 1, 6, 2), "cm")  # top, right, bottom, left
    )
  } else if (!is.null(rubric_total_heatmap) && !is.null(rubric_heatmap)) {
    # Four panels: total, other scores, TCGA, GTEx (no tumor split)
    draw(
      rubric_total_heatmap + rubric_heatmap + tcga_heatmap + gtex_heatmap,
      # Position legends below the heatmaps
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      # Increase top padding for title, bottom padding for legends
      padding = unit(c(top_padding, 1, 6, 2), "cm")  # top, right, bottom, left
    )
  } else if (!is.null(rubric_heatmap)) {
    # Three panels: rubric (left), TCGA (middle), GTEx (right)
    draw(
      rubric_heatmap + tcga_heatmap + gtex_heatmap,
      # Position legends below the heatmaps
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      # Increase top padding for title, bottom padding for legends
      padding = unit(c(top_padding, 1, 6, 2), "cm")  # top, right, bottom, left
    )
  } else {
    # Two panels: TCGA (left), GTEx (right)
    draw(
      tcga_heatmap + gtex_heatmap,
      # Position legends below the heatmaps
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      # Increase top padding for title, bottom padding for legends
      padding = unit(c(top_padding, 1, 6, 2), "cm")  # top, right, bottom, left
    )
  }
  
  # Add title on top of the heatmap (on the same page)
  if (!is.null(chart_title) && chart_title != "") {
    # Go back to root viewport to position title at the top of the page
    upViewport(0)
    # Add title at the top center of the page
    grid.text(chart_title, 
             x = unit(0.5, "npc"),
             y = unit(1, "npc") - unit(0.5, "cm"),
             gp = gpar(fontsize = 16, fontface = "bold"),
             just = c("center", "top"))
  }
  
  # Only close device if we opened it
  if (close_device) {
    dev.off()
    cat("  Saved successfully!\n")
  } else {
    cat("  Page added to PDF\n")
  }
}

# ============================================================================
# Partner Mode Function (loops over anchor genes)
# ============================================================================

generate_partner_mode_heatmaps <- function(
  partner_file,
  gtex_tsv_file = "gtex_data_in.medians.tsv",
  output_file = "tcga_gtex_heatmap.pdf",
  tcga_cohorts = TCGA_COHORTS,
  delay = 0.5,
  use_cache = TRUE,
  width = 20,
  height = 12,
  show_progress = TRUE,
  gene_annotation_file = NULL,
  highlight_cohorts = NULL,
  highlight_tissues = NULL,
  synonyms_file = NULL,
  tcga_rds_file = "tcga_log2data.RDS",
  box_genes = NULL,
  collapse_gtex_tissues = TRUE,
  topn = 30,
  rubric_zscore = FALSE,
  chart_title = NULL
) {
  cat("=", rep("=", 70), "\n", sep = "")
  cat("TCGA-GTEx-Rubric Heatmap Generation (PARTNER MODE)\n")
  cat("=", rep("=", 70), "\n", sep = "")
  
  # Load anchor partner data
  anchor_partner_list <- load_anchor_partner_data(partner_file, topn = topn)
  
  if (length(anchor_partner_list) == 0) {
    stop("No anchor genes found in partner file")
  }
  
  # Open PDF file once for all anchor genes
  cat("\nOpening PDF file:", output_file, "\n")
  pdf(output_file, width = width, height = height)
  
  # Process each anchor gene
  all_results <- list()
  for (i in seq_along(anchor_partner_list)) {
    anchor_info <- anchor_partner_list[[i]]
    anchor_gene <- anchor_info$anchor
    partner_genes <- anchor_info$partners
    anchor_rubric_data <- anchor_info$data
    
    cat("\n", rep("-", 70), "\n", sep = "")
    cat("Processing anchor gene", i, "of", length(anchor_partner_list), ":", anchor_gene, "\n")
    cat("  Partner genes:", length(partner_genes), "\n")
    cat(rep("-", 70), "\n", sep = "")
    
    if (length(partner_genes) == 0) {
      cat("  Warning: No partner genes found for anchor", anchor_gene, "- skipping\n")
      next
    }
    
    # Create chart title for this anchor
    anchor_chart_title <- if (!is.null(chart_title)) {
      paste0(chart_title, " - Anchor: ", anchor_gene)
    } else {
      paste0("Anchor: ", anchor_gene, " (", length(partner_genes), " partners)")
    }
    
    # Generate heatmap for this anchor using partner genes
    # Pass append_to_pdf = TRUE to add to the already-open PDF
    tryCatch({
      result <- generate_heatmap_with_gene_list(
        gene_symbols = partner_genes,
        rubric_data = anchor_rubric_data,
        gtex_tsv_file = gtex_tsv_file,
        output_file = output_file,  # Same output file for all anchors
        tcga_cohorts = tcga_cohorts,
        delay = delay,
        use_cache = use_cache,
        width = width,
        height = height,
        show_progress = show_progress,
        gene_annotation_file = gene_annotation_file,
        highlight_cohorts = highlight_cohorts,
        highlight_tissues = highlight_tissues,
        synonyms_file = synonyms_file,
        tcga_rds_file = tcga_rds_file,
        box_genes = box_genes,
        collapse_gtex_tissues = collapse_gtex_tissues,
        rubric_zscore = rubric_zscore,
        chart_title = anchor_chart_title,
        append_to_pdf = TRUE  # Add to already-open PDF
      )
      all_results[[anchor_gene]] <- result
      cat("  Successfully added heatmap page for anchor:", anchor_gene, "\n")
    }, error = function(e) {
      cat("  Error processing anchor", anchor_gene, ":", conditionMessage(e), "\n")
    })
  }
  
  # Close PDF file
  dev.off()
  cat("\nClosed PDF file:", output_file, "\n")
  
  cat("\n", rep("=", 70), "\n", sep = "")
  cat("Partner mode complete! Generated", length(all_results), "heatmap pages in", output_file, "\n")
  cat(rep("=", 70), "\n", sep = "")
  
  return(all_results)
}

# Helper function to generate heatmap with direct gene list and rubric data
generate_heatmap_with_gene_list <- function(
  gene_symbols,
  rubric_data = NULL,
  gtex_tsv_file = "gtex_data_in.medians.tsv",
  output_file = "tcga_gtex_heatmap.pdf",
  tcga_cohorts = TCGA_COHORTS,
  delay = 0.5,
  use_cache = TRUE,
  width = 20,
  height = 12,
  show_progress = TRUE,
  gene_annotation_file = NULL,
  highlight_cohorts = NULL,
  highlight_tissues = NULL,
  synonyms_file = NULL,
  tcga_rds_file = "tcga_log2data.RDS",
  box_genes = NULL,
  collapse_gtex_tissues = TRUE,
  rubric_zscore = FALSE,
  chart_title = NULL,
  append_to_pdf = FALSE
) {
  # This is essentially the core logic from generate_tcga_gtex_heatmap
  # but accepts gene_symbols directly instead of loading from file
  
  # 1. Load gene synonyms if provided
  synonym_map <- NULL
  if (!is.null(synonyms_file) && synonyms_file != "") {
    synonym_map <- load_gene_synonyms(synonyms_file)
  }
  
  # 2. Load gene annotations if provided
  row_groups <- NULL
  if (!is.null(gene_annotation_file) && gene_annotation_file != "") {
    row_groups <- load_gene_annotations(gene_annotation_file, gene_symbols)
    if (is.null(row_groups)) {
      cat("  Warning: No valid gene-group mappings found. Proceeding without row splitting.\n")
    }
  }
  
  # 3. Process TCGA data
  if (!is.null(tcga_rds_file) && !file.exists(tcga_rds_file)) {
    cat("  Warning: TCGA RDS file not found:", tcga_rds_file, "\n")
    cat("  Falling back to TCGA API (quartiles method)\n")
    tcga_rds_file <- NULL
  }
  
  tcga_data <- process_tcga_data(gene_symbols, cohorts = tcga_cohorts, 
                                 delay = delay, show_progress = show_progress,
                                 use_cache = use_cache, synonym_map = synonym_map,
                                 tcga_rds_file = tcga_rds_file)
  
  # 4. Process GTEx data
  gtex_matrix <- process_gtex_data(gtex_tsv_file, gene_symbols, collapse_tissues = collapse_gtex_tissues)
  
  # 5. Prepare TCGA matrix
  tcga_matrix <- prepare_tcga_matrix(tcga_data, gene_symbols, tcga_cohorts)
  
  # 6. Process rubric data if provided
  rubric_total_matrix <- NULL
  rubric_matrix <- NULL
  if (!is.null(rubric_data)) {
    # Filter rubric data to only partner genes (gene2_name)
    rubric_data_filtered <- rubric_data %>%
      filter(gene2_name %in% gene_symbols)
    
    if (nrow(rubric_data_filtered) > 0) {
      # Use gene2_name as the gene identifier for rubric
      rubric_data_for_matrix <- rubric_data_filtered %>%
        mutate(gene_symbol = gene2_name) %>%
        select(gene_symbol, contains("SCORE_"))
      
      # In partner mode, use SCORE_SUM_ANC_PARTNER as the total score column
      rubric_matrices <- prepare_rubric_matrix(
        rubric_data_for_matrix, 
        gene_symbols, 
        zscore = rubric_zscore,
        total_score_col = "SCORE_SUM_ANC_PARTNER"
      )
      rubric_total_matrix <- rubric_matrices$total
      rubric_matrix <- rubric_matrices$other
    }
  }
  
  # 7. Ensure all matrices have identical gene order
  cat("\nEnsuring consistent gene ordering between panels...\n")
  common_genes <- intersect(rownames(tcga_matrix), rownames(gtex_matrix))
  if (!is.null(rubric_matrix)) {
    common_genes <- intersect(common_genes, rownames(rubric_matrix))
  }
  if (!is.null(rubric_total_matrix)) {
    common_genes <- intersect(common_genes, rownames(rubric_total_matrix))
  }
  cat("  Common genes:", length(common_genes), "\n")
  
  # Reorder all matrices to match input gene order
  tcga_matrix <- tcga_matrix[gene_symbols, , drop = FALSE]
  gtex_matrix <- gtex_matrix[gene_symbols, , drop = FALSE]
  if (!is.null(rubric_matrix)) {
    rubric_matrix <- rubric_matrix[gene_symbols, , drop = FALSE]
  }
  if (!is.null(rubric_total_matrix)) {
    rubric_total_matrix <- rubric_total_matrix[gene_symbols, , drop = FALSE]
  }
  
  # Remove rows that are all NA
  tcga_has_data <- rowSums(!is.na(tcga_matrix)) > 0
  gtex_has_data <- rowSums(!is.na(gtex_matrix)) > 0
  rubric_has_data <- if (!is.null(rubric_matrix)) rowSums(!is.na(rubric_matrix)) > 0 else rep(FALSE, length(gene_symbols))
  rubric_total_has_data <- if (!is.null(rubric_total_matrix)) rowSums(!is.na(rubric_total_matrix)) > 0 else rep(FALSE, length(gene_symbols))
  genes_with_data <- gene_symbols[tcga_has_data | gtex_has_data | rubric_has_data | rubric_total_has_data]
  
  if (length(genes_with_data) < length(gene_symbols)) {
    cat("  Filtering to", length(genes_with_data), "genes with data\n")
    tcga_matrix <- tcga_matrix[genes_with_data, , drop = FALSE]
    gtex_matrix <- gtex_matrix[genes_with_data, , drop = FALSE]
    if (!is.null(rubric_matrix)) {
      rubric_matrix <- rubric_matrix[genes_with_data, , drop = FALSE]
    }
    if (!is.null(rubric_total_matrix)) {
      rubric_total_matrix <- rubric_total_matrix[genes_with_data, , drop = FALSE]
    }
  }
  
  # 8. Prepare row groups
  if (!is.null(row_groups)) {
    row_groups_filtered <- row_groups[names(row_groups) %in% genes_with_data]
    if (length(row_groups_filtered) > 0) {
      row_groups <- row_groups_filtered
      row_groups <- row_groups[genes_with_data]
    } else {
      row_groups <- NULL
    }
  }
  
  # 9. Split rubric matrix into Tumor Expression and Other scores
  rubric_tumor_matrix <- NULL
  rubric_other_matrix <- NULL
  
  if (!is.null(rubric_matrix)) {
    col_names <- colnames(rubric_matrix)
    healthy_expr_pattern <- grepl("gtex|hpa|keytissues|key.tissues|key.tissue", col_names, ignore.case = TRUE)
    dependency_pattern <- grepl("depmap|dependency", col_names, ignore.case = TRUE) & !healthy_expr_pattern
    tumor_pattern <- !healthy_expr_pattern & !dependency_pattern
    
    if (sum(tumor_pattern) > 0) {
      rubric_tumor_matrix <- rubric_matrix[, tumor_pattern, drop = FALSE]
      cat("  Split rubric: Tumor Expression =", sum(tumor_pattern), "columns\n")
    }
    if (sum(!tumor_pattern) > 0) {
      rubric_other_matrix <- rubric_matrix[, !tumor_pattern, drop = FALSE]
      cat("  Split rubric: Other scores =", sum(!tumor_pattern), "columns\n")
    }
  }
  
  # 10. Create heatmaps
  if (!is.null(rubric_total_matrix)) {
    rubric_total_heatmap <- create_rubric_total_heatmap(rubric_total_matrix,
                                                       row_groups = row_groups,
                                                       box_genes = box_genes)
  } else {
    rubric_total_heatmap <- NULL
  }
  
  rubric_tumor_heatmap <- NULL
  if (!is.null(rubric_tumor_matrix)) {
    rubric_tumor_heatmap <- create_rubric_heatmap(rubric_tumor_matrix,
                                                  row_groups = row_groups,
                                                  box_genes = box_genes,
                                                  panel_title = "Tumor Expression",
                                                  heatmap_name = "Tumor Expression Score",
                                                  show_legend = FALSE)
  }
  
  rubric_heatmap <- NULL
  if (!is.null(rubric_other_matrix)) {
    rubric_heatmap <- create_rubric_heatmap(rubric_other_matrix,
                                           row_groups = row_groups,
                                           box_genes = box_genes,
                                           heatmap_name = "Rubric Scores")
  }
  
  tcga_heatmap <- create_tcga_heatmap(tcga_matrix, 
                                     row_groups = row_groups,
                                     highlight_cohorts = highlight_cohorts,
                                     box_genes = box_genes)
  gtex_heatmap <- create_gtex_heatmap(gtex_matrix, 
                                     row_groups = row_groups,
                                     highlight_tissues = highlight_tissues,
                                     box_genes = box_genes)
  
  # 11. Combine and save
  combine_and_save(tcga_heatmap, gtex_heatmap, output_file, width, height, 
                  rubric_total_heatmap, rubric_tumor_heatmap, rubric_heatmap, chart_title,
                  append_to_pdf = append_to_pdf)
  
  cat("\nDone!\n")
  
  return(list(
    tcga_data = tcga_data,
    gtex_matrix = gtex_matrix,
    tcga_matrix = tcga_matrix,
    tcga_heatmap = tcga_heatmap,
    gtex_heatmap = gtex_heatmap,
    row_groups = row_groups,
    rubric_total_matrix = rubric_total_matrix,
    rubric_matrix = rubric_matrix,
    rubric_tumor_matrix = rubric_tumor_matrix,
    rubric_other_matrix = rubric_other_matrix,
    rubric_total_heatmap = rubric_total_heatmap,
    rubric_tumor_heatmap = rubric_tumor_heatmap,
    rubric_heatmap = rubric_heatmap
  ))
}

# ============================================================================
# Main Function
# ============================================================================
 
generate_tcga_gtex_heatmap <- function(
  gene_list_file = NULL,
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
  highlight_tissues = NULL,
  synonyms_file = NULL,
  tcga_rds_file = "tcga_log2data.RDS",
  box_genes = NULL,
  collapse_gtex_tissues = TRUE,
  rubric_file = NULL,
  topn = 35,
  rubric_zscore = FALSE,
  chart_title = NULL,
  partner_file = NULL
) {
  if (!file.exists(gtex_tsv_file)){
    cat("Error: GTEx file not found:", gtex_tsv_file, "\n")
    stop("GTEx file not found")
  }
  
  # Partner mode: loop over anchor genes
  if (!is.null(partner_file)) {
    return(generate_partner_mode_heatmaps(
      partner_file = partner_file,
      gtex_tsv_file = gtex_tsv_file,
      output_file = output_file,
      tcga_cohorts = tcga_cohorts,
      delay = delay,
      use_cache = use_cache,
      width = width,
      height = height,
      show_progress = show_progress,
      gene_annotation_file = gene_annotation_file,
      highlight_cohorts = highlight_cohorts,
      highlight_tissues = highlight_tissues,
      synonyms_file = synonyms_file,
      tcga_rds_file = tcga_rds_file,
      box_genes = box_genes,
      collapse_gtex_tissues = collapse_gtex_tissues,
      topn = topn,
      rubric_zscore = rubric_zscore,
      chart_title = chart_title
    ))
  }
  
  # Validate that either gene_list_file or rubric_file is provided
  if (is.null(gene_list_file) && is.null(rubric_file)) {
    stop("Either gene_list_file or rubric_file must be provided")
  }
  
  cat("=", rep("=", 70), "\n", sep = "")
  if (!is.null(rubric_file)) {
    cat("TCGA-GTEx-Rubric Triple Panel Heatmap Generation (RUBRIC MODE)\n")
  } else {
    cat("TCGA-GTEx Dual Panel Heatmap Generation\n")
  }
  cat("=", rep("=", 70), "\n", sep = "")
  
  # 1. Load gene list (from rubric file if in rubric mode, otherwise from gene_list_file)
  rubric_data <- NULL
  if (!is.null(rubric_file)) {
    # Rubric mode: load genes from rubric file
    rubric_result <- load_gene_list_from_rubric(rubric_file, topn = topn)
    gene_symbols <- rubric_result$genes
    rubric_data <- rubric_result$rubric_data
  } else {
    # Normal mode: load genes from gene list file
    gene_symbols <- load_gene_list(gene_list_file)
  }
  
  # 2. Load gene synonyms if provided
  synonym_map <- NULL
  if (!is.null(synonyms_file) && synonyms_file != "") {
    synonym_map <- load_gene_synonyms(synonyms_file)
  }
  
  # 3. Load gene annotations if provided
  row_groups <- NULL
  if (!is.null(gene_annotation_file) && gene_annotation_file != "") {
    row_groups <- load_gene_annotations(gene_annotation_file, gene_symbols)
    if (is.null(row_groups)) {
      cat("  Warning: No valid gene-group mappings found. Proceeding without row splitting.\n")
    }
  }
  
  # 4. Process TCGA data (with synonym support and RDS file option)
  # Check if RDS file exists, if not fall back to API
  if (!is.null(tcga_rds_file) && !file.exists(tcga_rds_file)) {
    cat("  Warning: TCGA RDS file not found:", tcga_rds_file, "\n")
    cat("  Falling back to TCGA API (quartiles method)\n")
    tcga_rds_file <- NULL
  }
  
  tcga_data <- process_tcga_data(gene_symbols, cohorts = tcga_cohorts, 
                                 delay = delay, show_progress = show_progress,
                                 use_cache = use_cache, synonym_map = synonym_map,
                                 tcga_rds_file = tcga_rds_file)
  
  # 5. Process GTEx data
  gtex_matrix <- process_gtex_data(gtex_tsv_file, gene_symbols, collapse_tissues = collapse_gtex_tissues)
  
  # 6. Prepare TCGA matrix (ensure same gene order)
  tcga_matrix <- prepare_tcga_matrix(tcga_data, gene_symbols, tcga_cohorts)
  
  # 7. Process rubric data if in rubric mode
  rubric_total_matrix <- NULL
  rubric_matrix <- NULL
  rubric_total_heatmap <- NULL
  rubric_heatmap <- NULL
  if (!is.null(rubric_file) && !is.null(rubric_data)) {
    rubric_matrices <- prepare_rubric_matrix(rubric_data, gene_symbols, zscore = rubric_zscore)
    rubric_total_matrix <- rubric_matrices$total
    rubric_matrix <- rubric_matrices$other
  }
  
  # 8. Ensure all matrices have identical gene order
  cat("\nEnsuring consistent gene ordering between panels...\n")
  common_genes <- intersect(rownames(tcga_matrix), rownames(gtex_matrix))
  if (!is.null(rubric_matrix)) {
    common_genes <- intersect(common_genes, rownames(rubric_matrix))
  }
  if (!is.null(rubric_total_matrix)) {
    common_genes <- intersect(common_genes, rownames(rubric_total_matrix))
  }
  cat("  Common genes:", length(common_genes), "\n")
  
  # Reorder all matrices to match input gene order
  tcga_matrix <- tcga_matrix[gene_symbols, , drop = FALSE]
  gtex_matrix <- gtex_matrix[gene_symbols, , drop = FALSE]
  if (!is.null(rubric_matrix)) {
    rubric_matrix <- rubric_matrix[gene_symbols, , drop = FALSE]
  }
  if (!is.null(rubric_total_matrix)) {
    rubric_total_matrix <- rubric_total_matrix[gene_symbols, , drop = FALSE]
  }
  
  # Remove rows that are all NA (genes with no data)
  tcga_has_data <- rowSums(!is.na(tcga_matrix)) > 0
  gtex_has_data <- rowSums(!is.na(gtex_matrix)) > 0
  rubric_has_data <- if (!is.null(rubric_matrix)) rowSums(!is.na(rubric_matrix)) > 0 else rep(FALSE, length(gene_symbols))
  rubric_total_has_data <- if (!is.null(rubric_total_matrix)) rowSums(!is.na(rubric_total_matrix)) > 0 else rep(FALSE, length(gene_symbols))
  genes_with_data <- gene_symbols[tcga_has_data | gtex_has_data | rubric_has_data | rubric_total_has_data]
  
  if (length(genes_with_data) < length(gene_symbols)) {
    cat("  Filtering to", length(genes_with_data), "genes with data\n")
    tcga_matrix <- tcga_matrix[genes_with_data, , drop = FALSE]
    gtex_matrix <- gtex_matrix[genes_with_data, , drop = FALSE]
    if (!is.null(rubric_matrix)) {
      rubric_matrix <- rubric_matrix[genes_with_data, , drop = FALSE]
    }
    if (!is.null(rubric_total_matrix)) {
      rubric_total_matrix <- rubric_total_matrix[genes_with_data, , drop = FALSE]
    }
  }
  
  # 9. Prepare row groups for heatmaps (filter to genes with data)
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
  
  # 10. Split rubric matrix into Tumor Expression and Other scores (if needed)
  rubric_tumor_matrix <- NULL
  rubric_other_matrix <- NULL
  
  if (!is.null(rubric_matrix)) {
    col_names <- colnames(rubric_matrix)
    
    # Determine which columns belong to Tumor Expression
    healthy_expr_pattern <- grepl("gtex|hpa|keytissues|key.tissues|key.tissue", col_names, ignore.case = TRUE)
    dependency_pattern <- grepl("depmap|dependency", col_names, ignore.case = TRUE) & !healthy_expr_pattern
    tumor_pattern <- !healthy_expr_pattern & !dependency_pattern
    
    # Split into Tumor Expression and Other (Dependency + Healthy Expression)
    if (sum(tumor_pattern) > 0) {
      rubric_tumor_matrix <- rubric_matrix[, tumor_pattern, drop = FALSE]
      cat("  Split rubric: Tumor Expression =", sum(tumor_pattern), "columns\n")
    }
    if (sum(!tumor_pattern) > 0) {
      rubric_other_matrix <- rubric_matrix[, !tumor_pattern, drop = FALSE]
      cat("  Split rubric: Other scores =", sum(!tumor_pattern), "columns\n")
    }
  }
  
  # 11. Create heatmaps with row splitting if groups are provided
  if (!is.null(rubric_total_matrix)) {
    rubric_total_heatmap <- create_rubric_total_heatmap(rubric_total_matrix,
                                                         row_groups = row_groups,
                                                         box_genes = box_genes)
  }
  rubric_tumor_heatmap <- NULL
  if (!is.null(rubric_tumor_matrix)) {
    rubric_tumor_heatmap <- create_rubric_heatmap(rubric_tumor_matrix,
                                                   row_groups = row_groups,
                                                   box_genes = box_genes,
                                                   panel_title = "Tumor Expression",
                                                   heatmap_name = "Tumor Expression Score",
                                                   show_legend = FALSE)
  }
  rubric_heatmap <- NULL
  if (!is.null(rubric_other_matrix)) {
    rubric_heatmap <- create_rubric_heatmap(rubric_other_matrix,
                                            row_groups = row_groups,
                                            box_genes = box_genes,
                                            heatmap_name = "Rubric Scores")
  }
  tcga_heatmap <- create_tcga_heatmap(tcga_matrix, 
                                      row_groups = row_groups,
                                      highlight_cohorts = highlight_cohorts,
                                      box_genes = box_genes)
  gtex_heatmap <- create_gtex_heatmap(gtex_matrix, 
                                      row_groups = row_groups,
                                      highlight_tissues = highlight_tissues,
                                      box_genes = box_genes)
  
  # 12. Combine and save
  combine_and_save(tcga_heatmap, gtex_heatmap, output_file, width, height, 
                  rubric_total_heatmap, rubric_tumor_heatmap, rubric_heatmap, chart_title)
  
  cat("\nDone!\n")
  
  return(list(
    tcga_data = tcga_data,
    gtex_matrix = gtex_matrix,
    tcga_matrix = tcga_matrix,
    tcga_heatmap = tcga_heatmap,
    gtex_heatmap = gtex_heatmap,
    row_groups = row_groups,
    rubric_total_matrix = rubric_total_matrix,
    rubric_matrix = rubric_matrix,
    rubric_tumor_matrix = rubric_tumor_matrix,
    rubric_other_matrix = rubric_other_matrix,
    rubric_total_heatmap = rubric_total_heatmap,
    rubric_tumor_heatmap = rubric_tumor_heatmap,
    rubric_heatmap = rubric_heatmap
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
  # Define command-line options
  option_list <- list(
    make_option(c("-g", "--gene-list"), 
                type = "character", 
                default = NULL,
                help = "Path to text file with HGNC gene symbols (one per line) [REQUIRED]",
                metavar = "FILE"),
    make_option(c("-x", "--gtex-file"), 
                type = "character", 
                default = "gtex_data_in.medians.tsv",
                help = "Path to GTEx median expression TSV file [default: %default]",
                metavar = "FILE"),
    make_option(c("-o", "--output"), 
                type = "character", 
                default = "tcga_gtex_heatmap.pdf",
                help = "Path to output PDF file [default: %default]",
                metavar = "FILE"),
    make_option("--title", 
                type = "character", 
                default = NULL,
                help = "Custom title for the heatmap chart",
                metavar = "TITLE"),
    make_option("--gene-annotation", 
                type = "character", 
                default = NULL,
                help = "Path to TSV/CSV file with Gene and Group/Category columns",
                metavar = "FILE"),
    make_option("--highlight-cohorts", 
                type = "character", 
                default = NULL,
                help = "Comma-separated list of TCGA cohorts to highlight (e.g., \"LUAD,LUSC\")",
                metavar = "LIST"),
    make_option("--highlight-tissues", 
                type = "character", 
                default = NULL,
                help = "Comma-separated list of GTEx tissues to highlight (e.g., \"Lung\")",
                metavar = "LIST"),
    make_option("--synonyms", 
                type = "character", 
                default = NULL,
                help = "Path to TSV/CSV file with gene synonyms (first col=gene, rest=synonyms)",
                metavar = "FILE"),
    make_option("--tcga-rds", 
                type = "character", 
                default = "tcga_log2data.RDS",
                help = "Path to TCGA RDS file with pre-computed log2FC [default: %default]. Set to \"NULL\" to use API",
                metavar = "FILE"),
    make_option("--box-genes", 
                type = "character", 
                default = NULL,
                help = "Comma-separated list of genes to draw horizontal boxes around (e.g., \"GeneA,GeneB\")",
                metavar = "LIST"),
    make_option("--no-collapse", 
                action = "store_true",
                default = FALSE,
                help = "Disable collapsing GTEx tissues by top-level name (default: tissues are collapsed by top-level name and averaged)"),
    make_option("--rubric", 
                type = "character", 
                default = NULL,
                help = "Path to rubric Excel file (triggers rubric mode - uses gene_symbol from rubric as gene list) [default: %default]",
                metavar = "FILE"),
    make_option("--topn", 
                type = "integer", 
                default = 35,
                help = "Number of top genes to select from rubric (sorted by SCORE_total) [default: %default]",
                metavar = "N"),
    make_option("--rubric-zscore", 
                action = "store_true",
                default = FALSE,
                help = "Enable z-score normalization for rubric scores (default: normalization disabled)"),
    make_option("--partnerfile", 
                type = "character", 
                default = NULL,
                help = "Path to anchor partner Excel file (triggers partner mode - generates heatmap per anchor gene using gene2_name as gene list) [default: %default]",
                metavar = "FILE")
  )
  
  # Parse arguments
  opt_parser <- OptionParser(option_list = option_list,
                             usage = "usage: %prog [options]",
                             description = "TCGA-GTEx Dual Panel Heatmap Generator (use --rubric for rubric mode, --partnerfile for partner mode)")
  opts <- parse_args(opt_parser)
  
  # Validate required arguments
  # Either --gene-list OR --rubric OR --partnerfile must be provided
  if (is.null(opts[["gene-list"]]) && is.null(opts[["rubric"]]) && is.null(opts[["partnerfile"]])) {
    print_help(opt_parser)
    stop("Either --gene-list, --rubric, or --partnerfile is required")
  }
  
  # Partner mode takes precedence
  if (!is.null(opts[["partnerfile"]])) {
    if (!is.null(opts[["rubric"]]) || !is.null(opts[["gene-list"]])) {
      cat("  Warning: --partnerfile provided. Using partner mode (ignoring --rubric and --gene-list).\n")
    }
  } else if (!is.null(opts[["rubric"]]) && !is.null(opts[["gene-list"]])) {
    # If rubric mode, gene-list is not needed
    cat("  Warning: Both --rubric and --gene-list provided. Using --rubric (rubric mode).\n")
  }
  
  gene_list_file <- opts[["gene-list"]]
  rubric_file <- opts[["rubric"]]
  gtex_tsv_file <- opts[["gtex-file"]]
  output_file <- opts$output
  chart_title <- opts[["title"]]
  gene_annotation_file <- opts[["gene-annotation"]]
  highlight_cohorts <- parse_comma_list(opts[["highlight-cohorts"]])
  highlight_tissues <- parse_comma_list(opts[["highlight-tissues"]])
  synonyms_file <- opts$synonyms
  box_genes <- parse_comma_list(opts[["box-genes"]])
  # Default is TRUE (collapse enabled), set to FALSE if --no-collapse is provided
  collapse_gtex_tissues <- !opts[["no-collapse"]]
  topn <- opts[["topn"]]
  rubric_zscore <- opts[["rubric-zscore"]]  # Default is FALSE (normalization disabled)
  tcga_rds_file <- if (!is.null(opts[["tcga-rds"]]) && 
                       (opts[["tcga-rds"]] == "NULL" || opts[["tcga-rds"]] == "")) {
    NULL
  } else {
    opts[["tcga-rds"]]
  }
  
  partner_file <- opts[["partnerfile"]]
  
  # Validate file existence
  if (!is.null(partner_file)) {
    # Partner mode: validate partner file
    if (!file.exists(partner_file)) {
      stop("Partner file not found: ", partner_file)
    }
    # gene_list_file and rubric_file can be NULL in partner mode
    gene_list_file <- NULL
    rubric_file <- NULL
  } else if (!is.null(rubric_file)) {
    # Rubric mode: validate rubric file
    if (!file.exists(rubric_file)) {
      stop("Rubric file not found: ", rubric_file)
    }
    # gene_list_file can be NULL in rubric mode
    gene_list_file <- NULL
  } else {
    # Normal mode: validate gene list file
    if (is.null(gene_list_file) || !file.exists(gene_list_file)) {
      stop("Gene list file not found: ", gene_list_file)
    }
  }
  
  if (!file.exists(gtex_tsv_file)) {
    stop("GTEx TSV file not found: ", gtex_tsv_file)
  }
  
  # Call main function
  result <- generate_tcga_gtex_heatmap(
    gene_list_file = gene_list_file,
    gtex_tsv_file = gtex_tsv_file,
    output_file = output_file,
    chart_title = chart_title,
    gene_annotation_file = gene_annotation_file,
    highlight_cohorts = highlight_cohorts,
    highlight_tissues = highlight_tissues,
    synonyms_file = synonyms_file,
    tcga_rds_file = tcga_rds_file,
    box_genes = box_genes,
    collapse_gtex_tissues = collapse_gtex_tissues,
    rubric_file = rubric_file,
    topn = topn,
    rubric_zscore = rubric_zscore,
    partner_file = partner_file
  )
}

if (!interactive()) {
  main()
}

