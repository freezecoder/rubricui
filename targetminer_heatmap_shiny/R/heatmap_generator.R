#' Heatmap Generator for Shiny
#' 
#' Functions for generating heatmaps as R plots/images for Shiny display

#' Generate heatmap objects for Shiny display
#' @param params List of parameters for heatmap generation
#' @return List with plot_objects and params for PDF generation
#'   For partner mode: returns list of plot_objects (one per anchor gene)
#'   For other modes: returns single plot_objects
generate_heatmap_for_shiny <- function(params) {
  
  # Check if partner mode
  is_partner_mode <- !is.null(params$partner_file)
  
  if (is_partner_mode) {
    # Partner mode: generate heatmaps for all anchor genes
    result <- generate_partner_mode_heatmaps_for_shiny(params)
  } else {
    # Regular or rubric mode: generate single heatmap
    result <- generate_heatmap_objects_only(params)
    
    # Wrap in list format for consistency
    result <- list(
      plot_objects = result,
      params = params,
      is_partner_mode = FALSE
    )
  }
  
  return(result)
}

#' Generate heatmap objects without saving to file
#' @param params List of parameters
#' @return List with heatmap objects and data
generate_heatmap_objects_only <- function(params) {
  
  # Use the existing helper function but don't save PDF
  # We'll extract the heatmap objects before they're drawn
  
  # Call the main function with a temporary output file
  # but intercept before PDF is created
  temp_output <- tempfile(fileext = ".pdf")
  
  # Generate heatmaps using existing function but capture objects
  # We need to modify the approach - call internal functions directly
  
  # Extract parameters
  gene_list_file <- params$gene_list_file
  rubric_file <- params$rubric_file
  partner_file <- params$partner_file
  
  # Determine mode
  is_partner_mode <- !is.null(partner_file)
  is_rubric_mode <- !is.null(rubric_file) && is.null(partner_file)
  
  # Load gene list based on mode
  if (!is.null(gene_list_file)) {
    # Regular mode
    gene_symbols <- load_gene_list(gene_list_file)
    rubric_data <- NULL
  } else if (is_rubric_mode) {
    # Rubric mode - use gene_symbol directly, NOT gene2_name
    rubric_result <- load_gene_list_from_rubric(rubric_file, topn = params$topn)
    gene_symbols <- rubric_result$genes
    rubric_data <- rubric_result$rubric_data
    # Ensure rubric_data uses gene_symbol, not gene2_name (for rubric mode)
    if ("gene2_name" %in% colnames(rubric_data)) {
      # If gene2_name exists, we need to filter it out for rubric mode
      # Rubric mode should only use gene_symbol
      cat("  Note: Rubric mode - using gene_symbol, ignoring gene2_name\n")
    }
  } else if (is_partner_mode) {
    # Partner mode is handled separately in generate_partner_mode_heatmaps_for_shiny
    # This function should not be called for partner mode
    stop("Partner mode should be handled by generate_partner_mode_heatmaps_for_shiny")
  } else {
    stop("Either gene_list_file, rubric_file, or partner_file must be provided")
  }
  
  # Use the helper function but modify to return objects instead of saving
  # We'll call generate_heatmap_with_gene_list with append_to_pdf=FALSE
  # but capture the heatmap objects before drawing
  
  # For rubric mode, ensure rubric_data only has gene_symbol (not gene2_name)
  # This prevents generate_heatmap_with_gene_list from using partner mode logic
  # The issue: generate_heatmap_with_gene_list checks for gene2_name and assumes partner mode
  # For rubric mode, we need to ensure gene2_name doesn't exist so it uses gene_symbol instead
  if (!is.null(rubric_data) && is_rubric_mode) {
    # Remove gene2_name if it exists (shouldn't be there from read_rubric_data, but just in case)
    if ("gene2_name" %in% colnames(rubric_data)) {
      cat("  Warning: Removing gene2_name column for rubric mode (should use gene_symbol only)\n")
      rubric_data <- rubric_data %>% dplyr::select(-gene2_name)
    }
    # Ensure we're using gene_symbol for filtering
    cat("  Rubric mode: Using gene_symbol from rubric data (not gene2_name)\n")
    
    # IMPORTANT: generate_heatmap_with_gene_list assumes partner mode if gene2_name exists
    # For rubric mode, we need to process rubric_data ourselves and pass NULL
    # to avoid triggering partner mode logic
    if (!"gene2_name" %in% colnames(rubric_data)) {
      # For rubric mode, process the rubric data ourselves
      # Filter by gene_symbol (not gene2_name)
      rubric_data_filtered <- rubric_data %>%
        dplyr::filter(gene_symbol %in% gene_symbols) %>%
        dplyr::select(gene_symbol, dplyr::contains("SCORE_"))
      
      # Prepare rubric matrices using gene_symbol
      rubric_matrices_precomputed <- prepare_rubric_matrix(
        rubric_data_filtered,
        gene_symbols,
        zscore = params$rubric_zscore %||% FALSE,
        total_score_col = "SCORE_total"  # Use SCORE_total for rubric mode, not SCORE_SUM_ANC_PARTNER
      )
      
      # Pass NULL to generate_heatmap_with_gene_list to avoid partner mode logic
      rubric_data_for_call <- NULL
    } else {
      # If gene2_name exists, it's partner mode data - pass it through
      # generate_heatmap_with_gene_list will handle partner mode correctly
      rubric_data_for_call <- rubric_data
      rubric_matrices_precomputed <- NULL
    }
  } else if (is_partner_mode) {
    # Partner mode: pass rubric_data with gene2_name to generate_heatmap_with_gene_list
    # It will correctly filter by gene2_name and use SCORE_SUM_ANC_PARTNER
    rubric_data_for_call <- rubric_data
    rubric_matrices_precomputed <- NULL
  } else {
    rubric_data_for_call <- rubric_data
    rubric_matrices_precomputed <- NULL
  }
  
  # Call generate_heatmap_with_gene_list
  # For rubric mode, rubric_data is NULL (we'll add rubric matrices after)
  result <- generate_heatmap_with_gene_list(
    gene_symbols = gene_symbols,
    rubric_data = rubric_data_for_call,  # NULL for rubric mode, actual data for partner mode
    gtex_tsv_file = params$gtex_tsv_file,
    output_file = temp_output,  # Temporary file
    tcga_cohorts = params$tcga_cohorts,
    delay = params$delay %||% 0.5,
    use_cache = params$use_cache %||% TRUE,
    width = params$width %||% 20,
    height = params$height %||% 12,
    show_progress = params$show_progress %||% FALSE,
    gene_annotation_file = params$gene_annotation_file,
    highlight_cohorts = params$highlight_cohorts,
    highlight_tissues = params$highlight_tissues,
    synonyms_file = params$synonyms_file,
    tcga_rds_file = params$tcga_rds_file,
    box_genes = params$box_genes,
    collapse_gtex_tissues = params$collapse_gtex_tissues %||% TRUE,
    rubric_zscore = params$rubric_zscore %||% FALSE,
    chart_title = params$chart_title,
    append_to_pdf = FALSE
  )
  
  # Clean up temp file
  if (file.exists(temp_output)) {
    unlink(temp_output)
  }
  
  # For rubric mode, we need to add the precomputed rubric matrices
  if (!is.null(rubric_matrices_precomputed) && is_rubric_mode) {
    # Create rubric heatmaps from precomputed matrices
    rubric_total_matrix <- rubric_matrices_precomputed$total
    rubric_matrix <- rubric_matrices_precomputed$other
    
    # Split rubric matrix into Tumor Expression and Other scores
    rubric_tumor_matrix <- NULL
    rubric_other_matrix <- NULL
    
    if (!is.null(rubric_matrix)) {
      col_names <- colnames(rubric_matrix)
      healthy_expr_pattern <- grepl("gtex|hpa|keytissues|key.tissues|key.tissue", col_names, ignore.case = TRUE)
      dependency_pattern <- grepl("depmap|dependency", col_names, ignore.case = TRUE) & !healthy_expr_pattern
      tumor_pattern <- !healthy_expr_pattern & !dependency_pattern
      
      if (sum(tumor_pattern) > 0) {
        rubric_tumor_matrix <- rubric_matrix[, tumor_pattern, drop = FALSE]
      }
      if (sum(!tumor_pattern) > 0) {
        rubric_other_matrix <- rubric_matrix[, !tumor_pattern, drop = FALSE]
      }
    }
    
    # Create heatmap objects
    if (!is.null(rubric_total_matrix)) {
      result$rubric_total_heatmap <- create_rubric_total_heatmap(
        rubric_total_matrix,
        row_groups = result$row_groups,
        box_genes = params$box_genes
      )
    }
    
    if (!is.null(rubric_tumor_matrix)) {
      result$rubric_tumor_heatmap <- create_rubric_heatmap(
        rubric_tumor_matrix,
        row_groups = result$row_groups,
        box_genes = params$box_genes,
        panel_title = "Tumor Expression",
        heatmap_name = "Tumor Expression Score",
        show_legend = FALSE
      )
    }
    
    if (!is.null(rubric_other_matrix)) {
      result$rubric_heatmap <- create_rubric_heatmap(
        rubric_other_matrix,
        row_groups = result$row_groups,
        box_genes = params$box_genes,
        heatmap_name = "Rubric Scores"
      )
    }
    
    cat("  Added rubric heatmaps for rubric mode\n")
  }
  
  # Extract heatmap objects from result
  return(list(
    rubric_total_heatmap = result$rubric_total_heatmap,
    rubric_tumor_heatmap = result$rubric_tumor_heatmap,
    rubric_heatmap = result$rubric_heatmap,
    tcga_heatmap = result$tcga_heatmap,
    gtex_heatmap = result$gtex_heatmap,
    chart_title = params$chart_title,
    width = params$width %||% 20,
    height = params$height %||% 12,
    row_groups = result$row_groups
  ))
}

