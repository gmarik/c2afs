// Author version: https://github.com/keleshev/compiling-to-assembly-from-scratch/blob/main/part-1/compiler.ts

let puts = console.log

const jstr = (v:any):string => {
  if (v instanceof ParseResult) {
    if ((v.value instanceof Object) && typeof v.value['equals'] === 'function') {
      return JSON.stringify({...v, value: [v.value.constructor.name, v.value]})
    }
  }
  return JSON.stringify(v)
}
const fail   = (have:any, want:any, msg:string = "") => {
  let q = (v:any):string => {
    if (typeof v  === "undefined" || v === null) { return v; }
    if (typeof v  === "string") { return v; }
    return jstr(v);
  }
  
  puts(new Error(`${msg}\nhave: ${q(have)}\nwant: ${q(want)}\n`));
}
const deepEqual = (a:any, b:any):boolean => { return jstr(a) === jstr(b) }
const assert = (have:any, want:any, msg:string = "") => { if (!deepEqual(have, want)) fail(have, want, msg) }
const refute = (have:any, want:any, msg:string = "") => { if ( deepEqual(have, want)) fail(have, want, msg) }


let tests = Array<[string,()=>void]>()
const test = (name: string, callback: () => void) => tests.push([name, callback]);

let runTests = () => {
  tests.forEach((v, i) => {
    let [n, c] = v
    puts(n)
    c()
  })
}

export interface Parser<T> {
  parse(src: Source): ParseResult<T> | null;
}

export class ParseResult<T> {
  constructor(
    public value: T,
    public source: Source) { }
}

export class Source {
  constructor(
    public string: string,
    public index: number) { }

  match(re: RegExp): (ParseResult<string> | null) {
    console.assert(re.sticky);
    re.lastIndex = this.index;
    let match = this.string.match(re);
    if (!match) return null;
    let m = match[0];
    let newIndex = this.index + m.length;
    return new ParseResult(m, new Source(this.string, newIndex));
  }
}

export class Parser<T> {
  constructor(public parse: (src: Source) => (ParseResult<T> | null)) { }

  parseStringToCompletion(str: string): T | Error {
    let src = new Source(str, 0)
    let r = this.parse(src)
    if (!r) { return Error(`Parse error at index 0`) }

    let index = r.source.index;
    if (index != r.source.string.length) { throw Error("Parse error at index " + index); }

    return r.value;
  }

  static regexp(regexp: RegExp): Parser<string> {
    return new Parser((src) => src.match(regexp));
  }

  static constant<U>(value: U): Parser<U> {
    return new Parser(source => new ParseResult(value, source));
  }

  static error<U>(msg: string): Parser<U> {
    // Explore: A better implementation of the error combinator would inspect the source,
    // convert the source index into a line-column pair, and display it together
    // with the offending line and some context.
    return new Parser(() => { throw Error(msg) })
  }

  or(p:Parser<T>): Parser<T> {
    return new Parser((src: Source) => {
      let pr = this.parse(src)
      if (pr) {
        return pr
      }
      return p.parse(src);
    })
  }

  static zeroOrMore<U>(p: Parser<U>): Parser<Array<U>> {
    return new Parser(src => {
      let a = []
      let m
      while (m = p.parse(src)) {
        src = m.source
        a.push(m.value)
      }
      return new ParseResult(a, src)
    })
  }

  bind<U>(callback: (value: T) => Parser<U>): Parser<U> {
    return new Parser(src => {
      let m = this.parse(src)
      if (!m) { return null }
      return callback(m.value).parse(m.source)
    })
  }

  and<U>(parser: Parser<U>): Parser<U> {
    return this.bind((_) => parser);
  }

  map<U>(callback: (t:T) => U): Parser<U> {
    // NOTE: damn this is confusing
    return this.bind((v) => Parser.constant(callback(v)));
  }

