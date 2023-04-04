#include <tree_sitter/parser.h>
#include <wctype.h>


enum TokenType {
  BLOCK_STRING,
};

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

static unsigned count_spaces(TSLexer *lexer) {
  unsigned count = 0;
  while (is_space_not_newline(lexer->lookahead)) {
    lexer->advance(lexer, false);
    count++;
  }
  return count;
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
    // this means the scanner saw |||, so we just have to scan forward following the block string rules
    unsigned b_count = bar_count(lexer);
    printf("checking at %i\n", lexer->get_column(lexer));
    printf("got b_count: %u (%c)\n", b_count, lexer->lookahead);
    if (b_count == 3) {
      printf("HERE\n");
      // must start with 3 |s, optional whitespace, and then a newline
      while (is_space_not_newline(lexer->lookahead)) lexer->advance(lexer, true);

      if (lexer->lookahead != '\n') {
        // three |s but not followed by space + newline
        return false;
      }
      lexer->advance(lexer, true);

      unsigned W_len = 0;
      while (iswspace(lexer->lookahead)) {
        if (lexer->lookahead == '\n') {
          // newline, reset W_len
          W_len = 0;
          lexer->advance(lexer, false);
        } else {
          W_len++;
          lexer->advance(lexer, false);
        }
      }
      // now W_len holds our space indent
      printf("made it here w_len: %u\n", W_len);

      for (;;) {
        if (!skip_to_next_line(lexer)) {
          return false;
        }
        // at start of next line, check if we have W spaces
        unsigned leading = count_spaces(lexer);
        if (leading != W_len) {
          // we've skipped spaces not equal to the block indent, so now it HAS to end with |||
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
}
