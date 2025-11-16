#!/usr/bin/env Rscript
# Differential Expression Analysis using limma
# Tumor vs Normal comparison (Normal as control/base)
# Based on UC Davis Bioinformatics Workshop protocol

# Load required libraries
suppressPackageStartupMessages({
  library(optparse)
  library(limma)
  library(readr)
  library(writexl)
  library(dplyr)
  library(ggplot2)
  library(gridExtra)
})

# ============================================================================
# Configuration
# ============================================================================

option_list <- list(
  make_option(
    c("-n", "--normal-file"),
    type = "character",
    default = "cptac_normal.matrix.txt",
    help = "Path to the normal samples expression matrix [default: %default]"
  ),
  make_option(
    c("-t", "--tumor-file"),
    type = "character",
    default = "cptac_tumor.matrix.txt",
    help = "Path to the tumor samples expression matrix [default: %default]"
  ),
  make_option(
    c("-c", "--output-csv"),
    type = "character",
    default = "cptac_limma_results.csv",
    help = "Path to write the full limma results CSV [default: %default]"
  ),
  make_option(
    c("-x", "--output-excel"),
    type = "character",
    default = "HNSC_CPTAC_Tumor_vs_Normal_limma_results.xlsx",
    help = "Path to write the Excel workbook [default: %default]"
  ),
  make_option(
    c("-r", "--output-rds"),
    type = "character",
    default = "cptac_limma_results.rds",
    help = "Path to write the serialized RDS results [default: %default]"
  ),
  make_option(
    c("-p", "--output-boxplot-pdf"),
    type = "character",
    default = "cptac_top30_degs_boxplots.pdf",
    help = "Path to write the DEG boxplots PDF [default: %default]"
  ),
  make_option(
    c("-q", "--output-qc-pdf"),
    type = "character",
    default = "rna_qc.pdf",
    help = "Path to write the QC plots PDF [default: %default]"
  ),
  make_option(
    c("-g", "--top-degs"),
    type = "integer",
    default = 30,
    help = "Number of DEGs to include in boxplots [default: %default]"
  ),
  make_option(
    c("-e", "--expression-file"),
    type = "character",
    default = NA,
    help = "Path to a single expression matrix containing both normal and tumor samples"
  ),
  make_option(
    c("-i", "--normal-ids-file"),
    type = "character",
    default = NA,
    help = "Path to a text file listing normal sample IDs (one per line) when using --expression-file"
  )
)

opt_parser <- OptionParser(option_list = option_list)
opt <- parse_args(opt_parser)

normal_file <- opt$`normal-file`
tumor_file <- opt$`tumor-file`
output_csv <- opt$`output-csv`
output_excel <- opt$`output-excel`
output_rds <- opt$`output-rds`
output_pdf <- opt$`output-boxplot-pdf`
output_qc_pdf <- opt$`output-qc-pdf`
top_deg_count <- opt$`top-degs`
expression_file <- opt$`expression-file`
normal_ids_file <- opt$`normal-ids-file`

if (is.na(top_deg_count) || top_deg_count < 1) {
  stop("Argument --top-degs must be a positive integer.")
}

load_sample_ids <- function(file_path) {
  ids <- readLines(file_path, warn = FALSE)
  ids <- trimws(ids)
  ids <- ids[ids != ""]
  unique(ids)
}

# ============================================================================
# Function: Load expression matrix
# ============================================================================
load_expression_matrix <- function(file_path) {
  cat("Loading expression data from:", file_path, "\n")
  
  # Read the matrix file
  data <- read_delim(file_path, delim = "\t", col_names = TRUE, 
                     show_col_types = FALSE)
  
  # Extract gene IDs (first column)
  gene_ids <- data[[1]]
  
  # Extract expression matrix (all columns except first)
  expr_matrix <- as.matrix(data[, -1])
  
  # Set gene IDs as row names
  rownames(expr_matrix) <- gene_ids
  
  # Convert to numeric (handles NA values)
  expr_matrix <- apply(expr_matrix, 2, as.numeric)
  rownames(expr_matrix) <- gene_ids
  
  cat("  Loaded", nrow(expr_matrix), "genes and", ncol(expr_matrix), "samples\n")
  
  return(expr_matrix)
}

