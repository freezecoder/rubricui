#!/usr/bin/env Rscript
# Plot top N highest scoring POSITIVELY correlated gene pairs as scatter plots
# Shows geneA vs geneB with regression line and correlation values
# Only plots pairs with positive correlation values
#
# Usage:
#   Rscript plot_top_correlations.R [input_csv] [output_file] [N] [expr_file]
#
# Arguments:
#   input_csv   - Path to correlation CSV file (default: HNSCC_prot.corr.csv)
#   output_file - Path to output PDF file (default: top_correlations_plot.pdf)
#   N           - Number of top pairs to plot (default: 100)
#   expr_file   - Path to expression data file (optional, auto-detected if not provided)
#
# Example:
#   Rscript plot_top_correlations.R
#   Rscript plot_top_correlations.R HNSCC_prot.corr.csv output.pdf 50
#   Rscript plot_top_correlations.R HNSCC_prot.corr.csv output.pdf 50 expr_file.txt

# Load required libraries
suppressPackageStartupMessages({
  library(ggplot2)
  library(readr)
  library(dplyr)
  library(gridExtra)
})

# ============================================================================
# Function: Read correlation data
# ============================================================================
read_correlation_data <- function(input_file) {
  cat("Reading correlation data from:", input_file, "\n")
  
  # Read the CSV file
  data <- read_csv(input_file, show_col_types = FALSE)
  
  cat("  Loaded", nrow(data), "gene pairs\n")
  
  return(data)
}

# ============================================================================
# Function: Get expression data for plotting
# ============================================================================
get_expression_data <- function(corr_data, input_file, expr_file_path = NULL) {
  cat("\nLoading expression data for plotting...\n")
  
  # If expression file path is provided, use it
  if (!is.null(expr_file_path) && file.exists(expr_file_path)) {
    cat("  Using provided expression file:", expr_file_path, "\n")
  } else {
    # Try to infer the original expression file path
    # If input_file is HNSCC_prot.corr.csv, try HNSCC_proteomics...Tumor.txt
    expr_file <- gsub("_prot\\.corr\\.csv$", "_proteomics_gene_abundance_log2_reference_intensity_normalized_Tumor.txt", 
                      basename(input_file))
    
    # Try multiple possible locations
    possible_paths <- c(
      file.path(dirname(input_file), expr_file),
      file.path(dirname(input_file), "../cptac", expr_file),
      file.path(dirname(input_file), "HNSCC_proteomics_gene_abundance_log2_reference_intensity_normalized_Tumor.txt"),
      "/Users/zayed/Downloads/ai_apps/rubricrunner/cptac/HNSCC_proteomics_gene_abundance_log2_reference_intensity_normalized_Tumor.txt"
    )
    
    expr_file_path <- NULL
    for (path in possible_paths) {
      if (file.exists(path)) {
        expr_file_path <- path
        break
      }
    }
    
    if (is.null(expr_file_path)) {
      stop("Could not find expression data file. Please specify the path to the original expression file as the 4th argument.")
    }
    
    cat("  Found expression file:", expr_file_path, "\n")
  }
  
  # Read expression data
  expr_data <- read_delim(expr_file_path, delim = "\t", col_names = TRUE, 
                          show_col_types = FALSE)
  
  # Extract gene IDs and expression matrix
  gene_ids <- expr_data[[1]]
  expr_matrix <- as.matrix(expr_data[, -1])
  rownames(expr_matrix) <- gene_ids
  
  # Convert to numeric - ensure all columns are preserved
  # Apply as.numeric to each column while preserving structure
  expr_matrix_numeric <- matrix(as.numeric(expr_matrix), 
                                nrow = nrow(expr_matrix), 
                                ncol = ncol(expr_matrix))
  rownames(expr_matrix_numeric) <- gene_ids
  colnames(expr_matrix_numeric) <- colnames(expr_matrix)
  
  cat("  Loaded expression data for", nrow(expr_matrix_numeric), "genes and", 
      ncol(expr_matrix_numeric), "samples\n")
  
  return(expr_matrix_numeric)
}

