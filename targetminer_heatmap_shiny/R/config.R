#' Configuration Management
#' 
#' Handles application configuration including data paths and default settings

#' Load application configuration
#' @return List with configuration settings
load_app_config <- function() {
  # Get app directory
  app_dir <- getwd()
  if (basename(app_dir) != "targetminer_heatmap_shiny") {
    if (file.exists("app.R")) {
      app_dir <- getwd()
    } else if (file.exists("targetminer_heatmap_shiny/app.R")) {
      app_dir <- file.path(getwd(), "targetminer_heatmap_shiny")
    }
  }
  
  # Default configuration
  config <- list(
    # Data directory paths (relative to app_dir)
    data_dir = file.path(app_dir, "data"),
    gtex_file = file.path(app_dir, "data", "gtex_data_in.medians.tsv"),
    tcga_rds_file = file.path(app_dir, "data", "tcga_log2data.RDS"),
    # Also check for medians file
    tcga_medians_file = file.path(app_dir, "data", "tcga_medians.RDS"),
    synonyms_file = file.path(app_dir, "data", "synonyms.txt"),
    gene_annotation_file = file.path(app_dir, "data", "gene_annotation.tsv"),
    
    # Output directory
    output_dir = file.path(app_dir, "output"),
    cache_dir = file.path(app_dir, "tcga_cache"),
    
    # Default parameters
    default_topn = 35,
    default_width = 20,
    default_height = 12,
    default_delay = 0.5,
    
    # TCGA cohorts
    tcga_cohorts = c("ACC", "BLCA", "BRCA", "CESC", "CHOL", "COAD", 
                     "COADREAD", "DLBC", "ESCA", "FPPP", "GBM", "GBMLGG",
                     "HNSC", "KICH", "KIPAN", "KIRC", "KIRP", "LAML", 
                     "LGG", "LIHC", "LUAD", "LUSC", "MESO", "OV", 
                     "PAAD", "PCPG", "PRAD", "READ", "SARC", "SKCM",
                     "STAD", "STES", "TGCT", "THCA", "THYM", "UCEC", 
                     "UCS", "UVM")
  )
  
  # Try to load from config file if it exists
  config_file <- file.path(app_dir, "config.yaml")
  if (file.exists(config_file)) {
    tryCatch({
      if (requireNamespace("yaml", quietly = TRUE)) {
        file_config <- yaml::read_yaml(config_file)
        # Handle list merging properly
        if (is.list(file_config)) {
          # Convert relative paths to absolute
          if (!is.null(file_config$data_dir) && 
              !startsWith(file_config$data_dir, "/") && 
              !grepl("^[A-Za-z]:", file_config$data_dir)) {
            file_config$data_dir <- file.path(app_dir, file_config$data_dir)
          }
          if (!is.null(file_config$output_dir) && 
              !startsWith(file_config$output_dir, "/") && 
              !grepl("^[A-Za-z]:", file_config$output_dir)) {
            file_config$output_dir <- file.path(app_dir, file_config$output_dir)
          }
          if (!is.null(file_config$cache_dir) && 
              !startsWith(file_config$cache_dir, "/") && 
              !grepl("^[A-Za-z]:", file_config$cache_dir)) {
            file_config$cache_dir <- file.path(app_dir, file_config$cache_dir)
          }
          config <- modifyList(config, file_config)
        }
      }
    }, error = function(e) {
      warning("Failed to load config.yaml: ", e$message)
    })
  }
  
  # Ensure output directory exists
  if (!dir.exists(config$output_dir)) {
    dir.create(config$output_dir, recursive = TRUE)
  }
  
  # Ensure cache directory exists
  if (!dir.exists(config$cache_dir)) {
    dir.create(config$cache_dir, recursive = TRUE)
  }
  
  # Check for TCGA medians file (preferred) - check multiple possible names
  tcga_medians_candidates <- c(
    file.path(app_dir, "data", "tcga_medians.RDS"),
    file.path(app_dir, "data", "tcga_medians.rds"),
    file.path(app_dir, "data", "tcga_log2data.RDS"),
    file.path(app_dir, "data", "tcga_log2data.rds")
  )
  
  tcga_file_found <- NULL
  for (candidate in tcga_medians_candidates) {
    if (file.exists(candidate)) {
      tcga_file_found <- candidate
      break
    }
  }
  
  if (!is.null(tcga_file_found)) {
    # Use found file
    config$tcga_rds_file <- tcga_file_found
  } else {
    # Warn if no file found
    warning("No TCGA RDS file found. Will use API instead.")
  }
  
  # Validate default data files exist (warn if not)
  if (!is.null(config$gtex_file) && !file.exists(config$gtex_file)) {
    warning("GTEx file not found at default location: ", config$gtex_file)
  }
  
  return(config)
}

#' Get full path for a data file
#' @param filename Filename relative to data directory
#' @param config Configuration list
#' @return Full path to file
get_data_path <- function(filename, config) {
  if (is.null(filename) || filename == "") {
    return(NULL)
  }
  
  # If absolute path, return as-is
  if (substr(filename, 1, 1) == "/" || grepl("^[A-Za-z]:", filename)) {
    return(filename)
  }
  
  # Otherwise, prepend data directory
  file.path(config$data_dir, filename)
}

#' Validate file exists
#' @param filepath Path to file
#' @param required Whether file is required
#' @return List with valid (logical) and message (character)
validate_file <- function(filepath, required = FALSE) {
  if (is.null(filepath) || filepath == "") {
    if (required) {
      return(list(valid = FALSE, message = "File path is required"))
    }
    return(list(valid = TRUE, message = ""))
  }
  
  if (!file.exists(filepath)) {
    if (required) {
      return(list(valid = FALSE, message = paste("File not found:", filepath)))
    }
    return(list(valid = TRUE, message = paste("Optional file not found:", filepath)))
  }
  
  return(list(valid = TRUE, message = ""))
}