# ============================================================================
# Function: Prepare combined expression matrix
# ============================================================================
prepare_combined_matrix <- function(normal_matrix, tumor_matrix) {
  cat("\nPreparing combined expression matrix...\n")
  
  # Find common genes
  common_genes <- intersect(rownames(normal_matrix), rownames(tumor_matrix))
  cat("  Found", length(common_genes), "common genes\n")
  
  # Subset to common genes
  normal_subset <- normal_matrix[common_genes, , drop = FALSE]
  tumor_subset <- tumor_matrix[common_genes, , drop = FALSE]
  
  # Combine matrices (normal first, then tumor)
  combined_matrix <- cbind(normal_subset, tumor_subset)
  
  cat("  Combined matrix:", nrow(combined_matrix), "genes x", 
      ncol(combined_matrix), "samples\n")
  
  return(combined_matrix)
}

# ============================================================================
# Function: Create design matrix
# ============================================================================
create_design_matrix <- function(normal_n, tumor_n) {
  cat("\nCreating design matrix...\n")
  
  # Create group factor (Normal = 0, Tumor = 1)
  group <- factor(c(rep("Normal", normal_n), rep("Tumor", tumor_n)),
                  levels = c("Normal", "Tumor"))
  
  # Create design matrix with intercept
  # Normal is the reference/base level
  design <- model.matrix(~ group)
  colnames(design) <- c("Intercept", "Tumor_vs_Normal")
  
  cat("  Design matrix created:\n")
  print(head(design))
  cat("  Sample counts:\n")
  print(table(group))
  
  return(list(design = design, group = group))
}

# ============================================================================
# Function: Filter low expression genes
# ============================================================================
filter_low_expression <- function(expr_matrix, min_samples = 3) {
  cat("\nFiltering low expression genes...\n")
  
  # Count non-NA values per gene
  non_na_counts <- rowSums(!is.na(expr_matrix))
  
  # Keep genes with at least min_samples non-NA values
  keep <- non_na_counts >= min_samples
  
  cat("  Keeping", sum(keep), "genes out of", length(keep), 
      "after filtering\n")
  
  return(expr_matrix[keep, , drop = FALSE])
}

# ============================================================================
# Function: Perform limma differential expression analysis
# ============================================================================
perform_limma_analysis <- function(expr_matrix, design) {
  cat("\nPerforming limma differential expression analysis...\n")
  
  # Check if data needs log transformation
  # If values are > 20, likely already log-transformed
  if (median(expr_matrix, na.rm = TRUE) > 20) {
    cat("  Data appears to be log-transformed, skipping transformation\n")
    expr_log <- expr_matrix
  } else {
    cat("  Applying log2 transformation\n")
    expr_log <- log2(expr_matrix + 1)
  }
  
  # Fit linear model
  cat("  Fitting linear model...\n")
  fit <- lmFit(expr_log, design)
  
  # Apply empirical Bayes moderation
  cat("  Applying empirical Bayes moderation...\n")
  fit <- eBayes(fit)
  
  return(fit)
}

