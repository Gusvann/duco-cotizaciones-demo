// Local board geometry/base reference. Does not create purchases or process costs.
export function createBoardCalculator(){
  const dec=(s,digits=6,max=1000000)=>{
    if(typeof s!=='string'||s.length>40||!new RegExp('^\\d+(?:\\.\\d{1,'+digits+'})?$').test(s))return null;
    const [a,b='']=s.split('.'),n=BigInt(a+b),d=10n**BigInt(b.length);return n<=BigInt(max)*d?{n,d}:null;
  };
  const mul=(a,b)=>a&&b?{n:a.n*b.n,d:a.d*b.d}:null;
  const div=(a,b)=>a&&b&&b.n?{n:a.n*b.d,d:a.d*b.n}:null;
  const add=(a,b)=>a&&b?{n:a.n*b.d+b.n*a.d,d:a.d*b.d}:null;
  const v=n=>({n:BigInt(n),d:1n});
  const text=(a,digits=6)=>{if(!a)return null;const scale=10n**BigInt(digits),n=(a.n*scale*2n+a.d)/(a.d*2n);return String(n/scale)+(n%scale?'.'+String(n%scale).padStart(digits,'0').replace(/0+$/,''):'');};
  return Object.freeze({calculate(material={},basis={},articleQuantity='1'){
    const q=dec(material.quantity),w=dec(material.width),l=dec(material.length),unit={cm:100n,mm:1000n,m:1n}[material.lengthUnit];
    const area=unit?div(mul(mul(q,w),l),v(unit*unit)):null;
    const sheet=dec(basis.sheetAreaM2),waste=dec(basis.wasteRate,3,1000),price=dec(material.unitPrice,2,100000000);
    const amount=mul(div(mul(area,price),sheet),waste?add(v(1),div(waste,v(100))):null);
    const cents=a=>!a||a.n>100000000n*a.d?null:String((a.n*200n+a.d)/(a.d*2n));
    return {areaM2:text(area),unitCents:cents(amount),totalCents:cents(mul(amount,dec(articleQuantity,3,100000))),financialConfirmed:false};
  }});
}
