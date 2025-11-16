#!/usr/bin/env Rscript
#' Setup Script for TCGA-GTEx Heatmap Shiny Application
#' 
#' This script helps set up the application by:
#' 1. Checking for required packages
#' 2. Creating necessary directories
#' 3. Verifying data files
#' 4. Testing the application setup

cat("=", rep("=", 70), "\n", sep = "")
cat("TCGA-GTEx Heatmap Shiny Application - Setup\n")
cat("=", rep("=", 70), "\n\n")

# Check required packages
cat("Checking required packages...\n")
required_packages <- c(
  "shiny", "bslib", "bsicons", "DT", "shinyjs", 
  "shinyWidgets", "shinyFeedback", "ComplexHeatmap", 
  "circlize", "readxl", "dplyr", "tidyr", "httr", 
  "jsonlite", "grid", "gridExtra", "RColorBrewer", 
  "readr", "stringr", "ggplot2", "optparse"
)

missing_packages <- c()
for (pkg in required_packages) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    missing_packages <- c(missing_packages, pkg)
    cat("  ✗", pkg, "- MISSING\n")
  } else {
    cat("  ✓", pkg, "- installed\n")
  }
}

if (length(missing_packages) > 0) {
  cat("\nMissing packages detected. Install with:\n")
  cat("install.packages(c(", 
      paste0('"', missing_packages, '"', collapse = ", "), 
      "))\n\n")
  cat("For ComplexHeatmap, you may need:\n")
  cat("if (!requireNamespace('BiocManager', quietly = TRUE)) install.packages('BiocManager')\n")
  cat("BiocManager::install('ComplexHeatmap')\n\n")
} else {
  cat("\n✓ All required packages are installed!\n\n")
}

# Create directories
cat("Creating directories...\n")
dirs_to_create <- c("data", "output", "tcga_cache", "output/previews", "R", "documentation")
for (dir in dirs_to_create) {
  if (!dir.exists(dir)) {
    dir.create(dir, recursive = TRUE)
    cat("  ✓ Created:", dir, "\n")
  } else {
    cat("  ✓ Exists:", dir, "\n")
  }
}

# Check for data files
cat("\nChecking data files...\n")
data_files <- list(
  "gtex_data_in.medians.tsv" = "GTEx median expression file (REQUIRED)",
  "tcga_log2data.RDS" = "TCGA RDS file (optional, but recommended)",
  "gene_annotation.tsv" = "Gene annotation file (optional)",
  "synonyms.txt" = "Gene synonyms file (optional)"
)

for (file in names(data_files)) {
  filepath <- file.path("data", file)
  if (file.exists(filepath)) {
    cat("  ✓", file, "- found\n")
  } else {
    cat("  ✗", file, "- NOT FOUND (", data_files[[file]], ")\n")
  }
}

# Check for main heatmap script
cat("\nChecking for main heatmap script...\n")
heatmap_script_paths <- c(
  "../tcga_gtex_heatmap.R",
  "tcga_gtex_heatmap.R",
  "../../tcga_gtex_heatmap.R"
)

found_script <- FALSE
for (path in heatmap_script_paths) {
  if (file.exists(path)) {
    cat("  ✓ Found:", path, "\n")
    found_script <- TRUE
    break
  }
}

if (!found_script) {
  cat("  ✗ tcga_gtex_heatmap.R not found in expected locations\n")
  cat("    Please ensure tcga_gtex_heatmap.R is accessible\n")
}

# Check for config file
cat("\nChecking configuration...\n")
if (file.exists("config.yaml")) {
  cat("  ✓ config.yaml found\n")
} else {
  cat("  ℹ config.yaml not found (using defaults)\n")
  cat("    Copy config.yaml.example to config.yaml to customize\n")
}

# Summary
cat("\n", rep("=", 70), "\n", sep = "")
cat("Setup Summary\n")
cat(rep("=", 70), "\n")

if (length(missing_packages) == 0 && found_script) {
  cat("\n✓ Setup complete! You can now run the application:\n\n")
  cat("  shiny::runApp('app.R')\n\n")
} else {
  cat("\n⚠ Setup incomplete. Please address the issues above.\n\n")
}

cat("For more information, see:\n")
cat("  - README.md\n")
cat("  - documentation/user_guide.md\n\n")