# ============================================================================
# Function: Extract results with median expression per condition
# ============================================================================
extract_results <- function(fit, expr_matrix, group_factor, coef = "Tumor_vs_Normal", 
                            adjust_method = "fdr", 
                            p_cutoff = 0.05, 
                            logfc_cutoff = 1) {
  cat("\nExtracting differential expression results...\n")
  
  # Get top table for all genes
  top_table <- topTable(fit, coef = coef, number = Inf, 
                       adjust.method = adjust_method)
  
  # Add gene IDs as a column
  top_table$GeneID <- rownames(top_table)
  
  # Calculate median expression per condition
  cat("  Calculating median expression per condition...\n")
  normal_idx <- which(group_factor == "Normal")
  tumor_idx <- which(group_factor == "Tumor")
  
  # Calculate median expression for each gene in each condition
  median_normal <- apply(expr_matrix[, normal_idx, drop = FALSE], 1, 
                        function(x) median(x, na.rm = TRUE))
  median_tumor <- apply(expr_matrix[, tumor_idx, drop = FALSE], 1, 
                       function(x) median(x, na.rm = TRUE))
  
  # Add median expression columns
  top_table$MedianExpression_Normal <- median_normal[top_table$GeneID]
  top_table$MedianExpression_Tumor <- median_tumor[top_table$GeneID]
  
  # Reorder columns to put GeneID first, then medians
  col_order <- c("GeneID", "MedianExpression_Normal", "MedianExpression_Tumor",
                 setdiff(colnames(top_table), 
                        c("GeneID", "MedianExpression_Normal", "MedianExpression_Tumor")))
  top_table <- top_table[, col_order]
  
  # Identify significant genes
  top_table$Significant <- ifelse(
    abs(top_table$logFC) >= logfc_cutoff & 
    top_table$adj.P.Val <= p_cutoff,
    "Yes", "No"
  )
  
  # Classify as Up/Down/NotSig
  top_table$Direction <- ifelse(
    top_table$Significant == "Yes",
    ifelse(top_table$logFC > 0, "Up", "Down"),
    "NotSig"
  )
  
  cat("  Total genes:", nrow(top_table), "\n")
  cat("  Significant genes (|logFC| >=", logfc_cutoff, 
      "& adj.P.Val <=", p_cutoff, "):", 
      sum(top_table$Significant == "Yes"), "\n")
  cat("  Up-regulated:", sum(top_table$Direction == "Up"), "\n")
  cat("  Down-regulated:", sum(top_table$Direction == "Down"), "\n")
  
  return(top_table)
}

# ============================================================================
# Function: Create summary statistics
# ============================================================================
create_summary_stats <- function(normal_n, tumor_n, results) {
  cat("\nCreating summary statistics...\n")
  
  summary_stats <- data.frame(
    Condition = c("Normal", "Tumor"),
    N_Samples = c(normal_n, tumor_n),
    stringsAsFactors = FALSE
  )
  
  # Add DEG statistics
  deg_stats <- data.frame(
    Metric = c("Total_Genes", "Significant_Genes", "Up_Regulated", 
               "Down_Regulated", "Not_Significant"),
    Count = c(
      nrow(results),
      sum(results$Significant == "Yes"),
      sum(results$Direction == "Up"),
      sum(results$Direction == "Down"),
      sum(results$Direction == "NotSig")
    ),
    stringsAsFactors = FALSE
  )
  
  return(list(sample_counts = summary_stats, deg_stats = deg_stats))
}

