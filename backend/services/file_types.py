"""
Supported file types for indexing.
"""

# Document formats
SUPPORTED_DOCUMENTS = {
    '.pdf',    # PDF documents
    '.docx',   # Word documents
    '.xlsx',   # Excel spreadsheets
    '.xls',    # Legacy Excel
    '.pptx',   # PowerPoint presentations
}

# Text and code formats
SUPPORTED_TEXT_FORMATS = {
    '.txt', '.md', '.markdown', '.rst',
    '.json', '.yaml', '.yml', '.toml', '.xml', '.csv',
    '.log', '.ini', '.cfg', '.conf', '.env',
}

# Programming languages
SUPPORTED_CODE_FORMATS = {
    # Web
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',

    # Backend
    '.py', '.pyw', '.pyx',
    '.java', '.kt', '.scala', '.groovy',
    '.rb', '.rake', '.gemspec',
    '.php', '.phtml',
    '.go',
    '.rs',
    '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx',
    '.cs',
    '.swift',
    '.m', '.mm',
    '.lua',
    '.r',
    '.sql',
    '.sh', '.bash', '.zsh', '.fish',
    '.ps1', '.psm1',
    '.bat', '.cmd',

    # Data/Config
    '.graphql', '.proto',
    '.dockerfile', '.dockerignore',
    '.gitignore', '.gitattributes',
    '.editorconfig',

    # Other
    '.tex', '.bib',
}

# All supported extensions
SUPPORTED_EXTENSIONS = SUPPORTED_DOCUMENTS | SUPPORTED_TEXT_FORMATS | SUPPORTED_CODE_FORMATS


def is_supported_file(filename: str) -> bool:
    """Check if a file is supported for indexing based on its extension."""
    if not filename:
        return False

    # Get file extension (lowercase)
    _, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
    ext = f'.{ext.lower()}' if ext else ''

    return ext in SUPPORTED_EXTENSIONS


def get_file_category(filename: str) -> str:
    """Get the category of a file (document, text, code, or unsupported)."""
    if not filename:
        return 'unsupported'

    _, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
    ext = f'.{ext.lower()}' if ext else ''

    if ext in SUPPORTED_DOCUMENTS:
        return 'document'
    elif ext in SUPPORTED_TEXT_FORMATS:
        return 'text'
    elif ext in SUPPORTED_CODE_FORMATS:
        return 'code'
    else:
        return 'unsupported'
