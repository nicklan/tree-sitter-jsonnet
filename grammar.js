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
      $.string,
      $.number,
      $.object,
      $.array,
      $.bindexpr, 
      $.import,
      $.functiondef,
    ),
    
    null: $ => "null",
    true: $ => "true",
    false: $ => "false",
    self: $ => "self",
    outer: $ => "$",

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

    number: $ => seq(
      choice("0", seq(/[1-9]/, /\d*/)),
      optional(seq(".", /\d*/)),
      optional(seq(/[eE]/, optional(/[-+]/), /\d+/))
    ),
    
    object: $ => seq("{", optTrailingCommaSep($.member), "}"),

    member: $ => choice(
      // $.objlocal,
      // $.assert,
      $.field
    ),

    // need to add '+' and the (params) forms
    field: $ => seq($.fieldname, $.hsep, $.value),

    fieldname: $ => choice(
      $.string,
      $.id,
      seq("[", $.expr, "]"),
    ),

    hsep: $ => /:{1,3}/,
    
    value: $ => $._expr,

    array: $ => seq("[", optTrailingCommaSep($.expr), "]"),

    import: $ => seq(choice(
      "import",
      "importstr",
      "importbin",
    ), $.string),

    bindexpr: $ => seq("local", seq($.bind, repeat(seq(",", $.bind)), ";", $.expr)),

    bind: $ => choice(
      seq($.id, "=", $.expr),
      // need other form
    ),

    functiondef: $ => seq(
      "function",
      "(",
      field("params", optTrailingCommaSep($.param)),
      ")",
      $.expr
    ),

    param: $ => seq($.id, optional(seq("=", $.expr))),
  }
});

function trailingCommaSep(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","))
}

function optTrailingCommaSep(rule) {
  return optional(trailingCommaSep(rule))
}