# ============================================================================
# Function: Create box plots for top differentially expressed genes
# ============================================================================
create_degs_boxplots <- function(expr_matrix, group_factor, top_degs, 
                                  n_genes = 30, output_file = "top_degs_boxplots.pdf",
                                  title_prefix = "Top DEGs") {
  cat("\nCreating box plots for top", n_genes, "differentially expressed genes...\n")
  
  # Get top N genes
  top_genes <- head(top_degs$GeneID, n_genes)
  
  if (length(top_genes) == 0) {
    cat("  Warning: No significant DEGs found. Skipping box plots.\n")
    return(NULL)
  }
  
  # Prepare data for plotting
  plot_data_list <- list()
  
  for (i in seq_along(top_genes)) {
    gene_id <- top_genes[i]
    
    if (!gene_id %in% rownames(expr_matrix)) {
      cat("  Warning: Gene", gene_id, "not found in expression matrix. Skipping.\n")
      next
    }
    
    # Extract expression values for this gene
    expr_values <- expr_matrix[gene_id, ]
    
    # Create data frame for plotting
    gene_data <- data.frame(
      Expression = as.numeric(expr_values),
      Group = group_factor,
      GeneID = gene_id,
      stringsAsFactors = FALSE
    )
    
    # Remove NA values
    gene_data <- gene_data[!is.na(gene_data$Expression), ]
    
    # Get statistics for annotation
    deg_info <- top_degs[top_degs$GeneID == gene_id, ]
    if (nrow(deg_info) > 0) {
      logfc <- round(deg_info$logFC, 2)
      adj_pval <- formatC(deg_info$adj.P.Val, format = "e", digits = 2)
      direction <- deg_info$Direction
      
      # Create subtitle with statistics
      subtitle_text <- paste0("logFC = ", logfc, 
                             ", adj.P.Val = ", adj_pval,
                             " (", direction, ")")
    } else {
      subtitle_text <- ""
    }
    
    plot_data_list[[i]] <- list(
      data = gene_data,
      gene_id = gene_id,
      subtitle = subtitle_text
    )
  }
  
  # Remove NULL entries
  plot_data_list <- plot_data_list[!sapply(plot_data_list, is.null)]
  
  if (length(plot_data_list) == 0) {
    cat("  Warning: No valid genes for plotting. Skipping box plots.\n")
    return(NULL)
  }
  
  cat("  Generating", length(plot_data_list), "box plots...\n")
  
  # Create plots (6 per page)
  plots_per_page <- 6
  n_pages <- ceiling(length(plot_data_list) / plots_per_page)
  
  # Open PDF device
  pdf(output_file, width = 12, height = 16)
  
  for (page in seq_len(n_pages)) {
    start_idx <- (page - 1) * plots_per_page + 1
    end_idx <- min(page * plots_per_page, length(plot_data_list))
    page_plots <- plot_data_list[start_idx:end_idx]
    
    plot_list <- list()
    
    for (j in seq_along(page_plots)) {
      plot_info <- page_plots[[j]]
      gene_data <- plot_info$data
      gene_id <- plot_info$gene_id
      subtitle_text <- plot_info$subtitle
      
      # Create box plot
      p <- ggplot(gene_data, aes(x = Group, y = Expression, fill = Group)) +
        geom_boxplot(outlier.shape = NA, alpha = 0.7) +
        geom_jitter(width = 0.2, alpha = 0.5, size = 0.8) +
        scale_fill_manual(values = c("Normal" = "#66C2A5", "Tumor" = "#FC8D62")) +
        labs(
          title = gene_id,
          subtitle = subtitle_text,
          x = "Condition",
          y = "Normalized Expression (log2)"
        ) +
        theme_minimal() +
        theme(
          plot.title = element_text(face = "bold", size = 10),
          plot.subtitle = element_text(size = 8, color = "gray50"),
          axis.title = element_text(size = 9),
          axis.text = element_text(size = 8),
          legend.position = "none",
          panel.grid.major = element_line(color = "gray90"),
          panel.grid.minor = element_blank()
        )
      
      plot_list[[j]] <- p
    }
    
    # Arrange plots on page
    if (length(plot_list) > 0) {
      do.call(grid.arrange, c(plot_list, ncol = 2, nrow = 3))
    }
  }
  
  dev.off()
  
  cat("  Box plots saved to:", output_file, "\n")
  cat("  Total plots:", length(plot_data_list), "\n")
  
  return(invisible(NULL))
}

