#!/usr/bin/env Rscript
#
# Helper script to generate DESeq2 analysis reports
# This script renders the R Markdown report with different parameters
#

library(rmarkdown)

# Configuration
RDS_PATH <- "/Users/zayed/Downloads/ai_apps/targetminer_pairviewer/HNSC_tcga.counts.RDS"
SAMPLE_DEFS_PATH <- "/Users/zayed/Downloads/ai_apps/rubricrunner/HNSC_sample_definitions.tsv"
OUTPUT_DIR <- "/Users/zayed/Downloads/ai_apps/rubricrunner/deseq2_results"
RMD_FILE <- "deseq2_contrast_report.Rmd"

# Default configuration for ExpressionSet-only workflows
DEFAULT_ESET_PARAMS <- list(
  comparison_name = "COAD_MSS_Tumor_vs_Normal",
  anatomical_site = NULL,
  hpv_status = NULL,
  enforce_hpv_status = FALSE,
  padj_threshold = 0.05,
  lfc_threshold = 1.0,
  top_n_genes = 50,
  rds_path = "/Users/zayed/Downloads/ai_apps/rubricrunner/COAD_MSS.counts.RDS",
  sample_defs_path = NULL,
  output_dir = OUTPUT_DIR,
  sample_type_column = "definition",
  tumor_sample_type = "Primary solid Tumor",
  normal_sample_type = "Solid Tissue Normal",
  min_total_count = 10,
  metadata_columns = c("barcode", "patient", "sample_type", "shortLetterCode", "tissue_type")
)

# Create output directory if needed
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
}

#' Generate a DESeq2 analysis report
#'
#' @param comparison_name Name of the comparison (used in output filename)
#' @param anatomical_site Anatomical site to filter (NULL = all sites)
#' @param hpv_status HPV status to filter (NULL = all statuses, "Positive", "Negative")
#' @param enforce_hpv_status If TRUE, exclude "No Test" samples (default: TRUE)
#' @param padj_threshold Adjusted p-value threshold (default: 0.05)
#' @param lfc_threshold Log2 fold change threshold for classification (default: 1.0)
#' @param top_n_genes Number of top genes to show in heatmap (default: 50)
#' @return Path to generated HTML report
generate_report <- function(comparison_name,
                           anatomical_site = NULL,
                           hpv_status = NULL,
                           enforce_hpv_status = TRUE,
                           padj_threshold = 0.05,
                           lfc_threshold = 1.0,
                           top_n_genes = 50) {
  
  message("\n========================================")
  message("Generating report: ", comparison_name)
  message("========================================")
  
  # Output file name
  output_file <- file.path(
    OUTPUT_DIR, 
    paste0(comparison_name, "_report.html")
  )
  
  # Render the R Markdown document
  render(
    input = RMD_FILE,
    output_file = output_file,
    params = list(
      comparison_name = comparison_name,
      anatomical_site = anatomical_site,
      hpv_status = hpv_status,
      enforce_hpv_status = enforce_hpv_status,
      rds_path = RDS_PATH,
      sample_defs_path = SAMPLE_DEFS_PATH,
      output_dir = OUTPUT_DIR,
      padj_threshold = padj_threshold,
      lfc_threshold = lfc_threshold,
      top_n_genes = top_n_genes,
      sample_type_column = "sample_type",
      tumor_sample_type = "Primary Tumor",
      normal_sample_type = "Solid Tissue Normal",
      min_total_count = 10,
      metadata_columns = c("barcode", "patient", "sample_type", "shortLetterCode", "tissue_type")
    ),
    quiet = FALSE
  )
  
  message("Report generated: ", output_file)
  return(output_file)
}

#' Generate all three standard comparison reports
generate_all_reports <- function() {
  
  message("\n===========================================")
  message("Generating All DESeq2 Analysis Reports")
  message("===========================================\n")
  
  reports <- list()
  
  # Report 1: HPV Negative - Tumor vs Normal (all anatomical sites)
  reports$hpv_negative <- generate_report(
    comparison_name = "HPV_Negative_Tumor_vs_Normal",
    anatomical_site = NULL,
    hpv_status = "Negative",
    enforce_hpv_status = TRUE,
    padj_threshold = 0.05,
    lfc_threshold = 1.0,
    top_n_genes = 50
  )
  
  # Report 2: Oral Cavity HPV Negative - Tumor vs Normal
  reports$oral_cavity_hpv_neg <- generate_report(
    comparison_name = "Oral_Cavity_HPV_Negative_Tumor_vs_Normal",
    anatomical_site = "oral cavity",
    hpv_status = "Negative",
    enforce_hpv_status = TRUE,
    padj_threshold = 0.05,
    lfc_threshold = 1.0,
    top_n_genes = 50
  )
  
  # Report 3: Laryngeal HPV Negative - Tumor vs Normal
  reports$laryngeal_hpv_neg <- generate_report(
    comparison_name = "Laryngeal_HPV_Negative_Tumor_vs_Normal",
    anatomical_site = "laryngeal",
    hpv_status = "Negative",
    enforce_hpv_status = TRUE,
    padj_threshold = 0.05,
    lfc_threshold = 1.0,
    top_n_genes = 50
  )
  
  message("\n===========================================")
  message("All Reports Generated!")
  message("===========================================")
  message("Output directory: ", OUTPUT_DIR)
  
  return(reports)
}

