const PREC = {
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
}

module.exports = grammar({
  name: 'jsonnet',

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

    string: $ => choice(
      seq('"', '"'),
      seq('"', $._string_inner, '"')
    ),

    _string_inner: $ => repeat1(choice(
      token.immediate(prec(1, /[^\\"\n]+/)),
      $.escape_sequence
    )),

    escape_sequence: $ => token.immediate(seq(
      '\\',
      /(\"|\\|\/|b|f|n|r|t|u)/
    )),

    number: $ => token(seq(
      choice("0", seq(/[1-9]/, /\d*/)),
      optional(seq(".", /\d*/)),
      optional(seq(/[eE]/, optional(/[-+]/), /\d+/))
    )),

    object: $ => seq("{", optTrailingCommaSep($.member), "}"),

    member: $ => choice(
      $.objlocal,
      $.assert_expr,
      $.field
    ),

    objlocal: $ => seq("local", $.bind),

    // need to add '+' and the (params) forms
    field: $ => seq($.fieldname, $.hsep, $.value),

    fieldname: $ => choice(
      $.string,
      $.id,
      seq("[", $.expr, "]"),
    ),

    hsep: $ => /:{1,3}/,

    value: $ => $._expr,

    objadd: $ => prec.left(PREC.add, seq($._expr, $.object)),

    slice_expr: $ => prec.left(PREC.appindex, seq(
      $._expr,
      "[",
      field('start', $._expr),
      optional(
        seq(":", field('end', $._expr),
            optional(
              seq(":", field('inc', $._expr))
            )
           )
      ),
      "]"
    )),

    array: $ => seq("[", optTrailingCommaSep($.expr), "]"),

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

    index: $ => prec(PREC.appindex, seq($.expr, ".", $.id)),

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

    if_expr: $ => prec.left(
      PREC.keyword,
      seq('if', $._expr, 'then', $._expr, optional(seq('else', $._expr)))
    ),

    error_expr: $ => prec.left(PREC.keyword, seq("error", $._expr)),

    in_super_expr: $ => prec.left(PREC.insuper, seq($._expr, "in", "super")),

    assert_expr: $ => prec.left(PREC.keyword, seq("assert", $._expr, optional(seq(":", $._expr)))),
  }
});

function trailingCommaSep(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","))
}

function optTrailingCommaSep(rule) {
  return optional(trailingCommaSep(rule))
}