#' Generate heatmaps for all anchor genes in partner mode
#' @param params List of parameters for heatmap generation
#' @return List with anchor_heatmaps (list of plot objects, one per anchor) and params
generate_partner_mode_heatmaps_for_shiny <- function(params) {
  
  partner_file <- params$partner_file
  anchor_partner_list <- load_anchor_partner_data(partner_file, topn = params$topn %||% 30)
  
  if (length(anchor_partner_list) == 0) {
    stop("No anchor genes found in partner file")
  }
  
  cat("Partner mode: Generating heatmaps for", length(anchor_partner_list), "anchor genes\n")
  
  # Generate heatmap for each anchor gene
  anchor_heatmaps <- list()
  temp_output <- tempfile(fileext = ".pdf")
  
  for (i in seq_along(anchor_partner_list)) {
    anchor_info <- anchor_partner_list[[i]]
    anchor_gene <- anchor_info$anchor
    partner_genes <- anchor_info$partners
    anchor_rubric_data <- anchor_info$data
    
    cat("\n  Processing anchor gene", i, "of", length(anchor_partner_list), ":", anchor_gene, "\n")
    cat("    Partner genes:", length(partner_genes), "\n")
    
    if (length(partner_genes) == 0) {
      cat("    Warning: No partner genes found for anchor", anchor_gene, "- skipping\n")
      next
    }
    
    # Create chart title for this anchor
    anchor_chart_title <- if (!is.null(params$chart_title) && params$chart_title != "") {
      paste0(params$chart_title, " - Anchor: ", anchor_gene)
    } else {
      paste0("Anchor: ", anchor_gene, " (", length(partner_genes), " partners)")
    }
    
    # Generate heatmap for this anchor
    tryCatch({
      result <- generate_heatmap_with_gene_list(
        gene_symbols = partner_genes,
        rubric_data = anchor_rubric_data,
        gtex_tsv_file = params$gtex_tsv_file,
        output_file = temp_output,
        tcga_cohorts = params$tcga_cohorts,
        delay = params$delay %||% 0.5,
        use_cache = params$use_cache %||% TRUE,
        width = params$width %||% 20,
        height = params$height %||% 12,
        show_progress = params$show_progress %||% FALSE,
        gene_annotation_file = params$gene_annotation_file,
        highlight_cohorts = params$highlight_cohorts,
        highlight_tissues = params$highlight_tissues,
        synonyms_file = params$synonyms_file,
        tcga_rds_file = params$tcga_rds_file,
        box_genes = params$box_genes,
        collapse_gtex_tissues = params$collapse_gtex_tissues %||% TRUE,
        rubric_zscore = params$rubric_zscore %||% FALSE,
        chart_title = anchor_chart_title,
        append_to_pdf = FALSE
      )
      
      # Extract heatmap objects
      anchor_heatmaps[[anchor_gene]] <- list(
        rubric_total_heatmap = result$rubric_total_heatmap,
        rubric_tumor_heatmap = result$rubric_tumor_heatmap,
        rubric_heatmap = result$rubric_heatmap,
        tcga_heatmap = result$tcga_heatmap,
        gtex_heatmap = result$gtex_heatmap,
        chart_title = anchor_chart_title,
        width = params$width %||% 20,
        height = params$height %||% 12,
        row_groups = result$row_groups,
        anchor_gene = anchor_gene,
        partner_count = length(partner_genes)
      )
      
      cat("    Successfully generated heatmap for anchor:", anchor_gene, "\n")
    }, error = function(e) {
      cat("    Error processing anchor", anchor_gene, ":", conditionMessage(e), "\n")
    })
  }
  
  # Clean up temp file
  if (file.exists(temp_output)) {
    unlink(temp_output)
  }
  
  cat("\nPartner mode complete! Generated", length(anchor_heatmaps), "heatmaps\n")
  
  return(list(
    anchor_heatmaps = anchor_heatmaps,
    params = params,
    is_partner_mode = TRUE,
    anchor_count = length(anchor_heatmaps)
  ))
}

