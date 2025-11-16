# Rubric Data Validation Functions
# Purpose: Validate data objects against rubric rulesets before running analysis

library(dplyr)
library(tibble)
library(stringr)

#' Extract column references from varList glue strings
#'
#' @param var_list_string A glue string containing column references (e.g., "list(x=e$gene_table$column_name)")
#' @return A character vector of column names referenced in the varList
#' @examples
#' extract_columns_from_varlist("list(x=e$gene_table$tcga_luad_corr)")
#' # Returns: "tcga_luad_corr"
extract_columns_from_varlist <- function(var_list_string) {
  # Pattern to match e$gene_table$column_name or similar references
  pattern <- "e\\$gene_table\\$([a-zA-Z0-9_]+)"
  
  # Extract all matches
  matches <- str_match_all(var_list_string, pattern)
  
  # Get unique column names (second column contains the captured group)
  if (length(matches[[1]]) > 0) {
    columns <- unique(matches[[1]][, 2])
    return(columns)
  } else {
    return(character(0))
  }
}


#' Validate a single rule against the data
#'
#' @param rule_row A single row from the ruleset tibble
#' @param data_columns Character vector of available column names in the data
#' @return A list with validation results
validate_single_rule <- function(rule_row, data_columns) {
  rule_name <- rule_row$name
  var_list_string <- as.character(rule_row$varList)
  
  # Extract required columns from varList
  required_columns <- extract_columns_from_varlist(var_list_string)
  
  # Check which columns are missing
  missing_columns <- setdiff(required_columns, data_columns)
  present_columns <- intersect(required_columns, data_columns)
  
  # Determine status
  is_valid <- length(missing_columns) == 0
  
  return(list(
    rule_name = rule_name,
    required_columns = required_columns,
    present_columns = present_columns,
    missing_columns = missing_columns,
    is_valid = is_valid,
    n_required = length(required_columns),
    n_missing = length(missing_columns)
  ))
}


#' Validate all rules in a ruleset against data
#'
#' @param ruleset A tibble containing rules with name, rulesetDesc, ruleset, and varList columns
#' @param data A data frame or tibble containing the gene table data
#' @return A tibble with validation results for each rule
#' @export
validate_ruleset_against_data <- function(ruleset, data) {
  # Get column names from data
  data_columns <- colnames(data)
  
  # Validate each rule
  validation_results <- lapply(1:nrow(ruleset), function(i) {
    validate_single_rule(ruleset[i, ], data_columns)
  })
  
  # Convert to tibble for better display
  results_df <- tibble(
    rule_name = sapply(validation_results, function(x) x$rule_name),
    n_required_columns = sapply(validation_results, function(x) x$n_required),
    n_missing_columns = sapply(validation_results, function(x) x$n_missing),
    is_valid = sapply(validation_results, function(x) x$is_valid),
    required_columns = sapply(validation_results, function(x) paste(x$required_columns, collapse=", ")),
    missing_columns = sapply(validation_results, function(x) {
      if (length(x$missing_columns) > 0) {
        paste(x$missing_columns, collapse=", ")
      } else {
        ""
      }
    })
  )
  
  return(results_df)
}


#' Check data quality for columns used in rules
#'
#' @param data A data frame or tibble containing the gene table data
#' @param columns Character vector of column names to check
#' @return A tibble with data quality metrics
check_data_quality <- function(data, columns) {
  quality_results <- lapply(columns, function(col) {
    if (col %in% colnames(data)) {
      col_data <- data[[col]]
      
      list(
        column_name = col,
        exists = TRUE,
        data_type = class(col_data)[1],
        n_total = length(col_data),
        n_na = sum(is.na(col_data)),
        n_null = sum(is.null(col_data)),
        pct_missing = round(sum(is.na(col_data)) / length(col_data) * 100, 2),
        has_values = sum(!is.na(col_data)) > 0
      )
    } else {
      list(
        column_name = col,
        exists = FALSE,
        data_type = NA,
        n_total = NA,
        n_na = NA,
        n_null = NA,
        pct_missing = NA,
        has_values = FALSE
      )
    }
  })
  
  # Convert to tibble
  tibble::as_tibble(do.call(rbind.data.frame, quality_results))
}


