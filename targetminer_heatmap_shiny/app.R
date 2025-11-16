#!/usr/bin/env Rscript
#' TCGA-GTEx Heatmap Shiny Application
#' 
#' Interactive Shiny application for generating TCGA-GTEx heatmaps
#' Supports three modes: Regular, Rubric, and Partner
#' 
#' @author TargetMiner Team
#' @version 1.1.0

# Load required libraries
suppressPackageStartupMessages({
  library(shiny)
  library(bslib)
  library(bsicons)
  library(DT)
  library(shinyjs)
  library(shinyWidgets)
  library(shinyFeedback)
})

# Get app directory
app_dir <- getwd()
if (basename(app_dir) != "targetminer_heatmap_shiny") {
  # Try to find the app directory
  if (file.exists("app.R")) {
    app_dir <- getwd()
  } else if (file.exists("targetminer_heatmap_shiny/app.R")) {
    app_dir <- file.path(getwd(), "targetminer_heatmap_shiny")
  }
}

# Source helper functions
source(file.path(app_dir, "R/config.R"))
source(file.path(app_dir, "R/ui_components.R"))
source(file.path(app_dir, "R/server_helpers.R"))
source(file.path(app_dir, "R/heatmap_generator.R"))

# Source the main heatmap script
# Try multiple possible locations
heatmap_script <- NULL
possible_paths <- c(
  file.path(dirname(app_dir), "tcga_gtex_heatmap.R"),
  file.path(app_dir, "tcga_gtex_heatmap.R"),
  "../tcga_gtex_heatmap.R",
  "../../tcga_gtex_heatmap.R"
)

for (path in possible_paths) {
  if (file.exists(path)) {
    heatmap_script <- path
    break
  }
}

if (!is.null(heatmap_script)) {
  source(heatmap_script)
} else {
  stop("Could not find tcga_gtex_heatmap.R. Please ensure it is accessible.")
}

# Initialize app configuration
app_config <- load_app_config()

# Set Shiny options for file upload size limit (120MB)
options(shiny.maxRequestSize = 120 * 1024 * 1024)  # 120MB in bytes

