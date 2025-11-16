#!/usr/bin/env Rscript
# Calculate Spearman correlation using Hmisc::rcorr() on CPTAC proteomics data
# Output: data frame with gene1, gene2, correlation, pval, n_samples
#
# Usage:
#   Rscript calculate_spearman_correlation.R [input_file] [output_file] [gene_filter_file]
#
# Arguments:
#   input_file  - Path to input file (tab-delimited with genes in first column)
#                 Default: HNSCC_proteomics_gene_abundance_log2_reference_intensity_normalized_Tumor.txt
#   output_file - Path to output CSV file (default: spearman_correlations.csv)
#
# Example:
#   Rscript calculate_spearman_correlation.R
#   Rscript calculate_spearman_correlation.R input.txt output.csv genes_of_interest.txt

# Load required libraries
suppressPackageStartupMessages({
  library(Hmisc)
  library(readr)
  library(dplyr)
})

# ============================================================================
# Constants and helper functions
# ============================================================================
ENSEMBL_MAPPING_PATH <- "/Users/zayed/Downloads/ai_apps/rubricrunner/cptac/ensembl_gene_mapping.csv"

normalize_gene_ids <- function(ids) {
  if (is.null(ids)) {
    return(character(0))
  }
  sub("\\.[0-9]+$", "", ids)
}

load_gene_mapping <- function(mapping_path) {
  if (!file.exists(mapping_path)) {
    stop("Gene mapping file not found: ", mapping_path)
  }
  mapping <- read_csv(mapping_path, show_col_types = FALSE)
  mapping$gene_stable_clean <- normalize_gene_ids(mapping$gene_stable_id)
  mapping$gene_name_upper <- toupper(mapping$gene_name)
  mapping
}

read_gene_filter_file <- function(filter_path) {
  if (is.null(filter_path)) {
    return(NULL)
  }
  if (!file.exists(filter_path)) {
    stop("Gene filter file not found: ", filter_path)
  }
  filter_terms <- readLines(filter_path, warn = FALSE)
  filter_terms <- unique(trimws(filter_terms))
  filter_terms[nchar(filter_terms) > 0]
}

resolve_filter_ids <- function(filter_terms, gene_mapping) {
  if (length(filter_terms) == 0) {
    return(NULL)
  }
  ensembl_like <- grepl("^ENSG", filter_terms, ignore.case = TRUE)
  ensembl_ids <- normalize_gene_ids(toupper(filter_terms[ensembl_like]))
  gene_names <- toupper(filter_terms[!ensembl_like])
  
  mapped_ids <- character(0)
  if (length(gene_names) > 0) {
    mapped_ids <- gene_mapping$gene_stable_clean[gene_mapping$gene_name_upper %in% gene_names]
    if (length(mapped_ids) == 0) {
      cat("  Warning: No gene names matched mapping file\n")
    }
  }
  
  unique(c(ensembl_ids, mapped_ids))
}

lookup_hugo_names <- function(gene_ids, gene_mapping) {
  if (is.null(gene_ids) || nrow(gene_mapping) == 0) {
    return(rep(NA_character_, length(gene_ids)))
  }
  cleaned_ids <- normalize_gene_ids(gene_ids)
  hugo <- gene_mapping$gene_name[match(cleaned_ids, gene_mapping$gene_stable_clean)]
  hugo
}

# ============================================================================
# Function: Read input file and prepare data
# ============================================================================
prepare_data <- function(input_file, gene_mapping, filter_terms = NULL) {
  cat("Reading input file:", input_file, "\n")
  
  # Read the data file
  data <- read_delim(input_file, delim = "\t", col_names = TRUE, 
                     show_col_types = FALSE)
  
  # Extract gene IDs (first column)
  gene_ids <- data[[1]]
  normalized_gene_ids <- normalize_gene_ids(gene_ids)
  
  if (!is.null(filter_terms)) {
    cat("  Applying gene filter from provided list...\n")
    requested_ids <- resolve_filter_ids(filter_terms, gene_mapping)
    if (length(requested_ids) == 0) {
      stop("No valid gene identifiers found in filter file")
    }
    keep_rows <- normalized_gene_ids %in% requested_ids
    cat("  Requested genes:", length(requested_ids), 
        "Matched genes in dataset:", sum(keep_rows), "\n")
    if (!any(keep_rows)) {
      stop("None of the requested genes were found in the CPTAC matrix")
    }
    data <- data[keep_rows, , drop = FALSE]
    gene_ids <- data[[1]]
    normalized_gene_ids <- normalize_gene_ids(gene_ids)
  }
  
  # Extract expression matrix (all columns except first)
  # Ensure we preserve all columns
  expr_matrix <- as.matrix(data[, -1, drop = FALSE])
  
  # Set gene IDs as row names
  rownames(expr_matrix) <- gene_ids
  colnames(expr_matrix) <- colnames(data)[-1]  # Preserve sample names
  
  # Convert to numeric - preserve all columns
  expr_matrix_numeric <- matrix(as.numeric(expr_matrix), 
                                nrow = nrow(expr_matrix), 
                                ncol = ncol(expr_matrix))
  rownames(expr_matrix_numeric) <- gene_ids
  colnames(expr_matrix_numeric) <- colnames(expr_matrix)
  
  cat("  Loaded", nrow(expr_matrix_numeric), "genes and", 
      ncol(expr_matrix_numeric), "samples\n")
  cat("  Expected 97 samples - actual:", ncol(expr_matrix_numeric), "\n")
  
  # Check for any issues with sample count
  if (ncol(expr_matrix_numeric) != 97) {
    cat("  Warning: Expected 97 samples but found", ncol(expr_matrix_numeric), "\n")
    cat("  Sample names:", paste(head(colnames(expr_matrix_numeric), 5), collapse = ", "), "...\n")
  }
  
  # Transpose: genes as columns, samples as rows (for correlation)
  # rcorr expects samples as rows, genes as columns
  expr_transposed <- t(expr_matrix_numeric)
  
  cat("  Transposed matrix:", nrow(expr_transposed), "samples x", 
      ncol(expr_transposed), "genes\n")
  
  # Verify transpose preserved all samples
  if (nrow(expr_transposed) != ncol(expr_matrix_numeric)) {
    stop("Error: Transpose lost samples! Original:", ncol(expr_matrix_numeric), 
         " Transposed:", nrow(expr_transposed))
  }
  
  return(list(
    expr_transposed = expr_transposed,
    expr_original = expr_matrix_numeric,
    gene_ids = gene_ids,
    normalized_gene_ids = normalized_gene_ids
  ))
}