#' Generate a comprehensive validation report
#'
#' @param ruleset A tibble containing rules
#' @param data A data frame or tibble containing the gene table data
#' @param include_quality_check Logical, whether to include data quality checks
#' @return A list containing validation results and summary statistics
#' @export
generate_validation_report <- function(ruleset, data, include_quality_check = TRUE) {
  cat("=" %>% rep(80) %>% paste(collapse=""), "\n")
  cat("RUBRIC DATA VALIDATION REPORT\n")
  cat("=" %>% rep(80) %>% paste(collapse=""), "\n\n")
  
  # Basic info
  cat("Dataset Information:\n")
  cat(sprintf("  - Data dimensions: %d rows x %d columns\n", nrow(data), ncol(data)))
  cat(sprintf("  - Number of rules: %d\n\n", nrow(ruleset)))
  
  # Validate ruleset
  validation_results <- validate_ruleset_against_data(ruleset, data)
  
  # Summary statistics
  n_valid_rules <- sum(validation_results$is_valid)
  n_invalid_rules <- sum(!validation_results$is_valid)
  
  cat("Validation Summary:\n")
  cat(sprintf("  - Valid rules: %d (%.1f%%)\n", 
              n_valid_rules, 
              n_valid_rules/nrow(ruleset)*100))
  cat(sprintf("  - Invalid rules: %d (%.1f%%)\n\n", 
              n_invalid_rules, 
              n_invalid_rules/nrow(ruleset)*100))
  
  # Report invalid rules
  if (n_invalid_rules > 0) {
    cat("INVALID RULES (Missing Required Columns):\n")
    cat("-" %>% rep(80) %>% paste(collapse=""), "\n")
    
    invalid_rules <- validation_results %>% filter(!is_valid)
    
    for (i in 1:nrow(invalid_rules)) {
      cat(sprintf("\n[%d] Rule: %s\n", i, invalid_rules$rule_name[i]))
      cat(sprintf("    Missing columns (%d): %s\n", 
                  invalid_rules$n_missing_columns[i],
                  invalid_rules$missing_columns[i]))
      cat(sprintf("    Required columns: %s\n", invalid_rules$required_columns[i]))
    }
    cat("\n")
  } else {
    cat("✓ All rules have valid column references!\n\n")
  }
  
  # Data quality check
  if (include_quality_check) {
    # Get all unique columns referenced in rules
    all_required_columns <- unique(unlist(lapply(1:nrow(ruleset), function(i) {
      extract_columns_from_varlist(as.character(ruleset$varList[i]))
    })))
    
    # Filter to existing columns only
    existing_columns <- intersect(all_required_columns, colnames(data))
    
    if (length(existing_columns) > 0) {
      cat("Data Quality Check (for columns used in rules):\n")
      cat("-" %>% rep(80) %>% paste(collapse=""), "\n")
      
      quality_results <- check_data_quality(data, existing_columns)
      
      # Find columns with high missing rates
      high_missing <- quality_results %>% 
        filter(exists == TRUE, pct_missing > 50)
      
      if (nrow(high_missing) > 0) {
        cat("\n⚠ WARNING: Columns with >50% missing values:\n")
        for (i in 1:nrow(high_missing)) {
          cat(sprintf("  - %s: %.1f%% missing (%d/%d values)\n",
                      high_missing$column_name[i],
                      high_missing$pct_missing[i],
                      as.numeric(high_missing$n_na[i]),
                      as.numeric(high_missing$n_total[i])))
        }
        cat("\n")
      }
      
      # Find columns with no values
      no_values <- quality_results %>% 
        filter(exists == TRUE, n_na == n_total)
      
      if (nrow(no_values) > 0) {
        cat("\n⚠ WARNING: Columns with ALL missing values (completely empty):\n")
        for (i in 1:nrow(no_values)) {
          cat(sprintf("  - %s\n", no_values$column_name[i]))
        }
        cat("\n")
      }
      
      # Summary statistics
      cat("\nData Quality Summary:\n")
      cat(sprintf("  - Columns checked: %d\n", nrow(quality_results)))
      cat(sprintf("  - Columns with >50%% missing: %d\n", nrow(high_missing)))
      cat(sprintf("  - Completely empty columns: %d\n", nrow(no_values)))
      cat(sprintf("  - Average missing rate: %.1f%%\n", 
                  mean(as.numeric(quality_results$pct_missing[quality_results$exists == TRUE]), na.rm=TRUE)))
    }
  }
  
  cat("\n")
  cat("=" %>% rep(80) %>% paste(collapse=""), "\n")
  
  # Return results invisibly
  invisible(list(
    validation_results = validation_results,
    summary = list(
      n_rules = nrow(ruleset),
      n_valid = n_valid_rules,
      n_invalid = n_invalid_rules,
      validation_passed = n_invalid_rules == 0
    ),
    data_info = list(
      n_rows = nrow(data),
      n_cols = ncol(data),
      column_names = colnames(data)
    )
  ))
}


#' Quick validation check (returns TRUE/FALSE)
#'
#' @param ruleset A tibble containing rules
#' @param data A data frame or tibble containing the gene table data
#' @return Logical, TRUE if all validations pass
#' @export
validate_quick <- function(ruleset, data) {
  validation_results <- validate_ruleset_against_data(ruleset, data)
  all(validation_results$is_valid)
}


# Example usage function
#' @examples
#' # Load your data
#' smdat <- readRDS("smdat.RDS")
#' 
#' # Generate full validation report
#' report <- generate_validation_report(
#'   ruleset = smdat$sample_ruleset, 
#'   data = smdat$sample_data
#' )
#' 
#' # Quick check (returns TRUE/FALSE)
#' is_valid <- validate_quick(
#'   ruleset = smdat$sample_ruleset,
#'   data = smdat$sample_data
#' )
#' 
#' # Stop execution if validation fails
#' if (!is_valid) {
#'   stop("Data validation failed! Please check the validation report.")
#' }