# ============================================================================
# Function: Create differential expression QC plots
# ============================================================================
create_de_qc_plots <- function(results, fit, expr_matrix, group_factor,
                               logfc_cutoff = 1, p_cutoff = 0.05,
                               output_file = "rna_qc.pdf") {
  cat("\nCreating differential expression QC plots...\n")
  
  # Prepare data for plotting
  plot_data <- results %>%
    mutate(
      neg_log10_pval = -log10(P.Value),
      neg_log10_adj_pval = -log10(adj.P.Val),
      Significant = ifelse(
        abs(logFC) >= logfc_cutoff & adj.P.Val <= p_cutoff,
        "Significant", "Not Significant"
      ),
      Direction = case_when(
        Significant == "Significant" & logFC > 0 ~ "Up",
        Significant == "Significant" & logFC < 0 ~ "Down",
        TRUE ~ "Not Significant"
      )
    )
  
  # Calculate mean expression for MA plot
  mean_expr <- rowMeans(expr_matrix, na.rm = TRUE)
  mean_expr <- mean_expr[plot_data$GeneID]
  plot_data$MeanExpression <- mean_expr
  
  # Open PDF device
  pdf(output_file, width = 12, height = 10)
  
  # ========================================================================
  # Plot 1: Volcano Plot
  # ========================================================================
  cat("  Creating volcano plot...\n")
  
  volcano_plot <- ggplot(plot_data, aes(x = logFC, y = neg_log10_adj_pval, 
                                         color = Direction)) +
    geom_point(alpha = 0.6, size = 1) +
    geom_hline(yintercept = -log10(p_cutoff), linetype = "dashed", 
               color = "gray50", linewidth = 0.8) +
    geom_vline(xintercept = c(-logfc_cutoff, logfc_cutoff), 
               linetype = "dashed", color = "gray50", linewidth = 0.8) +
    scale_color_manual(
      values = c(
        "Up" = "#E31A1C",
        "Down" = "#1F78B4",
        "Not Significant" = "gray70"
      ),
      name = "Direction"
    ) +
    labs(
      title = "Volcano Plot: Tumor vs Normal",
      subtitle = paste0("Significant: |logFC| >= ", logfc_cutoff, 
                       " & adj.P.Val <= ", p_cutoff),
      x = "Log2 Fold Change (Tumor vs Normal)",
      y = "-Log10 Adjusted P-value"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "gray50"),
      axis.title = element_text(size = 11),
      axis.text = element_text(size = 10),
      legend.position = "right",
      panel.grid.major = element_line(color = "gray90"),
      panel.grid.minor = element_blank()
    )
  
  print(volcano_plot)
  
  # ========================================================================
  # Plot 2: MA Plot (Mean Expression vs Log Fold Change)
  # ========================================================================
  cat("  Creating MA plot...\n")
  
  ma_plot <- ggplot(plot_data, aes(x = MeanExpression, y = logFC, 
                                    color = Direction)) +
    geom_point(alpha = 0.6, size = 1) +
    geom_hline(yintercept = 0, linetype = "solid", 
               color = "black", linewidth = 0.5) +
    geom_hline(yintercept = c(-logfc_cutoff, logfc_cutoff), 
               linetype = "dashed", color = "gray50", linewidth = 0.8) +
    scale_color_manual(
      values = c(
        "Up" = "#E31A1C",
        "Down" = "#1F78B4",
        "Not Significant" = "gray70"
      ),
      name = "Direction"
    ) +
    labs(
      title = "MA Plot: Mean Expression vs Log Fold Change",
      subtitle = paste0("Significant: |logFC| >= ", logfc_cutoff, 
                       " & adj.P.Val <= ", p_cutoff),
      x = "Mean Expression (log2)",
      y = "Log2 Fold Change (Tumor vs Normal)"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "gray50"),
      axis.title = element_text(size = 11),
      axis.text = element_text(size = 10),
      legend.position = "right",
      panel.grid.major = element_line(color = "gray90"),
      panel.grid.minor = element_blank()
    )
  
  print(ma_plot)
  
  # ========================================================================
  # Plot 3: P-value Distribution
  # ========================================================================
  cat("  Creating P-value distribution plot...\n")
  
  pval_dist <- ggplot(plot_data, aes(x = P.Value)) +
    geom_histogram(bins = 50, fill = "steelblue", alpha = 0.7, 
                   color = "white", boundary = 0) +
    geom_vline(xintercept = p_cutoff, linetype = "dashed", 
               color = "red", linewidth = 1) +
    labs(
      title = "P-value Distribution",
      subtitle = paste0("Red line indicates cutoff (", p_cutoff, ")"),
      x = "P-value",
      y = "Frequency"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "gray50"),
      axis.title = element_text(size = 11),
      axis.text = element_text(size = 10),
      panel.grid.major = element_line(color = "gray90"),
      panel.grid.minor = element_blank()
    )
  
  print(pval_dist)
  
  # ========================================================================
  # Plot 4: Log Fold Change Distribution
  # ========================================================================
  cat("  Creating LogFC distribution plot...\n")
  
  logfc_dist <- ggplot(plot_data, aes(x = logFC, fill = Direction)) +
    geom_histogram(bins = 50, alpha = 0.7, color = "white") +
    geom_vline(xintercept = 0, linetype = "solid", 
               color = "black", linewidth = 0.8) +
    geom_vline(xintercept = c(-logfc_cutoff, logfc_cutoff), 
               linetype = "dashed", color = "red", linewidth = 1) +
    scale_fill_manual(
      values = c(
        "Up" = "#E31A1C",
        "Down" = "#1F78B4",
        "Not Significant" = "gray70"
      ),
      name = "Direction"
    ) +
    labs(
      title = "Log Fold Change Distribution",
      subtitle = paste0("Red lines indicate cutoff (|logFC| >= ", logfc_cutoff, ")"),
      x = "Log2 Fold Change (Tumor vs Normal)",
      y = "Frequency"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "gray50"),
      axis.title = element_text(size = 11),
      axis.text = element_text(size = 10),
      legend.position = "right",
      panel.grid.major = element_line(color = "gray90"),
      panel.grid.minor = element_blank()
    )
  
  print(logfc_dist)
  
  # ========================================================================
  # Plot 5: Summary Statistics Bar Plot
  # ========================================================================
  cat("  Creating summary statistics plot...\n")
  
  summary_counts <- plot_data %>%
    count(Direction) %>%
    mutate(
      Direction = factor(Direction, 
                        levels = c("Up", "Down", "Not Significant"))
    )
  
  summary_plot <- ggplot(summary_counts, aes(x = Direction, y = n, fill = Direction)) +
    geom_bar(stat = "identity", alpha = 0.8) +
    geom_text(aes(label = n), vjust = -0.5, size = 5, fontface = "bold") +
    scale_fill_manual(
      values = c(
        "Up" = "#E31A1C",
        "Down" = "#1F78B4",
        "Not Significant" = "gray70"
      ),
      guide = "none"
    ) +
    labs(
      title = "Summary of Differentially Expressed Genes",
      subtitle = paste0("Total genes: ", nrow(plot_data), 
                       " | Significant: ", sum(plot_data$Significant == "Significant")),
      x = "Direction",
      y = "Number of Genes"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "gray50"),
      axis.title = element_text(size = 11),
      axis.text = element_text(size = 10),
      panel.grid.major = element_line(color = "gray90"),
      panel.grid.minor = element_blank()
    )
  
  print(summary_plot)
  
  # ========================================================================
  # Plot 6: Mean-Difference Plot (MD Plot)
  # ========================================================================
  cat("  Creating MD plot...\n")
  
  # Calculate mean expression per group
  normal_idx <- which(group_factor == "Normal")
  tumor_idx <- which(group_factor == "Tumor")
  
  mean_normal <- rowMeans(expr_matrix[, normal_idx, drop = FALSE], na.rm = TRUE)
  mean_tumor <- rowMeans(expr_matrix[, tumor_idx, drop = FALSE], na.rm = TRUE)
  
  md_data <- plot_data %>%
    mutate(
      MeanNormal = mean_normal[GeneID],
      MeanTumor = mean_tumor[GeneID],
      MeanExpr = (MeanNormal + MeanTumor) / 2,
      DiffExpr = MeanTumor - MeanNormal
    )
  
  md_plot <- ggplot(md_data, aes(x = MeanExpr, y = DiffExpr, color = Direction)) +
    geom_point(alpha = 0.6, size = 1) +
    geom_hline(yintercept = 0, linetype = "solid", 
               color = "black", linewidth = 0.5) +
    geom_hline(yintercept = c(-logfc_cutoff, logfc_cutoff), 
               linetype = "dashed", color = "gray50", linewidth = 0.8) +
    scale_color_manual(
      values = c(
        "Up" = "#E31A1C",
        "Down" = "#1F78B4",
        "Not Significant" = "gray70"
      ),
      name = "Direction"
    ) +
    labs(
      title = "Mean-Difference Plot",
      subtitle = "Mean expression vs difference between groups",
      x = "Mean Expression (log2)",
      y = "Difference (Tumor - Normal)"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "gray50"),
      axis.title = element_text(size = 11),
      axis.text = element_text(size = 10),
      legend.position = "right",
      panel.grid.major = element_line(color = "gray90"),
      panel.grid.minor = element_blank()
    )
  
  print(md_plot)
  
  dev.off()
  
  cat("  QC plots saved to:", output_file, "\n")
  cat("  Plots created:\n")
  cat("    1. Volcano Plot\n")
  cat("    2. MA Plot\n")
  cat("    3. P-value Distribution\n")
  cat("    4. LogFC Distribution\n")
  cat("    5. Summary Statistics\n")
  cat("    6. Mean-Difference Plot\n")
  
  return(invisible(NULL))
}

