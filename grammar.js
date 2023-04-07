const PREC = {
  paren: 15,
  appindex: 14,
  unary: 13,
  mult: 12,
  add: 11,
  shift: 10,
  comp: 9,
  insuper: 8, // in super and "in" as a binop need different prec
  compeq: 7,
  bitand: 6,
  bitxor: 5,
  bitor: 4,
  and: 3,
  or: 2,
  keyword: 1,
};

module.exports = grammar({
  name: 'jsonnet',

  extras: $ => [/\s/, $.line_comment, $.block_comment],

  externals: $ => [
    $.block_string,
  ],

  conflicts: $ => [
    [$.expr, $.comparray],
  ],

  rules: {
    source_file: $ => $.expr,

    expr: $ => $._expr,

    _expr: $ => choice(
      $.null,
      $.true,
      $.false,
      $.self,
      $.outer,
      $.super,
      $.string,
      $.number,
      $.object,
      $.objadd,
      $.slice_expr,
      $.array,
      $.comparray,
      $.id,
      $.bindexpr,
      $.import,
      $.functiondef,
      $.functionapp,
      $.index,
      $.unary_expr,
      $.binary_expr,
      $.if_expr,
      $.error_expr,
      $.in_super_expr,
      $.assert_expr,
      $.paren,
    ),

    null: $ => "null",
    true: $ => "true",
    false: $ => "false",
    self: $ => "self",
    outer: $ => "$",

    super: $ => choice(
      seq("super", ".", $.id),
      seq("super", "[", $._expr, "]")
    ),

    id: $ => /[_a-zA-Z][_a-zA-Z0-9]*/,

    paren: $ => prec.left(PREC.paren, seq('(', $._expr, ')')),

    string: $ => {
      const startdbl = choice('"', '@"');
      const startsngl = choice("'", "@'");
      return choice(
        seq('|||', $.block_string),
        seq(startdbl, optional($._string_inner_dbl), '"'),
        seq(startsngl, optional($._string_inner_sngl), "'"),
      );
    },

    _string_inner_dbl: $ => repeat1(choice(
      token.immediate(prec(1, /[^\\"]+/)),
      $._escaped
    )),

    _string_inner_sngl: $ => repeat1(choice(
      token.immediate(prec(1, /[^\\']+/)),
      $._escaped
    )),

    _escaped: $ => choice(
      $.escaped_char,
      $.unicode_escape,
    ),

    escaped_char: $ => token.immediate(seq(
      '\\',
      /(\"|\'|\\|\/|b|f|n|r|t)/
    )),

    unicode_escape: $ => token.immediate(seq(
      '\\u', /[0-9,a-f,A-F]{4}/
    )),

    line_comment: $ => token(seq(
      choice('//', '#'), /.*/
    )),

    block_comment: $ => token(seq(
      '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
      '/'
    )),

    number: $ => token(seq(
      choice("0", seq(/[1-9]/, /\d*/)),
      optional(seq(".", /\d*/)),
      optional(seq(/[eE]/, optional(/[-+]/), /\d+/))
    )),

    object: $ => choice(
      seq("{", "}"),
      seq(
        "{",
        trailingCommaSep($.member),
        "}"
      ),
    ),

    member: $ => choice(
      $.objlocal,
      $.assert,
      $.field
    ),

    objlocal: $ => seq("local", $.bind),

    field: $ => choice(
      prec.left(seq(
        $.fieldname,
        optional('+'),
        $.hsep,
        $.value,
        optional($.comprehension_tail),
      )),
      seq(
        $.fieldname,
        "(",
        optTrailingCommaSep($.param),
        ")",
        $.hsep,
        $.value
      )
    ),

    fieldname: $ => choice(
      $.string,
      $.id,
      seq("[", $._expr, "]"),
    ),

    hsep: $ => /:{1,3}/,

    value: $ => $._expr,

    comprehension_tail: $ => seq(
      repeat(seq(",", $.objlocal)),
      choice(
        'for',
        token(prec(1, /,\s*for\s/)) // ', for' should have precedence over ', $.field'
      ),
      $._forspec_rest,
      optional($.compspec),
    ),

    objadd: $ => prec.left(PREC.add, seq($._expr, $.object)),

    slice_expr: $ => prec.left(PREC.appindex, seq(
      $._expr,
      "[",
      field('start', $._expr),
      optional(
        seq(
          ":",
          optional(field('end', $._expr)),
          optional(seq(":", field('inc', $._expr)))
        )
      ),
      "]"
    )),

    array: $ => seq("[", optTrailingCommaSep($.expr), "]"),

    comparray: $=> seq(
      "[",
      $._expr,
      optional(","),
      $.forspec,
      optional($.compspec),
      "]",
    ),

    compspec: $ => repeat1(choice(
      $.forspec,
      $.ifspec
    )),

    forspec: $ => seq("for", $._forspec_rest),
    _forspec_rest: $ => seq($.id, "in", $._expr),

    ifspec: $ => seq("if", $._expr),

    import: $ => seq(choice(
      "import",
      "importstr",
      "importbin",
    ), $.string),

    bindexpr: $ => seq("local", seq($.bind, repeat(seq(",", $.bind)), ";", $.expr)),

    bind: $ => choice(
      seq($.id, "=", $.expr),
      seq(
        $.id,
        "(",
        field('params', optTrailingCommaSep($.param)),
        ")",
        "=",
        $.expr
      )
    ),

    functiondef: $ => seq(
      "function",
      "(",
      field("params", optTrailingCommaSep($.param)),
      ")",
      $.expr
    ),

    functionapp: $ => prec.left(PREC.appindex, seq(
      field('funcname', $._expr),
      "(",
      optional($.args),
      ")",
    )),

    args: $ => choice(
      seq(
        trailingCommaSep(field('arg', $._expr)),
        optTrailingCommaSep($.default_arg),
      ),
      trailingCommaSep($.default_arg),
    ),

    default_arg: $ => seq($.id, "=", $._expr),

    param: $ => seq($.id, optional(seq("=", $.expr))),

    index: $ => prec.left(PREC.appindex, seq($._expr, ".", $.id)),

    unary_expr: $ => prec(PREC.unary, choice(
      seq('+', $._expr),
      seq('-', $._expr),
      seq('!', $._expr),
      seq('~', $._expr),
    )),

    binary_expr: $ => {
      const table = [
        [PREC.mult, choice('*', '/', '%')],
        [PREC.add, choice('+', '-')],
        [PREC.shift, choice('<<', '>>')],
        [PREC.comp, choice('<', '>', '<=', '>=', 'in')],
        [PREC.compeq, choice('==', '!=')],
        [PREC.bitand, '&'],
        [PREC.bitxor, '^'],
        [PREC.bitor, '|'],
        [PREC.and, '&&'],
        [PREC.or, '||'],
      ];

      return choice(...table.map(([precedence, op]) => prec.left(precedence, seq(
        field('left', $._expr),
        field('op', op),
        field('right', $._expr)
      ))));
    },

    if_expr: $ => prec.right(
      PREC.keyword,
      seq(
        'if',
        field('condition_expr', $._expr),
        'then',
        field('true_expr', $._expr),
        optional(
          seq(
            'else',
            field('else_expr', $._expr),
          )
        )
      )
    ),

    error_expr: $ => prec.left(PREC.keyword, seq("error", $._expr)),

    in_super_expr: $ => prec.left(PREC.insuper, seq($._expr, "in", "super")),

    assert: $ => seq(
      "assert",
      field('assertion', $._expr),
      optional(field('message', seq(":", $._expr))),
    ),

    assert_expr: $ => prec.left(
      PREC.keyword,
      seq(
        $.assert,
        ';',
        $._expr
      )
    ),
  }
});

function trailingCommaSep(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","));
}

function optTrailingCommaSep(rule) {
  return optional(trailingCommaSep(rule));
}
