#!/usr/bin/env Rscript
#
# Example: Generate a single DESeq2 analysis report
#
# This is a simple example showing how to generate one report
# Modify the parameters below to customize your analysis
#

library(rmarkdown)

# =============================================================================
# CONFIGURATION - MODIFY THESE PARAMETERS
# =============================================================================

# 1. Choose your comparison name (used in output filename)
COMPARISON_NAME <- "HPV_Negative_Tumor_vs_Normal"

# 2. Filter by anatomical site (or NULL for all sites)
#    Options: NULL, "oral cavity", "laryngeal", "oropharynx"
ANATOMICAL_SITE <- NULL

# 3. Filter by HPV status (or NULL for all statuses)
#    Options: NULL, "Positive", "Negative", "No Test"
HPV_STATUS <- "Negative"

# 4. Adjusted p-value threshold for significance
PADJ_THRESHOLD <- 0.05

# 5. Log2 fold change threshold for classification
LFC_THRESHOLD <- 1.0

# 6. Number of top genes to show in heatmap
TOP_N_GENES <- 50

# =============================================================================
# FILE PATHS - UPDATE IF YOUR FILES ARE IN DIFFERENT LOCATIONS
# =============================================================================

RDS_PATH <- "/Users/zayed/Downloads/ai_apps/targetminer_pairviewer/HNSC_tcga.counts.RDS"
SAMPLE_DEFS_PATH <- "/Users/zayed/Downloads/ai_apps/rubricrunner/HNSC_sample_definitions.tsv"
OUTPUT_DIR <- "/Users/zayed/Downloads/ai_apps/rubricrunner/deseq2_results"
RMD_FILE <- "deseq2_contrast_report.Rmd"

# =============================================================================
# GENERATE REPORT
# =============================================================================

# Create output directory if needed
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
}

# Output file path
output_file <- file.path(OUTPUT_DIR, paste0(COMPARISON_NAME, "_report.html"))

# Print analysis parameters
cat("\n========================================\n")
cat("DESeq2 Analysis Report\n")
cat("========================================\n")
cat("Comparison Name:", COMPARISON_NAME, "\n")
cat("Anatomical Site:", if(is.null(ANATOMICAL_SITE)) "All sites" else ANATOMICAL_SITE, "\n")
cat("HPV Status:", if(is.null(HPV_STATUS)) "All statuses" else HPV_STATUS, "\n")
cat("Padj Threshold:", PADJ_THRESHOLD, "\n")
cat("Log2FC Threshold:", LFC_THRESHOLD, "\n")
cat("Top N Genes:", TOP_N_GENES, "\n")
cat("Output:", output_file, "\n")
cat("========================================\n\n")

# Render the R Markdown report
cat("Rendering report...\n")
render(
  input = RMD_FILE,
  output_file = output_file,
  params = list(
    comparison_name = COMPARISON_NAME,
    anatomical_site = ANATOMICAL_SITE,
    hpv_status = HPV_STATUS,
    rds_path = RDS_PATH,
    sample_defs_path = SAMPLE_DEFS_PATH,
    padj_threshold = PADJ_THRESHOLD,
    lfc_threshold = LFC_THRESHOLD,
    top_n_genes = TOP_N_GENES
  ),
  quiet = FALSE
)

cat("\n========================================\n")
cat("Report Generated Successfully!\n")
cat("========================================\n")
cat("Location:", output_file, "\n")
cat("\nTo view the report, open it in your web browser or run:\n")
cat("  browseURL('", output_file, "')\n", sep = "")
cat("========================================\n\n")

# Optionally open the report automatically (uncomment next line)
# browseURL(output_file)