# ============================================================================
# Main Analysis Pipeline
# ============================================================================

cat("============================================================================\n")
cat("CPTAC Differential Expression Analysis\n")
cat("Tumor vs Normal (Normal as control)\n")
cat("============================================================================\n")
cat("\n")

has_expression_file <- !is.na(expression_file) && nzchar(expression_file)
has_normal_ids_file <- !is.na(normal_ids_file) && nzchar(normal_ids_file)

if (has_expression_file && !has_normal_ids_file) {
  stop("Argument --normal-ids-file is required when --expression-file is provided.")
}

if (!has_expression_file && has_normal_ids_file) {
  stop("Argument --expression-file is required when --normal-ids-file is provided.")
}

if (has_expression_file && has_normal_ids_file) {
  cat("Loading combined expression matrix:", expression_file, "\n")
  combined_expression <- load_expression_matrix(expression_file)
  normal_sample_ids <- load_sample_ids(normal_ids_file)
  
  if (length(normal_sample_ids) == 0) {
    stop("No normal sample IDs found in --normal-ids-file.")
  }
  
  available_samples <- colnames(combined_expression)
  matched_normals <- intersect(normal_sample_ids, available_samples)
  missing_ids <- setdiff(normal_sample_ids, matched_normals)
  
  cat("Normal sample match summary: matched ", length(matched_normals), " / ",
      length(normal_sample_ids), " requested IDs against ", length(available_samples),
      " total samples.\n", sep = "")
  
  if (length(matched_normals) == 0) {
    stop("No normal sample IDs from --normal-ids-file were found in the expression matrix.")
  }
  
  if (length(missing_ids) > 0) {
    warning(
      "The following normal sample IDs were not found in the expression matrix and will be skipped: ",
      paste(missing_ids, collapse = ", ")
    )
  }
  
  normal_columns <- matched_normals
  tumor_columns <- setdiff(available_samples, normal_columns)
  
  if (length(normal_columns) == 0) {
    stop("No normal samples identified in the combined expression matrix.")
  }
  
  if (length(tumor_columns) == 0) {
    stop("No tumor samples identified in the combined expression matrix.")
  }
  
  normal_matrix <- combined_expression[, normal_columns, drop = FALSE]
  tumor_matrix <- combined_expression[, tumor_columns, drop = FALSE]
  
  cat("Identified", length(normal_columns), "normal samples and", length(tumor_columns),
      "tumor samples from combined expression matrix.\n")
} else {
  # Step 1: Load expression matrices
  normal_matrix <- load_expression_matrix(normal_file)
  tumor_matrix <- load_expression_matrix(tumor_file)
}