# ============================================================================
# Function: Calculate Spearman correlations
# ============================================================================
calculate_spearman_correlations <- function(expr_data) {
  cat("\nCalculating Spearman correlations using Hmisc::rcorr()...\n")
  cat("  Input data:", nrow(expr_data), "samples x", ncol(expr_data), "genes\n")
  
  # Convert NA values to 0 so we can use all samples for all gene pairs
  # This ensures every correlation uses all available samples
  cat("  Converting NA values to 0...\n")
  na_count_before <- sum(is.na(expr_data))
  expr_data[is.na(expr_data)] <- 0
  cat("  Converted", na_count_before, "NA values to 0\n")
  
  # Calculate Spearman correlation matrix and p-values
  # Now all correlations will use all samples (no pairwise deletion needed)
  corr_result <- rcorr(expr_data, type = "spearman")
  
  # Extract correlation matrix
  corr_matrix <- corr_result$r
  
  # Extract p-value matrix
  pval_matrix <- corr_result$P
  
  # Extract n matrix (number of samples used for each pair)
  # Since we converted NAs to 0, all pairs should use all samples
  n_matrix <- corr_result$n
  
  cat("  Correlation matrix dimensions:", nrow(corr_matrix), "x", ncol(corr_matrix), "\n")
  
  # Report sample usage statistics
  n_values <- n_matrix[upper.tri(n_matrix)]
  cat("  Sample counts per pair - Min:", min(n_values), 
      "Max:", max(n_values), "Mean:", round(mean(n_values), 1), "\n")
  cat("  Pairs using all", nrow(expr_data), "samples:", sum(n_values == nrow(expr_data)), "\n")
  
  return(list(corr = corr_matrix, pval = pval_matrix, n = n_matrix))
}


corr_to_df_all<-function(corr_result){
  m=corr_result$r
  p=corr_result$P
  dfcor<-data.frame(gene1=rownames(m)[row(m)[upper.tri(m)]],
                    gene2=colnames(m)[col(m)[upper.tri(m)]],
                    corr=m[upper.tri(m)],
                    pval=p[upper.tri(p)]
  )
  dfcorl<-data.frame(gene1=rownames(m)[row(m)[lower.tri(m)]],
                    gene2=colnames(m)[col(m)[lower.tri(m)]],
                    corr=m[lower.tri(m)],
                    pval=p[lower.tri(p)]
  )
  return(rbind(dfcor,dfcorl))

}