# ============================================================================
# Function: Create scatter plot for a single gene pair
# ============================================================================
plot_gene_pair <- function(gene1, gene2, corr_value, pval, n_samples, 
                           expr_matrix, pair_index, total_pairs) {
  
  # Get expression values for both genes (ensure we get all columns/samples)
  # Use drop = FALSE to ensure we get a vector even if matrix has one row
  if (gene1 %in% rownames(expr_matrix) && gene2 %in% rownames(expr_matrix)) {
    gene1_expr <- as.numeric(expr_matrix[gene1, , drop = TRUE])
    gene2_expr <- as.numeric(expr_matrix[gene2, , drop = TRUE])
  } else {
    return(NULL)
  }
  
  # Convert NA values to 0 (same as correlation calculation)
  # This ensures we plot all samples, matching the correlation analysis
  gene1_expr[is.na(gene1_expr)] <- 0
  gene2_expr[is.na(gene2_expr)] <- 0
  
  if (length(gene1_expr) < 3) {
    # Not enough data points
    return(NULL)
  }
  
  # All samples should be included now (no filtering needed)
  # Create data frame for plotting
  plot_data <- data.frame(
    gene1_expr = gene1_expr,
    gene2_expr = gene2_expr
  )
  
  # Get actual number of points being plotted
  n_plotted <- nrow(plot_data)
  
  # Create plot with all data points using jitter to avoid overlap
  p <- ggplot(plot_data, aes(x = gene1_expr, y = gene2_expr)) +
    geom_jitter(alpha = 0.6, size = 1.5, color = "steelblue", 
                width = 0.02, height = 0.02) +
    geom_smooth(method = "lm", se = TRUE, color = "red", linetype = "dashed", 
                linewidth = 0.8, alpha = 0.3) +
    labs(
      x = gene1,
      y = gene2,
      title = paste0("Pair ", pair_index, "/", total_pairs, ": ", gene1, " vs ", gene2),
      subtitle = paste0("ρ = ", round(corr_value, 3), 
                       ", p = ", formatC(pval, format = "e", digits = 2),
                       ", n = ", n_plotted, " samples (all samples, NAs=0)")
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 10, face = "bold"),
      plot.subtitle = element_text(size = 9),
      axis.title = element_text(size = 9),
      axis.text = element_text(size = 8),
      panel.grid.minor = element_blank()
    ) +
    # Add correlation text annotation
    annotate("text", 
             x = Inf, y = Inf,
             label = paste0("ρ = ", round(corr_value, 3)),
             hjust = 1.1, vjust = 1.5,
             size = 3.5,
             fontface = "bold",
             color = "darkred")
  
  return(p)
}

# ============================================================================
# Function: Create grid of plots
# ============================================================================
create_plot_grid <- function(top_pairs, expr_matrix, n_plots) {
  cat("\nCreating scatter plots...\n")
  
  plots <- list()
  valid_plots <- 0
  
  for (i in 1:nrow(top_pairs)) {
    if (valid_plots >= n_plots) break
    
    gene1 <- top_pairs$gene1[i]
    gene2 <- top_pairs$gene2[i]
    corr_value <- top_pairs$correlation[i]
    pval <- top_pairs$pval[i]
    n_samples <- top_pairs$n_samples[i]
    
    # Check if both genes exist in expression matrix
    if (!gene1 %in% rownames(expr_matrix) || !gene2 %in% rownames(expr_matrix)) {
      cat("  Warning: Skipping pair", i, "- gene(s) not found in expression matrix\n")
      next
    }
    
    p <- plot_gene_pair(gene1, gene2, corr_value, pval, n_samples, 
                       expr_matrix, valid_plots + 1, n_plots)
    
    if (!is.null(p)) {
      plots[[length(plots) + 1]] <- p
      valid_plots <- valid_plots + 1
      
      # Debug: Print sample count for first few plots
      if (valid_plots <= 3) {
        gene1_expr <- as.numeric(expr_matrix[gene1, , drop = TRUE])
        gene2_expr <- as.numeric(expr_matrix[gene2, , drop = TRUE])
        # Convert NAs to 0 (same as correlation calculation)
        gene1_expr[is.na(gene1_expr)] <- 0
        gene2_expr[is.na(gene2_expr)] <- 0
        n_valid <- length(gene1_expr)  # All samples included now
        cat("  Plot", valid_plots, ":", gene1, "vs", gene2, 
            "- plotting", n_valid, "samples (all samples, NAs converted to 0)\n")
      }
      
      if (valid_plots %% 10 == 0) {
        cat("  Created", valid_plots, "plots...\n")
      }
    }
  }
  
  cat("  Total plots created:", length(plots), "\n")
  
  return(plots)
}