# Note: PNG creation removed - renderPlot() handles display directly
# This function kept for reference but not used in Shiny app

#' Draw heatmaps to current graphics device
#' @param plot_objects List of heatmap objects
draw_heatmaps_to_device <- function(plot_objects) {
  
  # Extract objects
  rubric_total_heatmap <- plot_objects$rubric_total_heatmap
  rubric_tumor_heatmap <- plot_objects$rubric_tumor_heatmap
  rubric_heatmap <- plot_objects$rubric_heatmap
  tcga_heatmap <- plot_objects$tcga_heatmap
  gtex_heatmap <- plot_objects$gtex_heatmap
  chart_title <- plot_objects$chart_title
  width <- plot_objects$width
  height <- plot_objects$height
  
  # Calculate padding
  top_padding <- if (!is.null(chart_title) && chart_title != "") 4 else 2
  
  # Draw heatmaps based on available panels
  if (!is.null(rubric_total_heatmap) && !is.null(rubric_tumor_heatmap) && !is.null(rubric_heatmap)) {
    draw(
      rubric_total_heatmap + rubric_tumor_heatmap + rubric_heatmap + tcga_heatmap + gtex_heatmap,
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      padding = unit(c(top_padding, 1, 6, 2), "cm")
    )
  } else if (!is.null(rubric_total_heatmap) && !is.null(rubric_heatmap)) {
    draw(
      rubric_total_heatmap + rubric_heatmap + tcga_heatmap + gtex_heatmap,
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      padding = unit(c(top_padding, 1, 6, 2), "cm")
    )
  } else if (!is.null(rubric_heatmap)) {
    draw(
      rubric_heatmap + tcga_heatmap + gtex_heatmap,
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      padding = unit(c(top_padding, 1, 6, 2), "cm")
    )
  } else {
    draw(
      tcga_heatmap + gtex_heatmap,
      heatmap_legend_side = "bottom",
      annotation_legend_side = "bottom",
      ht_gap = unit(0.5, "cm"),
      padding = unit(c(top_padding, 1, 6, 2), "cm")
    )
  }
  
  # Add title if provided
  if (!is.null(chart_title) && chart_title != "") {
    upViewport(0)
    grid.text(
      chart_title,
      x = unit(0.5, "npc"),
      y = unit(1, "npc") - unit(0.5, "cm"),
      gp = gpar(fontsize = 16, fontface = "bold"),
      just = c("center", "top")
    )
  }
}