  static maybe<U>(p: Parser<U | null>): Parser<U | null> {
    // src/compiler.ts:110:22 - error TS2345: Argument of type 'Parser<null>' is not assignable to parameter of type 'Parser<U>'.
    //   Type 'null' is not assignable to type 'U'.
    //     'U' could be instantiated with an arbitrary type which could be unrelated to 'null'.

    //      return parser.or(Parser.constant(null))
    //                       ~~~~~~~~~~~~~~~~~~~~~
    // adding `null` to `p: Parser<U>` so it compiles
    return p.or(Parser.constant(null))
  }
}

function parse<U>(s:string, p: Parser<U>): (ParseResult<U>|null) {
  return p.parse(new Source(s, 0))
}

test("Source: idempotent matches", () => {
  let src = new Source('  let', 2)
  let result1 = src.match(/let/y);
  assert(jstr(result1), `{"value":"let","source":{"string":"  let","index":5}}`);

  let result2 = src.match(/let/y);
  assert(jstr(result2), `{"value":"let","source":{"string":"  let","index":5}}`);
})

test("Source.match: advances index", () => {
  let src = new Source('  let', 2)
  let re = /let/y
  let r = src.match(re)!.source.match(re);
  assert(r, null);
})

test("Parser.regex: sticky regex fails to parse from the index", () => {
  let r = parse("hi hello1 bye2", Parser.regexp(/hello[0-9]/y))
  assert(r, null)
})

test("Parser.regex: delegates to Source.match", () => {
  let r = parse("hello1 bye2", Parser.regexp(/hello[0-9]/y))
  assert(jstr(r), `{"value":"hello1","source":{"string":"hello1 bye2","index":6}}`)
})

test("Parser.constant: delegates to Source.match", () => {
  let r = parse("hi", Parser.constant("OK"))
  assert(jstr(r), `{"value":"OK","source":{"string":"hi","index":0}}`)
})

test("Parser.error: throws an error", () => {
  try {
    parse("hi", Parser.error("oops"))
    fail(null, null, "error expected")
  } catch(e) {
    assert(e.message, "oops")
  }
})

test("Parser#or: choice parser", () => {
  let r = parse("hello world", Parser.regexp(/world/y).or(Parser.regexp(/hello/y)))
  assert(jstr(r), `{"value":"hello","source":{"string":"hello world","index":5}}`)
})

test("Parser.zeroOrMore:", () => {
  let r = parse("12345 hello", Parser.zeroOrMore(Parser.regexp(/\d/y)))
  assert(jstr(r), `{"value":["1","2","3","4","5"],"source":{"string":"12345 hello","index":5}}`)
})

test("Parser.bind:", () => {
  let r =  parse("12345 hello", Parser.zeroOrMore(Parser.regexp(/\d/y)).bind((v) => {
    assert(v, ["1", "2", "3", "4", "5"])
    return Parser.constant(v)
  }))
  assert(jstr(r), `{"value":["1","2","3","4","5"],"source":{"string":"12345 hello","index":5}}`)
})

test("Parser.and:", () => {
  // NOTE: spaces aren't ignored
  // NOTE: returns the last match as every match needs to be captured
  let r =  parse("12345hello", Parser.regexp(/\d+/y).and(Parser.regexp(/\w+/y)))
  assert(jstr(r), `{"value":"hello","source":{"string":"12345hello","index":10}}`)
})

test("Parser.map:", () => {
  let r =  parse("12", Parser.regexp(/\d/y).map((v) => v))
  assert(jstr(r), `{"value":"1","source":{"string":"12","index":1}}`)
})

test("Parser.map: pair example", () => {
  let {regexp} = Parser
  let parser = regexp(/[0-9]+/y).
    bind((first) =>
      regexp(/,/y).
      and(regexp(/[0-9]+/y)).
      map((second) => [first, second])
    );
  let r = parse("1,2", parser)
  assert(jstr(r), `{"value":["1","2"],"source":{"string":"1,2","index":3}}`)
})

test("Parser.constant:", () => {
  let {maybe,regexp} = Parser
  let r =  parse("1", maybe(regexp(/\D/y)))
  assert(jstr(r), `{"value":null,"source":{"string":"1","index":0}}`)
})

test("Parser.parseStringToCompletion:", () => {
  let {regexp} = Parser
  // NOTE: returns the last value
  let v = regexp(/\d/y).and(regexp(/\w/y)).parseStringToCompletion("1b")
  assert(v, `b`)
})

