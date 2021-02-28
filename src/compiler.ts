// Author version: https://github.com/keleshev/compiling-to-assembly-from-scratch/blob/main/part-1/compiler.ts

let puts = console.log

let fail   = (have:any, want:any, msg:string = "") => {
  let q = (v:any):string => {
    if (typeof v  === "string") {
      return v;
    }
    return JSON.stringify(v); 
  }
  
  puts(new Error(`${msg}\nhave: ${q(have)}\nwant: ${q(want)}\n`));
}
let assert = (have:any, want:any, msg:string = "") => { if (want !== have) fail(want, have, msg) }
let refute = (have:any, want:any, msg:string = "") => { if (want === have) fail(want, have, msg) }

let test = (name: string, callback: () => void) => callback();

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


