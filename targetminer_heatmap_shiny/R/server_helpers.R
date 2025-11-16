#' Server Helper Functions
#' 
#' Functions for server-side processing, validation, and parameter preparation

#' Validate inputs based on mode
#' @param input Shiny input object
#' @param config Configuration list
#' @return List with valid (logical) and message (character)
validate_inputs <- function(input, config) {
  
  # Validate mode-specific inputs
  if (input$mode == "regular") {
    # Check if file upload or paste is provided
    gene_input_method <- input$gene_input_method %||% "file"
    if (gene_input_method == "file") {
      if (is.null(input$gene_list_file) || is.null(input$gene_list_file$datapath)) {
        return(list(valid = FALSE, message = "Gene list file is required"))
      }
    } else {
      # Paste method
      if (is.null(input$gene_list_paste) || trimws(input$gene_list_paste) == "") {
        return(list(valid = FALSE, message = "Gene list (paste) is required"))
      }
    }
  } else if (input$mode == "rubric") {
    if (is.null(input$rubric_file) || is.null(input$rubric_file$datapath)) {
      return(list(valid = FALSE, message = "Rubric Excel file is required"))
    }
  } else if (input$mode == "partner") {
    if (is.null(input$partner_file) || is.null(input$partner_file$datapath)) {
      return(list(valid = FALSE, message = "Anchor partner Excel file is required"))
    }
  }
  
  # GTEx file is loaded from default location - check if it exists
  if (is.null(config$gtex_file) || !file.exists(config$gtex_file)) {
    return(list(valid = FALSE, message = paste("GTEx file not found at default location:", config$gtex_file)))
  }
  
  # Validate output filename
  if (is.null(input$output_filename) || input$output_filename == "") {
    return(list(valid = FALSE, message = "Output filename is required"))
  }
  
  return(list(valid = TRUE, message = ""))
}