# UI
ui <- page_sidebar(
  # Theme
  theme = bs_theme(
    version = 5,
    bootswatch = "cosmo",
    primary = "#2c3e50",
    secondary = "#34495e",
    success = "#27ae60",
    info = "#3498db",
    warning = "#f39c12",
    danger = "#e74c3c",
    font_scale = 1.0
  ),
  
  # Sidebar
  sidebar = sidebar(
    width = 350,
    title = div(
      style = "display: flex; align-items: center; gap: 10px;",
      bs_icon("graph-up", size = "1.5em"),
      span("TargetMiner Heatmaps", style = "font-weight: 600; font-size: 1.2em;")
    ),
    
    # Mode selection
    card(
      card_header("Mode Selection", class = "h6"),
      radioButtons(
        "mode",
        label = NULL,
        choices = list(
          "Regular Mode" = "regular",
          "Rubric Mode" = "rubric",
          "Partner Mode" = "partner"
        ),
        selected = "regular"
      ),
      p("Select the mode for heatmap generation", class = "text-muted small")
    ),
    
    # Input files card
    card(
      card_header("Input Files", class = "h6"),
      uiOutput("input_files_ui"),
      p("GTEx and TCGA data files are loaded from default locations", 
        class = "text-muted small mt-2")
    ),
    
    # Action buttons
    card(
      div(
        class = "d-grid gap-2",
        actionButton(
          "run_heatmap",
          "Generate Heatmap",
          class = "btn-primary btn-lg"
        ),
        actionButton(
          "reset_form",
          "Reset Form",
          class = "btn-secondary"
        )
      )
    ),
    
    # Parameters card
    card(
      card_header("Parameters", class = "h6"),
      uiOutput("parameters_ui")
    ),
    
    # Status card
    card(
      card_header("Status", class = "h6"),
      uiOutput("status_display")
    )
  ),
  
  # Main content
  navset_tab(
    id = "main_tabs",
    
    # Heatmap tab
    nav_panel(
      "Heatmap",
      value = "heatmap_tab",
      page_fluid(
        h2("TCGA-GTEx Heatmap Visualization"),
        p("Configure parameters in the sidebar and click 'Generate Heatmap' to create your visualization.", 
          class = "text-muted"),
        
        tags$head(
          tags$style(HTML("
            #heatmap_plot {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              border: 1px solid #ddd;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              background: white;
            }
            #heatmap_preview_container {
              display: flex;
              flex-direction: column;
              align-items: stretch;
              width: 100% !important;
              height: 100%;
              min-height: 600px;
              padding: 20px;
              box-sizing: border-box;
            }
            .shiny-plot-output {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              flex: 1 1 auto;
            }
            #advanced_options_panel {
              position: sticky;
              top: 20px;
              max-height: calc(100vh - 100px);
              overflow-y: auto;
            }
            .main-content-wrapper {
              display: flex !important;
              flex-direction: row !important;
              gap: 20px;
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box;
              align-items: stretch;
            }
            .main-heatmap-area {
              flex: 1 1 0% !important;
              min-width: 0 !important;
              max-width: none !important;
              width: auto !important;
              display: flex;
              flex-direction: column;
            }
            .main-heatmap-area .card {
              width: 100% !important;
              max-width: 100% !important;
              flex: 1 1 auto;
              display: flex;
              flex-direction: column;
            }
            .main-heatmap-area .card-body {
              flex: 1 1 auto;
              display: flex;
              flex-direction: column;
              padding: 0 !important;
            }
            .right-panel-area {
              width: 280px !important;
              min-width: 280px !important;
              max-width: 280px !important;
              flex-shrink: 0 !important;
              flex-grow: 0 !important;
            }
            .right-panel-area .card {
              width: 100% !important;
            }
          "))
        ),
        
        # Layout with main content and right panel
        div(
          class = "main-content-wrapper",
          # Main content area - Heatmap preview
          div(
            class = "main-heatmap-area",
            card(
              card_header(
                div(
                  style = "display: flex; justify-content: space-between; align-items: center;",
                  span("Heatmap Preview", style = "font-weight: 600;"),
                  div(
                    downloadButton("download_pdf", "Download PDF", class = "btn-sm btn-primary"),
                    style = "display: inline-block;"
                  )
                )
              ),
              div(
                id = "heatmap_preview_container",
                style = "width: 100%; height: 100%; padding: 20px; flex: 1 1 auto;",
                # Dynamic UI - shows single plot for regular/rubric mode, multiple for partner mode
                uiOutput("heatmap_plots_ui"),
                # Fallback UI for when no plot is available
                uiOutput("heatmap_preview_fallback")
              )
            )
          ),
          
          # Right panel - Advanced Options
          div(
            class = "right-panel-area",
            card(
              id = "advanced_options_panel",
              card_header("Advanced Options", class = "h6"),
              uiOutput("advanced_options_ui")
            )
          )
        )
      )
    ),
    
    # User Guide tab
    nav_panel(
      "User Guide",
      value = "guide_tab",
      page_fluid(
        includeMarkdown("documentation/user_guide.md")
      )
    ),
    
    # About tab
    nav_panel(
      "About",
      value = "about_tab",
      page_fluid(
        card(
          card_header("About TCGA-GTEx Heatmap Generator"),
          includeMarkdown("documentation/about.md")
        )
      )
    )
  )
)