#' Generate a DESeq2 report directly from an ExpressionSet/SummarizedExperiment
#'
#' @param overrides Named list to override defaults in DEFAULT_ESET_PARAMS
#' @return List with `output_file` and the resolved parameter set
generate_expression_set_report <- function(overrides = list()) {
  
  report_params <- utils::modifyList(DEFAULT_ESET_PARAMS, overrides)
  
  if (is.null(report_params$output_dir) || !nzchar(report_params$output_dir)) {
    report_params$output_dir <- OUTPUT_DIR
  }
  
  if (!dir.exists(report_params$output_dir)) {
    dir.create(report_params$output_dir, recursive = TRUE)
  }
  
  output_file <- file.path(
    report_params$output_dir,
    paste0(report_params$comparison_name, "_report.html")
  )
  
  message("\n========================================")
  message("Generating ExpressionSet report: ", report_params$comparison_name)
  message("RDS path: ", report_params$rds_path)
  message("Output: ", output_file)
  message("========================================")
  
  render(
    input = RMD_FILE,
    output_file = output_file,
    params = report_params,
    quiet = FALSE
  )
  
  list(
    output_file = output_file,
    params = report_params
  )
}

# =============================================================================
# EXAMPLE USAGE
# =============================================================================

# Example 1: Generate all three standard HPV negative reports
# reports <- generate_all_reports()

# Example 2: Generate HPV Negative report (all anatomical sites)
# report <- generate_report(
#   comparison_name = "HPV_Negative_Tumor_vs_Normal",
#   anatomical_site = NULL,
#   hpv_status = "Negative",
#   enforce_hpv_status = TRUE
# )

# Example 3: Generate HPV Positive report (all anatomical sites)
# report <- generate_report(
#   comparison_name = "HPV_Positive_Tumor_vs_Normal",
#   anatomical_site = NULL,
#   hpv_status = "Positive",
#   enforce_hpv_status = TRUE
# )

# Example 4: Generate Oropharynx HPV Positive report
# report <- generate_report(
#   comparison_name = "Oropharynx_HPV_Positive_Tumor_vs_Normal",
#   anatomical_site = "oropharynx",
#   hpv_status = "Positive",
#   enforce_hpv_status = TRUE
# )

# Example 5: Generate Oral Cavity HPV Positive report
# report <- generate_report(
#   comparison_name = "Oral_Cavity_HPV_Positive_Tumor_vs_Normal",
#   anatomical_site = "oral cavity",
#   hpv_status = "Positive",
#   enforce_hpv_status = TRUE
# )

# Example 6: Generate report with custom thresholds
# report <- generate_report(
#   comparison_name = "Laryngeal_HPV_Negative_Strict",
#   anatomical_site = "laryngeal",
#   hpv_status = "Negative",
#   enforce_hpv_status = TRUE,
#   padj_threshold = 0.01,
#   lfc_threshold = 2.0,
#   top_n_genes = 100
# )

# Example 7: Allow "No Test" samples (not recommended)
# report <- generate_report(
#   comparison_name = "Oral_Cavity_All_HPV_Statuses",
#   anatomical_site = "oral cavity",
#   hpv_status = NULL,
#   enforce_hpv_status = FALSE  # Include "No Test" samples
# )

# Example 8: Run ExpressionSet-only COAD MSS analysis
# coad_report <- generate_expression_set_report()
# coad_strict <- generate_expression_set_report(list(
#   comparison_name = "COAD_MSS_Tumor_vs_Normal_Strict",
#   padj_threshold = 0.01,
#   lfc_threshold = 1.5,
#   top_n_genes = 100
# ))

# =============================================================================
# INTERACTIVE MODE
# =============================================================================

if (interactive()) {
  message("\n===========================================")
  message("DESeq2 Report Generator - Interactive Mode")
  message("===========================================\n")
  message("Available functions:")
  message("  - generate_all_reports()          : Generate all three standard reports")
  message("  - generate_report(...)            : Generate a custom report")
  message("  - generate_expression_set_report(): Render directly from ExpressionSet metadata")
  message("\nExamples:")
  message("  reports <- generate_all_reports()")
  message("  report <- generate_report('HPV_Negative_Tumor_vs_Normal', hpv_status='Negative')")
  message("  coad   <- generate_expression_set_report(list(rds_path='COAD_MSS.counts.RDS'))")
  message("\nOutput directory: ", OUTPUT_DIR)
} else {
  args <- commandArgs(trailingOnly = TRUE)
  mode <- if (length(args) > 0) args[1] else "hnsc"
  
  if (tolower(mode) == "expression_set") {
    reports <- generate_expression_set_report()
  } else {
    reports <- generate_all_reports()
  }
}