#' Generate PDF from stored plot objects
#' @param plot_objects List of heatmap objects
#' @param output_file Path to output PDF file
#' @return Path to PDF file
generate_pdf_from_objects <- function(plot_objects, output_file) {
  
  # Open PDF device
  pdf(output_file, width = plot_objects$width, height = plot_objects$height)
  
  # Draw heatmaps
  draw_heatmaps_to_device(plot_objects)
  
  # Close device
  dev.off()
  
  cat("PDF created:", output_file, "\n")
  return(output_file)
}

#' Alternative method to create preview image
#' @param pdf_path Path to PDF file
#' @return Path to preview image or NULL
create_preview_image_alternative <- function(pdf_path) {
  if (!file.exists(pdf_path)) {
    return(NULL)
  }
  
  preview_dir <- file.path(dirname(pdf_path), "previews")
  if (!dir.exists(preview_dir)) {
    dir.create(preview_dir, recursive = TRUE)
  }
  
  pdf_basename <- tools::file_path_sans_ext(basename(pdf_path))
  preview_path <- file.path(preview_dir, paste0(pdf_basename, "_preview.png"))
  
  # Try pdftools package first (most reliable)
  if (requireNamespace("pdftools", quietly = TRUE)) {
    tryCatch({
      pdf_pages <- pdftools::pdf_info(pdf_path)$pages
      if (pdf_pages > 0) {
        img <- pdftools::pdf_render_page(pdf_path, page = 1, dpi = 150)
        if (requireNamespace("png", quietly = TRUE)) {
          png::writePNG(img, preview_path)
          if (file.exists(preview_path)) {
            cat("Preview image created using pdftools:", preview_path, "\n")
            return(preview_path)
          }
        }
      }
    }, error = function(e) {
      cat("pdftools method failed:", e$message, "\n")
    })
  }
  
  return(NULL)
}