# Server
server <- function(input, output, session) {
  
  # Initialize reactive values
  values <- reactiveValues(
    heatmap_result = NULL,
    preview_image = NULL,
    status_message = "Ready",
    last_run_time = NULL
  )
  
  # Load configuration
  observe({
    app_config <<- load_app_config()
  })
  
  # Render input files UI based on mode
  output$input_files_ui <- renderUI({
    create_input_files_ui(input$mode, app_config)
  })
  
  # Render parameters UI based on mode
  output$parameters_ui <- renderUI({
    create_parameters_ui(input$mode)
  })
  
  # Render advanced options UI
  output$advanced_options_ui <- renderUI({
    create_advanced_options_ui()
  })
  
  # Render status display
  output$status_display <- renderUI({
    div(
      class = "text-muted small",
      p(strong("Status:"), values$status_message),
      if (!is.null(values$last_run_time)) {
        p(strong("Last run:"), format(values$last_run_time, "%H:%M:%S"))
      }
    )
  })
  
  # Reset form
  observeEvent(input$reset_form, {
    session$reload()
  })
  
  # Generate heatmap
  observeEvent(input$run_heatmap, {
    
    # Validate inputs
    validation_result <- validate_inputs(input, app_config)
    
    if (!validation_result$valid) {
      showNotification(
        paste("Validation Error:", validation_result$message),
        type = "error",
        duration = 5
      )
      values$status_message <- paste("Error:", validation_result$message)
      return()
    }
    
    # Update status
    values$status_message <- "Generating heatmap..."
    values$last_run_time <- Sys.time()
    values$heatmap_result <- NULL  # Clear previous result
    
    # Generate heatmap with progress bar
    tryCatch({
      
      # Prepare parameters
      params <- prepare_heatmap_parameters(input, app_config)
      
      # Generate heatmap with progress tracking
      withProgress(
        message = "Generating heatmap",
        value = 0,
        detail = "Preparing parameters...",
        {
          setProgress(0.1, detail = "Loading TCGA data...")
          
          # Generate heatmap objects (no file saving needed for display)
          result <- generate_heatmap_for_shiny(params)
          
          # Log result for debugging
          cat("Heatmap generation complete.\n")
          cat("  Plot objects available:", !is.null(result$plot_objects), "\n")
          
          setProgress(0.9, detail = "Finalizing...")
          
          # Store result
          values$heatmap_result <- result
          
          setProgress(1.0, detail = "Complete!")
        }
      )
      
      # Update status
      values$status_message <- "Heatmap generated successfully!"
      
      # Show success notification
      showNotification(
        "Heatmap generated successfully!",
        type = "default",
        duration = 3
      )
      
      # Switch to heatmap tab
      updateNavbarPage(session, "main_tabs", selected = "heatmap_tab")
      
    }, error = function(e) {
      # Update status
      values$status_message <- paste("Error:", conditionMessage(e))
      
      # Show error notification
      showNotification(
        paste("Error generating heatmap:", conditionMessage(e)),
        type = "error",
        duration = 10
      )
    })
  })
  
  # Render single heatmap plot for regular/rubric mode
  output$heatmap_plot <- renderPlot({
    req(values$heatmap_result)
    
    if (!is.null(values$heatmap_result$plot_objects)) {
      draw_heatmaps_to_device(values$heatmap_result$plot_objects)
    } else {
      plot.new()
      text(0.5, 0.5, "No heatmap data available", cex = 1.5)
    }
  }, height = function() {
    return(1200)
  })
  
  # Render multiple heatmap plots for partner mode using observe
  observe({
    req(values$heatmap_result)
    
    is_partner_mode <- values$heatmap_result$is_partner_mode %||% FALSE
    
    if (is_partner_mode) {
      anchor_heatmaps <- values$heatmap_result$anchor_heatmaps
      
      if (!is.null(anchor_heatmaps) && length(anchor_heatmaps) > 0) {
        # Create renderPlot for each anchor gene dynamically
        for (i in seq_along(anchor_heatmaps)) {
          local({
            my_i <- i
            anchor_data <- anchor_heatmaps[[my_i]]
            output_name <- paste0("heatmap_plot_anchor_", my_i)
            
            output[[output_name]] <- renderPlot({
              draw_heatmaps_to_device(anchor_data)
            }, height = 800)
          })
        }
      }
    }
  })
  
  # Dynamic UI for heatmap plots - handles single plot (regular/rubric) or multiple (partner)
  output$heatmap_plots_ui <- renderUI({
    req(values$heatmap_result)
    
    is_partner_mode <- values$heatmap_result$is_partner_mode %||% FALSE
    
    if (is_partner_mode) {
      # Partner mode: show multiple heatmaps (one per anchor gene)
      anchor_heatmaps <- values$heatmap_result$anchor_heatmaps
      
      if (is.null(anchor_heatmaps) || length(anchor_heatmaps) == 0) {
        return(NULL)
      }
      
      # Create UI for each anchor gene heatmap
      plot_list <- lapply(seq_along(anchor_heatmaps), function(i) {
        anchor_gene <- names(anchor_heatmaps)[i]
        anchor_data <- anchor_heatmaps[[i]]
        
        div(
          class = "mb-4",
          style = "border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: white;",
          h4(
            anchor_data$chart_title %||% paste0("Anchor: ", anchor_gene),
            style = "margin-bottom: 15px; color: #333;"
          ),
          div(
            style = "width: 100%; text-align: center;",
            plotOutput(
              paste0("heatmap_plot_anchor_", i),
              width = "100%",
              height = "800px"
            )
          )
        )
      })
      
      return(tagList(plot_list))
    } else {
      # Regular or rubric mode: show single heatmap
      if (!is.null(values$heatmap_result$plot_objects)) {
        return(
          div(
            style = "width: 100%; height: 100%; min-height: 600px; flex: 1 1 auto; display: flex; flex-direction: column;",
            plotOutput("heatmap_plot", width = "100%", height = "100%")
          )
        )
      }
    }
    
    return(NULL)
  })
  
  # Render single heatmap plot for regular/rubric mode
  output$heatmap_plot <- renderPlot({
    req(values$heatmap_result)
    
    if (!is.null(values$heatmap_result$plot_objects)) {
      draw_heatmaps_to_device(values$heatmap_result$plot_objects)
    } else {
      plot.new()
      text(0.5, 0.5, "No heatmap data available", cex = 1.5)
    }
  }, height = function() {
    return(1200)
  })
  
  # Render multiple heatmap plots for partner mode
  observe({
    req(values$heatmap_result)
    
    is_partner_mode <- values$heatmap_result$is_partner_mode %||% FALSE
    
    if (is_partner_mode) {
      anchor_heatmaps <- values$heatmap_result$anchor_heatmaps
      
      if (!is.null(anchor_heatmaps) && length(anchor_heatmaps) > 0) {
        # Create renderPlot for each anchor gene
        for (i in seq_along(anchor_heatmaps)) {
          local({
            my_i <- i
            anchor_data <- anchor_heatmaps[[my_i]]
            output_name <- paste0("heatmap_plot_anchor_", my_i)
            
            output[[output_name]] <- renderPlot({
              draw_heatmaps_to_device(anchor_data)
            }, height = 800)
          })
        }
      }
    }
  })
  
  # Fallback UI when no image available
  output$heatmap_preview_fallback <- renderUI({
    if (is.null(values$heatmap_result)) {
      return(
        div(
          class = "text-muted",
          style = "padding: 40px; text-align: center;",
          div(bs_icon("image", size = "3em")),
          p("No heatmap generated yet. Configure parameters and click 'Generate Heatmap' to create a visualization.", 
            style = "margin-top: 20px;")
        )
      )
    }
    
    # Check if we have plot objects (regular/rubric) or anchor_heatmaps (partner)
    is_partner_mode <- values$heatmap_result$is_partner_mode %||% FALSE
    has_plot <- if (is_partner_mode) {
      !is.null(values$heatmap_result$anchor_heatmaps) && 
      length(values$heatmap_result$anchor_heatmaps) > 0
    } else {
      !is.null(values$heatmap_result$plot_objects)
    }
    
    # If we have plot data, don't show fallback
    if (has_plot) {
      return(NULL)
    }
    
    # If no plot data available
    return(
      div(
        class = "alert alert-warning",
        style = "margin-top: 20px;",
        p(strong("Heatmap generation failed")),
        p("The heatmap could not be generated. Please check the console for error messages."),
        p(
          class = "text-muted small mt-2",
          paste("Generated at:", format(values$last_run_time, "%Y-%m-%d %H:%M:%S"))
        )
      )
    )
  })
  
  # Download PDF handler - generates PDF on-demand from stored plot objects
  output$download_pdf <- downloadHandler(
    filename = function() {
      if (!is.null(values$heatmap_result) && !is.null(values$heatmap_result$params)) {
        output_filename <- values$heatmap_result$params$output_filename %||% 
                          paste0("heatmap_", format(Sys.time(), "%Y%m%d_%H%M%S"), ".pdf")
        # Ensure .pdf extension
        if (!grepl("\\.pdf$", output_filename, ignore.case = TRUE)) {
          output_filename <- paste0(tools::file_path_sans_ext(output_filename), ".pdf")
        }
        return(output_filename)
      } else {
        return(paste0("heatmap_", format(Sys.time(), "%Y%m%d_%H%M%S"), ".pdf"))
      }
    },
    content = function(file) {
      if (is.null(values$heatmap_result)) {
        stop("Heatmap data not available. Please generate the heatmap first.")
      }
      
      is_partner_mode <- values$heatmap_result$is_partner_mode %||% FALSE
      
      if (is_partner_mode) {
        # Partner mode: generate PDF with all anchor genes
        anchor_heatmaps <- values$heatmap_result$anchor_heatmaps
        if (is.null(anchor_heatmaps) || length(anchor_heatmaps) == 0) {
          stop("No anchor heatmaps available for PDF generation.")
        }
        
        # Open PDF device
        pdf(file, 
            width = values$heatmap_result$params$width %||% 20,
            height = values$heatmap_result$params$height %||% 12)
        
        # Draw each anchor gene's heatmap
        for (i in seq_along(anchor_heatmaps)) {
          anchor_data <- anchor_heatmaps[[i]]
          draw_heatmaps_to_device(anchor_data)
          
          # Add new page if not the last one
          if (i < length(anchor_heatmaps)) {
            grid.newpage()
          }
        }
        
        # Close device
        dev.off()
        cat("PDF created with", length(anchor_heatmaps), "anchor gene heatmaps:", file, "\n")
      } else {
        # Regular/rubric mode: generate PDF from single plot object
        if (is.null(values$heatmap_result$plot_objects)) {
          stop("Heatmap data not available. Please generate the heatmap first.")
        }
        
        generate_pdf_from_objects(values$heatmap_result$plot_objects, file)
      }
    }
  )
}

# Run the application
shinyApp(ui = ui, server = server)

