/* The public catalogue is a closed list of presentation data and local illustration paths. */
(() => {
  'use strict';
  const {products,rows,assets}=globalThis.DemoPublicRecipes;
  const byId=id=>document.getElementById(id);
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const list=byId('products'), selector=byId('variant');
  let currentProduct, currentVariant;
  for(const family of new Set(products.map(product=>product.family)))byId('family').add(new Option(family,family));
  function showPhoto() {
    const row=rows.find(candidate=>candidate.id===selector.value);
    if(!row)return;
    currentVariant=row.id;
    const photo=byId('photo');
    photo.alt=row.description; photo.src=assets[row.id].url;
    byId('caption').textContent='Imagen ilustrativa generada con IA'+(row.illustratedTone?' · Tono ilustrado: '+row.illustratedTone:'');
    byId('dimensions').textContent=['Largo','Ancho','Alto'].map(field=>row.finishedSpecs[field]).join(' × ')+' cm';
    byId('material').textContent=row.materialsLabel;
  }
  function selectProduct(product,variants) {
    currentProduct=product.id;
    for(const button of list.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.product===product.id));
    byId('detail').hidden=false; byId('name').textContent=product.name;
    selector.replaceChildren(...variants.map(row=>new Option(row.variant,row.id)));
    if(variants.some(row=>row.id===currentVariant))selector.value=currentVariant;
    showPhoto();
  }
  function filter() {
    const query=normalize(byId('search').value),family=byId('family').value;
    const matches=[];
    for(const product of products) {
      if(family&&product.family!==family)continue;
      const variants=rows.filter(row=>row.productId===product.id&&normalize([product.name,product.family,row.variant,row.materialsLabel].join(' ')).includes(query));
      if(variants.length)matches.push({product,variants});
    }
    const buttons=matches.map(({product,variants})=>{
      const li=document.createElement('li'),button=document.createElement('button'),img=document.createElement('img');
      const words=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');
      img.alt=''; img.loading='lazy'; img.decoding='async'; img.src=assets[variants[0].id].thumbnail;
      title.textContent=product.name; sub.textContent=product.family;
      button.type='button'; button.dataset.product=product.id; button.setAttribute('aria-controls','detail');
      words.append(title,sub); button.append(img,words); li.append(button);
      button.addEventListener('click',()=>selectProduct(product,variants));
      return li;
    });
    list.replaceChildren(...buttons);
    byId('empty').hidden=matches.length>0; byId('detail').hidden=!matches.length;
    const selected=matches.find(match=>match.product.id===currentProduct)||matches[0];
    if(selected)selectProduct(selected.product,selected.variants);
  }
  byId('search').addEventListener('input',filter);
  byId('family').addEventListener('change',filter);
  selector.addEventListener('change',showPhoto);
  filter();
})();