#' Create preview image from PDF
#' @param pdf_path Path to PDF file
#' @return Path to preview image or NULL
create_preview_image <- function(pdf_path) {
  
  if (!file.exists(pdf_path)) {
    cat("PDF file does not exist:", pdf_path, "\n")
    return(NULL)
  }
  
  # Create preview directory
  preview_dir <- file.path(dirname(pdf_path), "previews")
  if (!dir.exists(preview_dir)) {
    dir.create(preview_dir, recursive = TRUE)
  }
  
  # Generate preview filename
  pdf_basename <- tools::file_path_sans_ext(basename(pdf_path))
  preview_path <- file.path(preview_dir, paste0(pdf_basename, "_preview.png"))
  
  # Method 1: Try pdftools package first (most reliable for R)
  if (requireNamespace("pdftools", quietly = TRUE)) {
    tryCatch({
      pdf_pages <- pdftools::pdf_info(pdf_path)$pages
      if (pdf_pages > 0) {
        img <- pdftools::pdf_render_page(pdf_path, page = 1, dpi = 150)
        if (requireNamespace("png", quietly = TRUE)) {
          png::writePNG(img, preview_path)
          if (file.exists(preview_path)) {
            cat("Preview image created using pdftools:", preview_path, "\n")
            return(preview_path)
          }
        } else {
          cat("png package not available for pdftools method\n")
        }
      }
    }, error = function(e) {
      cat("pdftools method failed:", e$message, "\n")
    })
  }
  
  # Method 2: Try pdftoppm (from poppler-utils)
  if (Sys.which("pdftoppm") != "") {
    tryCatch({
      system2(
        "pdftoppm",
        args = c(
          "-png",
          "-scale-to-x", "1200",
          "-scale-to-y", "800",
          "-singlefile",
          pdf_path,
          file.path(preview_dir, pdf_basename)
        ),
        stdout = FALSE,
        stderr = FALSE
      )
      
      # Check if file was created
      temp_png <- paste0(file.path(preview_dir, pdf_basename), ".png")
      if (file.exists(temp_png)) {
        file.rename(temp_png, preview_path)
        cat("Preview image created using pdftoppm:", preview_path, "\n")
        return(preview_path)
      }
    }, error = function(e) {
      cat("pdftoppm method failed:", e$message, "\n")
    })
  }
  
  # Method 3: Try ImageMagick convert
  if (Sys.which("convert") != "") {
    tryCatch({
      system2(
        "convert",
        args = c(
          "-density", "150",
          "-quality", "90",
          "-resize", "1200x800",
          pdf_path,
          preview_path
        ),
        stdout = FALSE,
        stderr = FALSE
      )
      
      if (file.exists(preview_path)) {
        cat("Preview image created using ImageMagick:", preview_path, "\n")
        return(preview_path)
      }
    }, error = function(e) {
      cat("ImageMagick method failed:", e$message, "\n")
    })
  }
  
  # If all methods fail
  cat("Warning: Could not create preview image. All methods failed.\n")
  cat("  PDF file exists:", file.exists(pdf_path), "\n")
  cat("  Install pdftools R package: install.packages('pdftools')\n")
  cat("  Or install system tools: pdftoppm (poppler-utils) or ImageMagick\n")
  
  return(NULL)
}

#' Generate heatmap with progress tracking
#' @param params List of parameters
#' @param session Shiny session object
#' @return Heatmap result
generate_heatmap_with_progress <- function(params, session = NULL) {
  
  if (!is.null(session)) {
    # Update progress
    shiny::withProgress(
      session = session,
      message = "Generating heatmap",
      value = 0,
      {
        setProgress(0.1, detail = "Loading data files...")
        # ... heatmap generation steps ...
        setProgress(1.0, detail = "Complete!")
      }
    )
  }
  
  return(generate_heatmap_reactive(params))
}

