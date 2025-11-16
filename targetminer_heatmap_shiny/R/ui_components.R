#' UI Components
#' 
#' Functions for creating UI components based on mode and configuration

#' Create input files UI based on mode
#' @param mode Current mode (regular, rubric, partner)
#' @param config Configuration list
#' @return Shiny UI elements
create_input_files_ui <- function(mode, config) {
  if (mode == "regular") {
    return(
      tagList(
        # Toggle between file upload and paste
        radioButtons(
          "gene_input_method",
          "Gene List Input Method",
          choices = list(
            "Upload File" = "file",
            "Paste Genes" = "paste"
          ),
          selected = "paste",
          inline = TRUE
        ),
        
        # File upload option
        conditionalPanel(
          condition = "input.gene_input_method == 'file'",
          fileInput(
            "gene_list_file",
            "Gene List File",
            accept = c(".txt", ".csv", ".tsv"),
            placeholder = "Select gene list file"
          ),
          p("Text file with one gene symbol per line", class = "text-muted small")
        ),
        
        # Paste option
        conditionalPanel(
          condition = "input.gene_input_method == 'paste'",
          textAreaInput(
            "gene_list_paste",
            "Paste Gene List",
            placeholder = "TP53\nBRCA1\nBRCA2\nEGFR\nMYC\n...",
            rows = 8,
            resize = "vertical"
          ),
          p("One gene symbol per line (HGNC format)", class = "text-muted small")
        )
      )
    )
  } else if (mode == "rubric") {
    return(
      tagList(
        fileInput(
          "rubric_file",
          "Rubric Excel File",
          accept = c(".xlsx", ".xls"),
          placeholder = "Select rubric Excel file"
        ),
        p("Excel file with rubric scores (must contain 'Summary' sheet)", 
          class = "text-muted small")
      )
    )
  } else if (mode == "partner") {
    return(
      tagList(
        fileInput(
          "partner_file",
          "Anchor Partner Excel File",
          accept = c(".xlsx", ".xls"),
          placeholder = "Select anchor partner Excel file"
        ),
        p("Excel file with anchor-partner pairs (must contain 'Summary' sheet)", 
          class = "text-muted small")
      )
    )
  }
}

#' Create parameters UI based on mode
#' @param mode Current mode
#' @return Shiny UI elements
create_parameters_ui <- function(mode) {
  tagList(
    # GTEx file is loaded from default location (not shown to user)
    # TCGA RDS file is also loaded from default location (not shown to user)
    p("Data files loaded from default locations", class = "text-muted small"),
    
    # Top N (for rubric and partner modes)
    if (mode %in% c("rubric", "partner")) {
      numericInput(
        "topn",
        "Top N Genes",
        value = ifelse(mode == "rubric", 35, 30),
        min = 1,
        max = 200,
        step = 1
      )
    },
    
    # Output filename
    textInput(
      "output_filename",
      "Output Filename",
      value = paste0("heatmap_", format(Sys.time(), "%Y%m%d_%H%M%S"), ".pdf"),
      placeholder = "output.pdf"
    )
  )
}

#' Create advanced options UI
#' @return Shiny UI elements
create_advanced_options_ui <- function() {
  tagList(
    # Chart title
    textInput(
      "chart_title",
      "Chart Title",
      value = "",
      placeholder = "Optional custom title"
    ),
    
    # Collapse GTEx tissues
    checkboxInput(
      "collapse_gtex_tissues",
      "Collapse GTEx Tissues",
      value = TRUE
    ),
    
    # Rubric z-score normalization
    checkboxInput(
      "rubric_zscore",
      "Z-score Normalize Rubric Scores",
      value = FALSE
    ),
    
    # TCGA RDS file is loaded from default location (not shown to user)
    # Removed from UI - uses default from config
    
    # Gene annotation - file or paste
    radioButtons(
      "annotation_input_method",
      "Gene Annotation Input",
      choices = list(
        "Upload File" = "file",
        "Paste Data" = "paste"
      ),
      selected = "file",
      inline = TRUE
    ),
    
    conditionalPanel(
      condition = "input.annotation_input_method == 'file'",
      fileInput(
        "gene_annotation_file",
        "Gene Annotation File (optional)",
        accept = c(".tsv", ".csv"),
        placeholder = "Select annotation file"
      )
    ),
    
    conditionalPanel(
      condition = "input.annotation_input_method == 'paste'",
      textAreaInput(
        "gene_annotation_paste",
        "Paste Gene Annotations (TSV/CSV format)",
        placeholder = "Gene\tGroup\nTP53\tTumor Suppressor\nBRCA1\tDNA Repair\n...",
        rows = 6,
        resize = "vertical"
      ),
      p("Tab or comma-separated: Gene, Group", class = "text-muted small")
    ),
    
    # Synonyms file
    fileInput(
      "synonyms_file",
      "Gene Synonyms File (optional)",
      accept = c(".txt", ".tsv", ".csv"),
      placeholder = "Select synonyms file"
    ),
    
    # Box genes
    textInput(
      "box_genes",
      "Box Genes (comma-separated)",
      value = "",
      placeholder = "e.g., GENE1,GENE2,GENE3"
    ),
    
    # Highlight cohorts
    textInput(
      "highlight_cohorts",
      "Highlight Cohorts (comma-separated)",
      value = "",
      placeholder = "e.g., LUAD,LUSC"
    ),
    
    # Highlight tissues
    textInput(
      "highlight_tissues",
      "Highlight Tissues (comma-separated)",
      value = "",
      placeholder = "e.g., Lung,Brain"
    ),
    
    # Dimensions
    fluidRow(
      column(6,
        numericInput(
          "width",
          "Width (inches)",
          value = 20,
          min = 10,
          max = 50,
          step = 1
        )
      ),
      column(6,
        numericInput(
          "height",
          "Height (inches)",
          value = 12,
          min = 6,
          max = 30,
          step = 1
        )
      )
    )
  )
}

