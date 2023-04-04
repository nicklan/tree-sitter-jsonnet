#include <tree_sitter/parser.h>
#include <wctype.h>


enum TokenType {
  BLOCK_STRING,
};

// we need a limit on how much space we will allocate to store leading space
static size_t MAX_LEADING_SPACE = 4096;

void *tree_sitter_jsonnet_external_scanner_create() { return NULL; }
void tree_sitter_jsonnet_external_scanner_destroy(void *p) {}
void tree_sitter_jsonnet_external_scanner_reset(void *p) {}
unsigned tree_sitter_jsonnet_external_scanner_serialize(void *p, char *buffer) { return 0; }
void tree_sitter_jsonnet_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

static bool is_space_not_newline(int32_t c) {
  return c != '\n' && iswspace(c);
}

// skip forward to a newline. returns true if newline was found, false if hit eof
static bool skip_to_next_line(TSLexer *lexer) {
  while(lexer->lookahead != '\n') {
    if (lexer->eof(lexer)) {
      return false;
    }
    lexer->advance(lexer, false);
  }
  // lookahead must be '\n' here, advance past it and return true
  lexer->advance(lexer, false);
  return true;
}

static bool line_starts_with(int32_t* leading, TSLexer *lexer) {
  size_t pos = 0;
  while(leading[pos] != '\0') {
    if (leading[pos] != lexer->lookahead) {
      return false;
    } else {
      lexer->advance(lexer, false);
      pos++;
    }
  }
  return true;
}

static unsigned bar_count(TSLexer *lexer) {
  unsigned bar_count = 0;
  while(lexer->lookahead == '|') {
    lexer->advance(lexer, false);
    bar_count++;
  }
  return bar_count;
}

bool tree_sitter_jsonnet_external_scanner_scan(void *payload, TSLexer *lexer,
                                               const bool *valid_symbols) {
  if (valid_symbols[BLOCK_STRING]) {
    // this means the scanner saw |||, so we just have to scan forward following the block string
    // rules. must start with 3 |s, optional whitespace, and then a newline
    while (is_space_not_newline(lexer->lookahead)) lexer->advance(lexer, true);

    if (lexer->lookahead != '\n') {
      // three |s but not followed by space + newline
      return false;
    }
    lexer->advance(lexer, true);

    // we need to skip any truely empty lines (i.e. just \n)
    while(lexer->lookahead == '\n') {
      lexer->advance(lexer, false);
    }

    // now we have a line that isn't just newlines, so now store the leading indent
    size_t cur_w_space = 32;
    unsigned cur_w_pos = 0;
    int32_t* leading_whitespace = malloc(sizeof(int32_t) * cur_w_space);

    while (is_space_not_newline(lexer->lookahead)) {
      if ((cur_w_pos+1) >= cur_w_space) {
        if (cur_w_space < MAX_LEADING_SPACE) {
          int32_t* new_leading_whitespace = realloc(
            leading_whitespace,
            sizeof(int32_t) * cur_w_space * 2);
          if (new_leading_whitespace == NULL) {
            free(leading_whitespace);
            return false;
          } else {
            leading_whitespace = new_leading_whitespace;
          }
          cur_w_space *= 2;
        } else {
          // not enough space, must be a very odd file
          free(leading_whitespace);
          return false;
        }
      }
      leading_whitespace[cur_w_pos++] = lexer->lookahead;
      lexer->advance(lexer, false);
    }

    // advance past the \n
    if (!skip_to_next_line(lexer)) {
      // must have hit eof
      free(leading_whitespace);
      return false;
    }

    // now leading_whitespace holds whatever we have to match to "keep going"
    leading_whitespace[cur_w_pos] = '\0'; // null term it so we can compare later

    for (;;) {
      // skip over fully blank lines
      if (lexer->lookahead == '\n') {
        lexer->advance(lexer, false);
        continue;
      }

      // at start of a line, check if we have W spaces
      if (line_starts_with(leading_whitespace, lexer)) {
        // line is 'in' the string, scan forward to start of next line
        if (!skip_to_next_line(lexer)) {
          free(leading_whitespace);
          return false;
        }
      } else {
        // we've got space not equal to the block indent, so now it HAS to end with |||
        // strip optional whitespace
        while(is_space_not_newline(lexer->lookahead)) {
          lexer->advance(lexer, false);
        }
        free(leading_whitespace);
        if (bar_count(lexer) == 3) {
          lexer->result_symbol = BLOCK_STRING;
          return true;
        } else {
          return false;
        }
      }
    }
  }
  return false;
}