# Step 2: Prepare combined matrix
combined_matrix <- prepare_combined_matrix(normal_matrix, tumor_matrix)

# Step 3: Filter low expression genes
combined_matrix <- filter_low_expression(combined_matrix, min_samples = 3)

# Step 4: Create design matrix
normal_n <- ncol(normal_matrix)
tumor_n <- ncol(tumor_matrix)
design_info <- create_design_matrix(normal_n, tumor_n)
design <- design_info$design
group <- design_info$group

# Step 5: Prepare normalized expression matrix for plotting
# Check if data needs log transformation (same logic as in perform_limma_analysis)
if (median(combined_matrix, na.rm = TRUE) > 20) {
  expr_normalized <- combined_matrix
} else {
  expr_normalized <- log2(combined_matrix + 1)
}

# Step 6: Perform limma analysis
fit <- perform_limma_analysis(combined_matrix, design)

# Step 7: Extract results (with median expression per condition)
results <- extract_results(fit, 
                          expr_matrix = expr_normalized,
                          group_factor = group,
                          coef = "Tumor_vs_Normal", 
                          adjust_method = "fdr",
                          p_cutoff = 0.05,
                          logfc_cutoff = 1)

# Step 8: Create summary statistics
summary_stats <- create_summary_stats(normal_n, tumor_n, results)

