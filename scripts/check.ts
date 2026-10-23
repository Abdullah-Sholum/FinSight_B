import * as m from "../src/lib/validation/import-row";

const inner = (m as any).default;
console.log("tipe default:", typeof inner);
console.log("isi default:", inner ? Object.keys(inner) : inner);