# ============================================================================
# Function: Save plots to PDF
# ============================================================================
save_plots_to_pdf <- function(plots, output_file, n_per_page = 4) {
  cat("\nSaving plots to PDF:", output_file, "\n")
  
  n_plots <- length(plots)
  n_pages <- ceiling(n_plots / n_per_page)
  
  cat("  Total plots:", n_plots, "\n")
  cat("  Plots per page:", n_per_page, "\n")
  cat("  Total pages:", n_pages, "\n")
  
  pdf(output_file, width = 14, height = 10)
  
  for (page in 1:n_pages) {
    start_idx <- (page - 1) * n_per_page + 1
    end_idx <- min(page * n_per_page, n_plots)
    
    page_plots <- plots[start_idx:end_idx]
    
    # Arrange plots in grid
    if (length(page_plots) == 1) {
      print(page_plots[[1]])
    } else if (length(page_plots) == 2) {
      grid.arrange(grobs = page_plots, ncol = 1)
    } else if (length(page_plots) <= 4) {
      grid.arrange(grobs = page_plots, ncol = 2)
    } else {
      grid.arrange(grobs = page_plots, ncol = 2, nrow = 2)
    }
    
    cat("  Saved page", page, "of", n_pages, "\n")
  }
  
  dev.off()
  
  cat("  PDF saved successfully!\n")
}

# ============================================================================
# Main execution
# ============================================================================
main <- function() {
  # Parse command-line arguments
  args <- commandArgs(trailingOnly = TRUE)
  
  # Default values
  default_input <- "HNSCC_prot.corr.csv"
  default_output <- "top_correlations_plot.pdf"
  default_n <- 100
  
  input_file <- if (length(args) >= 1) args[1] else default_input
  output_file <- if (length(args) >= 2) args[2] else default_output
  n_plots <- if (length(args) >= 3) as.integer(args[3]) else default_n
  expr_file <- if (length(args) >= 4) args[4] else NULL
  
  # Check if input file exists
  if (!file.exists(input_file)) {
    stop("Input file not found: ", input_file)
  }
  
  cat("=", rep("=", 70), "\n", sep = "")
  cat("Top Correlation Scatter Plots\n")
  cat("=", rep("=", 70), "\n", sep = "")
  cat("Input file:", input_file, "\n")
  cat("Output file:", output_file, "\n")
  cat("Number of top pairs:", n_plots, "\n")
  
  # Read correlation data
  corr_data <- read_correlation_data(input_file)
  
  # Filter for positive correlations only, then select top N pairs
  positive_pairs <- corr_data %>%
    filter(correlation > 0)
  
  cat("\nFound", nrow(positive_pairs), "positive correlated pairs out of", 
      nrow(corr_data), "total pairs\n")
  
  if (nrow(positive_pairs) == 0) {
    stop("No positive correlations found in the data.")
  }
  
  # Select top N pairs by correlation value (descending)
  top_pairs <- positive_pairs %>%
    arrange(desc(correlation)) %>%
    head(n_plots)
  
  cat("\nSelected top", nrow(top_pairs), "positive correlated pairs\n")
  cat("  Correlation range:", round(min(top_pairs$correlation), 3), "to", 
      round(max(top_pairs$correlation), 3), "\n")
  
  # Get expression data
  expr_matrix <- get_expression_data(corr_data, input_file, expr_file)
  
  # Create plots
  plots <- create_plot_grid(top_pairs, expr_matrix, n_plots)
  
  if (length(plots) == 0) {
    stop("No valid plots could be created. Check that gene IDs match between files.")
  }
  
  # Save to PDF
  save_plots_to_pdf(plots, output_file)
  
  cat("\nDone!\n")
}

# Run main function
if (!interactive()) {
  main()
}