# Step 9: Get top DEGs prioritized by higher expression in tumor vs normal
# (Up-regulated genes, sorted by adjusted p-value, then by logFC)
cat("\nSelecting top DEGs (prioritizing higher expression in tumor)...\n")
top_degs <- results %>%
  filter(Significant == "Yes", Direction == "Up") %>%  # Only up-regulated genes
  arrange(adj.P.Val, desc(logFC)) %>%  # Sort by p-value, then by logFC (descending)
  head(100)  # Top 100 up-regulated DEGs

if (nrow(top_degs) == 0) {
  cat("  Warning: No up-regulated DEGs found. Using all significant DEGs instead.\n")
  top_degs <- results %>%
    filter(Significant == "Yes") %>%
    arrange(adj.P.Val) %>%
    head(100)
}

cat("  Selected", nrow(top_degs), "top DEGs (higher expression in tumor)\n")
cat("\nTop 10 differentially expressed genes (higher in tumor):\n")
print(head(top_degs[, c("GeneID", "logFC", "MedianExpression_Normal", 
                        "MedianExpression_Tumor", "P.Value", "adj.P.Val", "Direction")], 10))

# ============================================================================
# Write Output Files
# ============================================================================

cat("\n============================================================================\n")
cat("Writing output files...\n")
cat("============================================================================\n")

# Write CSV file
cat("  Writing CSV:", output_csv, "\n")
write_csv(results, output_csv)

# Prepare Excel workbook with multiple sheets
excel_data <- list(
  "Sample_Counts" = summary_stats$sample_counts,
  "DEG_Statistics" = summary_stats$deg_stats,
  "All_Results" = results,
  "Top_DEGs" = top_degs
)

cat("  Writing Excel:", output_excel, "\n")
write_xlsx(excel_data, output_excel)

# Save RDS file with all results objects
cat("  Writing RDS:", output_rds, "\n")
saveRDS(list(
  fit = fit,
  results = results,
  top_degs = top_degs,
  expr_normalized = expr_normalized,
  design = design,
  group = group,
  summary_stats = summary_stats
), file = output_rds)

# Create box plots for top 30 DEGs (prioritizing higher expression in tumor)
cat("  Creating box plots for top ", top_deg_count, " DEGs (higher expression in tumor)...\n", sep = "")
create_degs_boxplots(
  expr_matrix = expr_normalized,
  group_factor = group,
  top_degs = top_degs,
  n_genes = top_deg_count,
  output_file = output_pdf,
  title_prefix = paste0("Top ", top_deg_count, " DEGs (Higher Expression in Tumor)")
)

# Create QC plots (volcano plot and other QC visualizations)
create_de_qc_plots(
  results = results,
  fit = fit,
  expr_matrix = expr_normalized,
  group_factor = group,
  logfc_cutoff = 1,
  p_cutoff = 0.05,
  output_file = output_qc_pdf
)

cat("\nAnalysis complete!\n")
cat("Output files:\n")
cat("  -", output_csv, "\n")
cat("  -", output_excel, "\n")
cat("  -", output_rds, "\n")
cat("  -", output_pdf, "\n")
cat("  -", output_qc_pdf, "\n")
cat("\n")