//
// Chapter 6
//
const {regexp, zeroOrMore, constant} = Parser;

// In JavaScript regular expressions, the dot character matches any character,
// except newline. To implement multi-line comments, we need to match it as
// well. It is possible to alter the meaning of the dot regular expression to
// mean any character including newline by passing a “dot-all” flag s
const comments = regexp(/[/][/].*/y).or(regexp(/[/][*].*[*][/]/sy));
const whitespace = regexp(/[ \n\r\t]+/y);
const ignored = zeroOrMore(whitespace.or(comments));

let token = (pattern:RegExp) => regexp(pattern).bind((value) => ignored.and(constant(value)));

let FUNCTION = token(/function\b/y)
let IF = token(/if\b/y)
let ELSE = token(/else\b/y)
let RETURN = token(/return\b/y)
let VAR = token(/var\b/y)
let WHILE = token(/while\b/y)

let COMMA = token(/[,]/y);
let SEMICOLON = token(/;/y);
let LEFT_PAREN = token(/[(]/y);
let RIGHT_PAREN = token(/[)]/y);
let LEFT_BRACE = token(/[{]/y);
let RIGHT_BRACE = token(/[}]/y);

let INTEGER = token(/[0-9]+/y).map((digits) => new Integer(parseInt(digits)));
let ID = token(/[a-zA-Z_][a-zA-Z0-9_]*/y);
let id = ID.map((x) => new Id(x));
let NOT = token(/!/y).map((_) => Not);
let EQUAL = token(/==/y).map((_) => Equal);
let NOT_EQUAL = token(/!=/y).map((_) => NotEqual);
let PLUS = token(/[+]/y).map((_) => Add);
let MINUS = token(/[-]/y).map((_) => Subtract);
let STAR = token(/[*]/y).map((_) => Multiply);
let SLASH = token(/[/]/y).map((_) => Divide);

test("ignored:", () => {
  // NOTE: returns the last value
  let v = parse("   /* comments */ not ignored", ignored)
  assert(jstr(v), `{"value":["   ","/* comments */"," "],"source":{"string":"   /* comments */ not ignored","index":18}}`)
})

test("token: ignores on the RHS", () => {
  let v = parse("   /* comments */ let ", token(/let\b/y))
  assert(v, null)
})

test("token: consumes on the LHS", () => {
  let v = parse("let    /* comments */ ", token(/let\b/y))
  assert(jstr(v), `{"value":"let","source":{"string":"let    /* comments */ ","index":22}}`)
})

test("token: FUNCTION", () => {
  let v = parse("function   /* comments */ ", FUNCTION)
  assert(jstr(v), `{"value":"function","source":{"string":"function   /* comments */ ","index":26}}`)
})
test("token: IF", () => {
  let v = parse("if   /* comments */ ", IF)
  assert(jstr(v), `{"value":"if","source":{"string":"if   /* comments */ ","index":20}}`)
})
test("token: ELSE", () => {
  let v = parse("else   /* comments */ ", ELSE)
  assert(jstr(v), `{"value":"else","source":{"string":"else   /* comments */ ","index":22}}`)
})
test("token: RETURN", () => {
  let v = parse("return   /* comments */ ", RETURN)
  assert(jstr(v), `{"value":"return","source":{"string":"return   /* comments */ ","index":24}}`)
})
test("token: VAR", () => {
  let v = parse("var   /* comments */ ", VAR)
  assert(jstr(v), `{"value":"var","source":{"string":"var   /* comments */ ","index":21}}`)
})
test("token: WHILE", () => {
  let v = parse("while   /* comments */ ", WHILE)
  assert(jstr(v), `{"value":"while","source":{"string":"while   /* comments */ ","index":23}}`)
})


test("token: INTEGER", () => {
  let v = parse("1234", INTEGER)
  assert(jstr(v), `{"value":["Integer",{"value":1234}],"source":{"string":"1234","index":4}}`)
})

//
// Chapter 4: AST
//