# ============================================================================
# Function: Convert correlation matrices to data frame
# ============================================================================
correlation_matrix_to_dataframe <- function(corr_result, gene_names, expr_matrix_original, gene_mapping) {
  cat("\nConverting correlation matrices to data frame...\n")
  
  corr_matrix <- corr_result$corr
  pval_matrix <- corr_result$pval
  n_matrix <- corr_result$n
  
  # Get gene names
  genes <- colnames(corr_matrix)
  n_genes <- length(genes)
  
  cat("  Processing", n_genes, "genes...\n")
  cat("  Total pairs:", choose(n_genes, 2), "\n")
  
  # Create index pairs for upper triangle (more efficient)
  # Use expand.grid and filter to upper triangle
  idx_pairs <- expand.grid(i = 1:n_genes, j = 1:n_genes, stringsAsFactors = FALSE)
  idx_pairs <- idx_pairs[idx_pairs$i < idx_pairs$j, ]
  
  # Calculate median expression for each gene (excluding NAs)
  cat("  Calculating median expression values...\n")
  gene_medians <- apply(expr_matrix_original, 1, function(x) median(x, na.rm = TRUE))
  
  # Extract values using matrix indexing (much faster)
  hugo_geneA <- lookup_hugo_names(genes[idx_pairs$i], gene_mapping)
  hugo_geneB <- lookup_hugo_names(genes[idx_pairs$j], gene_mapping)
  
  result_df <- data.frame(
    gene_symbol = genes[idx_pairs$i],
    gene2_name = genes[idx_pairs$j],
    gene_symbol_hugo = hugo_geneA,
    gene2_hugo = hugo_geneB,
    cptac_hnsc_prot_corr = signif(corr_matrix[cbind(idx_pairs$i, idx_pairs$j)], 4),
    cptac_hnsc_prot_pval = signif(pval_matrix[cbind(idx_pairs$i, idx_pairs$j)], 4),
    cptac_hnsc_prot = signif(corr_matrix[cbind(idx_pairs$i, idx_pairs$j)], 4),  # Same as corr
    n_samples = n_matrix[cbind(idx_pairs$i, idx_pairs$j)],
    median_geneA = signif(gene_medians[genes[idx_pairs$i]], 4),
    median_geneB = signif(gene_medians[genes[idx_pairs$j]], 4),
    stringsAsFactors = FALSE
  )
  
  cat("  Created data frame with", nrow(result_df), "rows\n")
  
  return(result_df)
}

# ============================================================================
# Main execution
# ============================================================================
main <- function() {
  # Parse command-line arguments
  args <- commandArgs(trailingOnly = TRUE)
  
  # Default input file path
  default_input <- "/Users/zayed/Downloads/ai_apps/rubricrunner/cptac/HNSCC_proteomics_gene_abundance_log2_reference_intensity_normalized_Tumor.txt"
  gene_filter_file <- NULL
  
  if (length(args) < 1) {
    cat("No input file specified, using default:", default_input, "\n")
    input_file <- default_input
  } else {
    input_file <- args[1]
  }
  
  output_file <- if (length(args) >= 2) args[2] else "spearman_correlations.csv"
  if (length(args) >= 3) {
    gene_filter_file <- args[3]
  }
  
  # Check if input file exists
  if (!file.exists(input_file)) {
    stop("Input file not found: ", input_file)
  }
  
  cat("=", rep("=", 70), "\n", sep = "")
  cat("Spearman Correlation Analysis\n")
  cat("=", rep("=", 70), "\n", sep = "")
  
  gene_mapping <- load_gene_mapping(ENSEMBL_MAPPING_PATH)
  filter_terms <- read_gene_filter_file(gene_filter_file)
  if (!is.null(filter_terms)) {
    cat("Gene filter file loaded:", gene_filter_file, "\n")
    cat("  Total requested entries:", length(filter_terms), "\n")
  }
  
  # Prepare data - need both transposed (for correlation) and original (for medians)
  prepared <- prepare_data(input_file, gene_mapping, filter_terms)
  expr_data_transposed <- prepared$expr_transposed
  expr_matrix_original <- prepared$expr_original
  
  # Calculate correlations
  corr_result <- calculate_spearman_correlations(expr_data_transposed)
  
  # Convert to data frame (pass original matrix for median calculations)
  result_df <- correlation_matrix_to_dataframe(
    corr_result,
    colnames(expr_data_transposed),
    expr_matrix_original,
    gene_mapping
  )
  
  # Remove rows with NA correlations (if any)
  na_rows <- sum(is.na(result_df$cptac_hnsc_prot_corr))
  if (na_rows > 0) {
    cat("\n  Warning: Removing", na_rows, "rows with NA correlations\n")
    result_df <- result_df[!is.na(result_df$cptac_hnsc_prot_corr), ]
  }
  
  # Sort by absolute correlation (descending)
  result_df <- result_df %>%
    arrange(desc(abs(.data$cptac_hnsc_prot_corr)))
  
  # Write output
  cat("\nWriting results to:", output_file, "\n")
  write_csv(result_df, output_file)
  
  cat("\nSummary statistics:\n")
  cat("  Total gene pairs:", nrow(result_df), "\n")
  cat("  Mean correlation:", round(mean(result_df$cptac_hnsc_prot_corr, na.rm = TRUE), 4), "\n")
  cat("  Median correlation:", round(median(result_df$cptac_hnsc_prot_corr, na.rm = TRUE), 4), "\n")
  cat("  Min correlation:", round(min(result_df$cptac_hnsc_prot_corr, na.rm = TRUE), 4), "\n")
  cat("  Max correlation:", round(max(result_df$cptac_hnsc_prot_corr, na.rm = TRUE), 4), "\n")
  cat("  Mean n_samples:", round(mean(result_df$n_samples, na.rm = TRUE), 1), "\n")
  cat("  Significant pairs (p < 0.05):", sum(result_df$cptac_hnsc_prot_pval < 0.05, na.rm = TRUE), "\n")
  cat("  Significant pairs (FDR < 0.05):", 
      sum(p.adjust(result_df$cptac_hnsc_prot_pval, method = "fdr") < 0.05, na.rm = TRUE), "\n")
  
  cat("\nDone!\n")
}

# Run main function
if (!interactive()) {
  main()
}

