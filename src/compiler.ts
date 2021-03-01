// Author version: https://github.com/keleshev/compiling-to-assembly-from-scratch/blob/main/part-1/compiler.ts

let puts = console.log

const jstr = JSON.stringify
const fail   = (have:any, want:any, msg:string = "") => {
  let q = (v:any):string => {
    if (typeof v  === "undefined" || v === null) { return v; }
    if (typeof v  === "string") { return v; }
    return JSON.stringify(v); 
  }
  
  puts(new Error(`${msg}\nhave: ${q(have)}\nwant: ${q(want)}\n`));
}
const assert = (have:any, want:any, msg:string = "") => { if (want !== have) fail(have, want, msg) }
const refute = (have:any, want:any, msg:string = "") => { if (want === have) fail(have, want, msg) }

const test = (name: string, callback: () => void) => callback();

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

test("Source: idempotent matches", () => {
  let src = new Source('  let', 2)
  let result1 = src.match(/let/y);
  assert(JSON.stringify(result1), `{"value":"let","source":{"string":"  let","index":5}}`);

  let result2 = src.match(/let/y);
  assert(JSON.stringify(result2), `{"value":"let","source":{"string":"  let","index":5}}`);
})

test("Source.match: advances index", () => {
  let src = new Source('  let', 2)
  let re = /let/y
  let r = src.match(re)!.source.match(re);
  assert(r, null);
})

function parse<U>(s:string, p: Parser<U>): (ParseResult<U>|null) {
  return p.parse(new Source(s, 0))
}


export class Parser<T> {
  constructor(public parse: (src: Source) => (ParseResult<T> | null)) { }

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
}

test("Parser.regex: sticky regex fails to parse from the index", () => {
  let r = parse("hi hello1 bye2", Parser.regexp(/hello[0-9]/y))
  assert(r, null)
})

test("Parser.regex: delegates to Source.match", () => {
  let r = parse("hello1 bye2", Parser.regexp(/hello[0-9]/y))
  assert(JSON.stringify(r), `{"value":"hello1","source":{"string":"hello1 bye2","index":6}}`)
})

test("Parser.constant: delegates to Source.match", () => {
  let r = parse("hi", Parser.constant("OK"))
  assert(JSON.stringify(r), `{"value":"OK","source":{"string":"hi","index":0}}`)
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
  assert(JSON.stringify(r), `{"value":"hello","source":{"string":"hello world","index":5}}`)
})

test("Parser.zeroOrMore:", () => {
  let r = parse("12345 hello", Parser.zeroOrMore(Parser.regexp(/\d/y)))
  assert(JSON.stringify(r), `{"value":["1","2","3","4","5"],"source":{"string":"12345 hello","index":5}}`)
})