interface AST { 
  // TYPO: missed arg name
  equals(ast: AST): boolean;
}

class Integer implements AST {
  constructor(public value: number) {}
  // TYPO: missed boolean
  equals(other: AST): boolean {
    return true
  }
}

class Id implements AST {
  constructor(public value: string) { }
  equals(other: AST): boolean { 
    return other instanceof Id &&
      this.value === other.value;
  }
}

class Not implements AST {
  constructor(public term: AST) {}
  equals(other: AST):boolean {
    return other instanceof Not &&
      this.term.equals(other.term)
  }
}

class Equal implements AST {
  constructor(public left: AST, public right: AST) {} 
  equals(other: AST):boolean {
    return other instanceof Equal &&
      this.left.equals(other.left) &&
      this.right.equals(other.right)
  }
}
class NotEqual implements AST {
  constructor(public left: AST, public right: AST) {}
  equals(other: AST):boolean {
    return other instanceof NotEqual &&
      this.left.equals(other.left) &&
      this.right.equals(other.right)
  }
}

class Add implements AST {
  constructor(public left: AST, public right: AST) {}
  equals(other: AST):boolean {
    return other instanceof Add &&
      this.left.equals(other.left) &&
      this.right.equals(other.right)
  }
}
class Subtract implements AST { 
  constructor(public left: AST, public right: AST) {}
  equals(other: AST):boolean {
    return other instanceof Subtract &&
      this.left.equals(other.left) &&
      this.right.equals(other.right)
  }
}
class Multiply implements AST {
  constructor(public left: AST, public right: AST) {}
  equals(other: AST):boolean {
    return other instanceof Multiply &&
      this.left.equals(other.left) &&
      this.right.equals(other.right)
  }
}
class Divide implements AST {
  constructor(public left: AST, public right: AST) {}
  equals(other: AST):boolean {
    return other instanceof Divide &&
      this.left.equals(other.left) &&
      this.right.equals(other.right)
  }
}

class Call implements AST {
  constructor(public callee: string, public args: Array<AST>) {} 
  equals(other: AST):boolean {
    return other instanceof Call &&
      this.callee === other.callee &&
      this.args.length === other.args.length &&
      this.args.every((arg, i) => arg.equals(other.args[i])); 
  }
}

class Return implements AST {
  constructor(public term: AST) {}
  equals(other: AST):boolean {
    return other instanceof Return
      && this.term.equals(other.term)
  }
}

class Block implements AST {
  constructor(public statements: Array<AST>) {}
  equals(other: AST):boolean {
    if (!(other instanceof Block)) return false
    if (!(this.statements.length === other.statements.length)) return false

    for(let i in this.statements) {
      if (!this.statements[i].equals(other.statements[i])) return false
    }
    return true
  }
}

class If implements AST { 
  constructor(
    public conditional: AST,
    public consequence: AST, 
    public alternative: AST) {}

  equals(other: AST):boolean {
    return other instanceof If && 
      this.conditional.equals(other.conditional) &&
      this.consequence.equals(other.consequence) &&
      this.alternative.equals(other.alternative)
  } 
}

class Function implements AST {
  constructor(
    public name: string,
    public parameters: Array<string>,
    public body: AST) {}

  equals(other: AST):boolean {
    return other instanceof Function &&
      this.name === other.name &&
      this.parameters.length == other.parameters.length &&
      this.parameters.every((e, i) => e === other.parameters[i]) &&
      this.body.equals(other.body)
   }
}

class Var implements AST {
  constructor(public name: string, public value: AST) {}

  equals(other: AST):boolean {
    return other instanceof Var &&
      this.name === other.name &&
      this.value.equals(other.value)
  }
}


class Assign implements AST {
  constructor(public name: string, public value: AST) {}

  equals(other: AST):boolean {
    return other instanceof Assign &&
      this.name === other.name &&
      this.value.equals(other.value)
  }
}

class While implements AST {
  constructor(public conditional: AST, public body: AST) {}

  equals(other: AST):boolean {
    return other instanceof While &&
      this.conditional.equals(other.conditional) &&
      this.body.equals(other.body)
  }
}

runTests()