#' Prepare heatmap parameters from input
#' @param input Shiny input object
#' @param config Configuration list
#' @return List of parameters for heatmap generation
prepare_heatmap_parameters <- function(input, config) {
  
  # Get file paths (handle uploaded files)
  params <- list()
  
  # Mode-specific files
  if (input$mode == "regular") {
    # Handle file upload or paste
    gene_input_method <- input$gene_input_method %||% "file"
    if (gene_input_method == "file") {
      params$gene_list_file <- input$gene_list_file$datapath
    } else {
      # Create temporary file from paste input
      paste_text <- input$gene_list_paste
      if (!is.null(paste_text) && trimws(paste_text) != "") {
        # Split by lines and clean up
        lines <- strsplit(paste_text, "\n")[[1]]
        lines <- trimws(lines)
        # Remove empty lines and comments
        lines <- lines[lines != "" & !grepl("^#", lines)]
        if (length(lines) > 0) {
          temp_file <- tempfile(fileext = ".txt")
          writeLines(lines, temp_file)
          params$gene_list_file <- temp_file
        } else {
          params$gene_list_file <- NULL
        }
      } else {
        params$gene_list_file <- NULL
      }
    }
    params$rubric_file <- NULL
    params$partner_file <- NULL
  } else if (input$mode == "rubric") {
    params$gene_list_file <- NULL
    params$rubric_file <- input$rubric_file$datapath
    params$partner_file <- NULL
  } else if (input$mode == "partner") {
    params$gene_list_file <- NULL
    params$rubric_file <- NULL
    params$partner_file <- input$partner_file$datapath
  }
  
  # GTEx file - use default from config
  params$gtex_tsv_file <- config$gtex_file
  
  # TCGA RDS file - use default from config if it exists
  if (!is.null(config$tcga_rds_file) && file.exists(config$tcga_rds_file)) {
    params$tcga_rds_file <- config$tcga_rds_file
  } else {
    params$tcga_rds_file <- NULL
  }
  
  # Output file - for Shiny, we'll generate PNG, PDF is generated on-demand
  output_dir <- config$output_dir
  if (!dir.exists(output_dir)) {
    dir.create(output_dir, recursive = TRUE)
  }
  # Generate unique filename
  timestamp <- format(Sys.time(), "%Y%m%d_%H%M%S")
  base_filename <- if (!is.null(input$output_filename) && input$output_filename != "") {
    tools::file_path_sans_ext(input$output_filename)
  } else {
    paste0("heatmap_", timestamp)
  }
  params$output_filename <- paste0(base_filename, ".png")  # PNG for display
  params$output_dir <- output_dir
  
  # Parameters
  params$topn <- if (input$mode %in% c("rubric", "partner")) {
    input$topn %||% ifelse(input$mode == "rubric", 35, 30)
  } else {
    NULL
  }
  
  params$chart_title <- input$chart_title %||% NULL
  params$collapse_gtex_tissues <- input$collapse_gtex_tissues %||% TRUE
  params$rubric_zscore <- input$rubric_zscore %||% FALSE
  params$width <- input$width %||% 20
  params$height <- input$height %||% 12
  
  # Handle gene annotation - file or paste
  annotation_input_method <- input$annotation_input_method %||% "file"
  if (annotation_input_method == "file") {
    params$gene_annotation_file <- if (!is.null(input$gene_annotation_file) && 
                                         !is.null(input$gene_annotation_file$datapath)) {
      input$gene_annotation_file$datapath
    } else {
      NULL
    }
  } else {
    # Paste method - create temporary file
    paste_text <- input$gene_annotation_paste
    if (!is.null(paste_text) && trimws(paste_text) != "") {
      # Split by lines and clean up
      lines <- strsplit(paste_text, "\n")[[1]]
      lines <- trimws(lines)
      # Remove empty lines
      lines <- lines[lines != ""]
      if (length(lines) > 0) {
        temp_file <- tempfile(fileext = ".tsv")
        # Write paste text to temp file
        writeLines(lines, temp_file)
        params$gene_annotation_file <- temp_file
      } else {
        params$gene_annotation_file <- NULL
      }
    } else {
      params$gene_annotation_file <- NULL
    }
  }
  
  params$synonyms_file <- if (!is.null(input$synonyms_file) && 
                               !is.null(input$synonyms_file$datapath)) {
    input$synonyms_file$datapath
  } else {
    NULL
  }
  
  # Parse comma-separated lists
  params$box_genes <- if (!is.null(input$box_genes) && input$box_genes != "") {
    strsplit(trimws(input$box_genes), ",")[[1]]
  } else {
    NULL
  }
  
  params$highlight_cohorts <- if (!is.null(input$highlight_cohorts) && 
                                   input$highlight_cohorts != "") {
    strsplit(trimws(input$highlight_cohorts), ",")[[1]]
  } else {
    NULL
  }
  
  params$highlight_tissues <- if (!is.null(input$highlight_tissues) && 
                                   input$highlight_tissues != "") {
    strsplit(trimws(input$highlight_tissues), ",")[[1]]
  } else {
    NULL
  }
  
  # TCGA cohorts (use from config)
  params$tcga_cohorts <- config$tcga_cohorts
  
  # Other defaults
  params$delay <- 0.5
  params$use_cache <- TRUE
  params$show_progress <- FALSE  # Don't show progress in Shiny
  
  return(params)
}

#' Parse comma-separated list helper
#' @param str String to parse
#' @return Character vector or NULL
parse_comma_list <- function(str) {
  if (is.null(str) || str == "" || str == "NULL") {
    return(NULL)
  }
  items <- strsplit(str, ",")[[1]]
  items <- trimws(items)
  items <- items[items != ""]
  if (length(items) == 0) {
    return(NULL)
  }
  return(items)
}

#' Null coalescing operator
#' @param x First value
#' @param y Default value
#' @return x if not null, else y
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

