# Test Script for Rubric Data Validation
# This script demonstrates how to use the validation functions

# Source the validation functions
source("validate_rubric_data.R")

# Load the example data
cat("Loading example data from smdat.RDS...\n\n")
smdat <- readRDS("smdat.RDS")

# Run the comprehensive validation report
cat("Running comprehensive validation...\n\n")
report <- generate_validation_report(
  ruleset = smdat$sample_ruleset,
  data = smdat$sample_data,
  include_quality_check = TRUE
)

# Access the results programmatically
cat("\n\nProgrammatic Access to Results:\n")
cat("================================\n")
cat(sprintf("Total rules: %d\n", report$summary$n_rules))
cat(sprintf("Valid rules: %d\n", report$summary$n_valid))
cat(sprintf("Invalid rules: %d\n", report$summary$n_invalid))
cat(sprintf("Overall validation passed: %s\n\n", report$summary$validation_passed))

# Quick validation check
cat("Quick validation check result: ")
is_valid <- validate_quick(smdat$sample_ruleset, smdat$sample_data)
cat(sprintf("%s\n\n", ifelse(is_valid, "PASS ✓", "FAIL ✗")))

# Display validation results table
cat("Detailed Validation Results Table:\n")
cat("==================================\n")
print(report$validation_results)

cat("\n\nTest completed successfully!\n")

